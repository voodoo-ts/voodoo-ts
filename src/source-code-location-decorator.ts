import ErrorStackParser from 'error-stack-parser';
import path from 'node:path';
import { Constructor } from 'ts-morph';

import { type ClassDiscovery } from './class-discovery';
import { ClassNotDecoratedError, RuntimeError } from './errors';
import { ClassCache } from './validator-parser';

export interface IClassMeta<Options = unknown> {
  filename: string;
  line: number;
  column: number;

  options: Options;
}

export class BasicSourceCodeLocationDecorator<T> {
  symbol: symbol;
  onDecorate?: (target: object, classMetadata: IClassMeta<T>) => void;

  positionToConstructor: Map<string, Constructor<unknown>> = new Map();
  constructorToPosition: Map<Constructor<unknown>, string> = new Map();

  constructor(onDecorate?: SourceCodeLocationDecorator<T>['onDecorate']) {
    this.symbol = Symbol(`SourceCodeLocationDecorator${new Date().getTime()}`);
    this.onDecorate = onDecorate;
  }

  decorator(error: Error, options: T | undefined = {} as T): ReturnType<(typeof Reflect)['metadata']> {
    const stack = ErrorStackParser.parse(error);

    if (!stack[1]?.fileName || stack[1]?.lineNumber === undefined || stack[1]?.columnNumber === undefined) {
      throw new RuntimeError(`Can't find call-site information in stack`);
    }

    const filename = path.relative(process.cwd(), stack[1].fileName);
    const line = stack[1].lineNumber;
    const column = stack[1].columnNumber;

    const classMetadata: IClassMeta<T> = {
      filename,
      line,
      column,
      options,
    };
    const position = `${filename}:${line}:${column}`;

    return (target: object) => {
      this.setClassMetadata(target as Constructor<T>, classMetadata, position);
      this.onDecorate?.(target, classMetadata);
    };
  }

  setClassMetadata(target: Constructor<T>, classMetadata: IClassMeta<T>, position: string): void {
    this.positionToConstructor.set(position, target);
    this.constructorToPosition.set(target, position);
    Reflect.defineMetadata(this.symbol, classMetadata, target);
  }

  getClassMetadata(cls: Constructor<unknown>): IClassMeta<T> {
    const meta = Reflect.getMetadata(this.symbol, cls);
    if (meta?.filename && meta?.line && meta?.options) {
      return meta as IClassMeta<T>;
    } else {
      throw new ClassNotDecoratedError('No class metadata found', { cls: cls.name });
    }
  }
}

export class SourceCodeLocationDecorator<T> extends BasicSourceCodeLocationDecorator<T> {
  classDiscovery: ClassDiscovery;
  symbol: symbol;
  onDecorate?: (target: object, classMetadata: IClassMeta<T>) => void;

  classDeclarationToClassReference = new ClassCache<Constructor<unknown>>();

  constructor(classDiscovery: ClassDiscovery, onDecorate?: SourceCodeLocationDecorator<T>['onDecorate']) {
    super(onDecorate);
    this.classDiscovery = classDiscovery;
    this.symbol = Symbol(`SourceCodeLocationDecorator${new Date().getTime()}`);
    this.onDecorate = onDecorate;
  }

  setClassMetadata(target: Constructor<T>, classMetadata: IClassMeta<T>, position: string): void {
    super.setClassMetadata(target, classMetadata, position);
    const classDeclaration = this.classDiscovery.getClass(
      target.constructor.name,
      classMetadata.filename,
      classMetadata.line,
      classMetadata.column,
    );
    this.classDeclarationToClassReference.set(classDeclaration, target as Constructor<unknown>);
  }

  getClassDeclarationMapping(): ClassCache<Constructor<unknown>> {
    return this.classDeclarationToClassReference;
  }
}
