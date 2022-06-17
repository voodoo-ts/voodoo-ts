import ErrorStackParser from 'error-stack-parser';
import { Constructor } from 'ts-morph';

import { type ClassDiscovery } from './class-discovery';
import { ClassNotDecoratedError } from './errors';
import { ClassCache } from './parser';

export interface IClassMeta<Options = unknown> {
  filename: string;
  line: number;
  column: number;

  options: Options;
}

export class SourceCodeLocationDecorator<T> {
  classDiscovery: ClassDiscovery;
  symbol: symbol;
  onDecorate?: (target: object, classMetadata: IClassMeta<T>) => void;

  classDeclarationToClassReference = new ClassCache<Constructor<unknown>>();

  constructor(classDiscovery: ClassDiscovery) {
    this.classDiscovery = classDiscovery;
    this.symbol = Symbol(`SourceCodeLocationDecorator${new Date().getTime()}`);
  }

  decorator(error: Error, options: T | undefined = {} as T): ReturnType<typeof Reflect['metadata']> {
    const stack = ErrorStackParser.parse(error);

    const filename = stack[1].fileName!;
    const line = stack[1].lineNumber!;
    const column = stack[1].columnNumber!;

    const classMetadata: IClassMeta<T> = {
      filename,
      line,
      column,
      options,
    };

    return (target: object) => {
      this.onDecorate?.(target, classMetadata);
      const classDeclaration = this.classDiscovery.getClass(target.constructor.name, filename, line, column);
      this.classDeclarationToClassReference.set(classDeclaration, target as Constructor<unknown>);
      Reflect.defineMetadata(this.symbol, classMetadata, target);
    };
  }

  getClassMetadata(cls: Constructor<unknown>): IClassMeta<T> {
    const meta = Reflect.getMetadata(this.symbol, cls);
    if (meta?.filename && meta?.line && meta?.options) {
      return meta as IClassMeta<T>;
    } else {
      throw new ClassNotDecoratedError('No class metadata found', { cls: cls.name });
    }
  }

  getClassDeclarationMapping(): ClassCache<Constructor<unknown>> {
    return this.classDeclarationToClassReference;
  }
}
