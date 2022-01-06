import 'reflect-metadata';
import 'source-map-support/register';

import ErrorStackParser from 'error-stack-parser';
import { ClassDeclaration, Node, Project, SyntaxKind } from 'ts-morph';

import { flattenValidationError, IErrorMessage } from './error-formatter';
import { ClassNotFoundError, RuntimeError } from './errors';
import { ITypeAndTree } from './nodes';
import { Parser } from './parser';

export const validatorMetadataKey = Symbol('format');

interface IValidatorOptions {
  auto: boolean;
}

export interface IValidatorClassMeta {
  filename: string;
  line: number;

  options: IValidatorOptions;
}

type Constructor<T> = new (...args: unknown[]) => T;

interface IValidationSuccess<T> {
  success: true;
  object: T;
}

interface IValidationError<T> {
  success: false;
  object: null;
  errors: Record<string | number | symbol, IErrorMessage[]>;
}

type IValidationResult<T> = IValidationSuccess<T> | IValidationError<T>;

type MaybePartial<T> = Partial<T> & Record<any, any>;

export interface IValidatorConstructorOptions {
  project: Project;
}

export class ValidatorInstance {
  project: Project;
  parser: Parser;

  classCache = new Map<string, ClassDeclaration>();

  constructor(options: IValidatorConstructorOptions) {
    this.project = options.project;
    this.parser = new Parser();
  }

  static withDefaultProject(): ValidatorInstance {
    return new ValidatorInstance({
      project: new Project({
        tsConfigFilePath: 'tsconfig.json',
        // Optionally specify compiler options, tsconfig.json, in-memory file system, and more here.
        // If you initialize with a tsconfig.json, then it will automatically populate the project
        // with the associated source files.
        // Read more: https://ts-morph.com/setup/
      }),
    });
  }

  /**
   * This method tries to find a class based on the className, filename and line where the @Validator() call occured.
   *
   * This loops through the whole syntax tree of the source file, and checks each class syntax node
   * if the line correspondents to the class. Because this is rather hacky, the `line` parameter
   * might not line up exactly to the class syntax node's start line. This considers decorators,
   * but will fail for more unconventional code styles. This however should always work:
   *
   * ```
   * @SomeDecorator()
   * @Validator()
   * @SomeOtherDecorator()
   * class Test {}
   *
   * ```
   *
   * @param filename Filename of the where the class should be searched
   * @param className String represtation of the className
   * @param line The line where the @Decorator() call occured
   * @returns
   */
  getClass(filename: string, className: string, line: number): ClassDeclaration {
    const cacheKey = `${line}:${filename}`;
    const cached = this.classCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const sourceFile = this.project.getSourceFileOrThrow(filename);

    const walkSyntaxNodes = (node: Node, level = 0): ClassDeclaration | null => {
      for (const c of node.getChildren()) {
        if (c.getKind() === SyntaxKind.ClassDeclaration) {
          const cls = c as ClassDeclaration;

          // A class can have multiple decorators, collect their line numbers and check them too
          const decoratorLineStarts = cls.getDecorators().map((decorator) => decorator.getStartLineNumber());
          for (const decoratorLineStart of decoratorLineStarts) {
            if (decoratorLineStart === line) {
              return cls;
            }
          }

          if (cls.getStartLineNumber() === line) {
            return cls;
          }
        }
        const cls = walkSyntaxNodes(c, level + 1);
        if (cls) {
          return cls;
        }
      }
      return null;
    };

    const cls = walkSyntaxNodes(sourceFile);

    if (!cls) {
      throw new ClassNotFoundError(`Class not found: ${className}`);
    }

    this.classCache.set(cacheKey, cls);

    return cls;
  }

  /**
   * This loops through all direct and indirect properties of `cls` and outputs them in the internal
   * TypeNode tree format
   *
   * @param cls A ts-morph class decleration whose members will be processed
   */
  getPropertyTypeTrees(cls: ClassDeclaration): ITypeAndTree[] {
    const trees = this.parser.getPropertyTypeTrees(cls);

    return trees;
  }

  validateOrThrow<T>(cls: Constructor<T>, values: unknown): values is T {
    if (!(typeof values === 'object') || values === null) {
      return false;
    }
    const r = this.validate(cls, values);
    if (!r.success) {
      throw new Error('a');
    }
    return r.success;
  }

  validateClassDeclaration<T>(classDeclaration: ClassDeclaration, values: MaybePartial<T>): IValidationResult<T> {
    const propertyTypeTrees = this.getPropertyTypeTrees(classDeclaration);

    let allFieldsAreValid = true;
    const errors: Record<string | number | symbol, IErrorMessage[]> = {};
    for (const { name, tree } of propertyTypeTrees) {
      const result = tree.validate(values[name], { propertyName: name });
      if (!result.success) {
        errors[name] = flattenValidationError(result, [name]);
        allFieldsAreValid = false;
      }
    }

    if (allFieldsAreValid) {
      return {
        success: true,
        object: values as T,
      };
    } else {
      console.log(JSON.stringify(errors, null, 2));
      return {
        success: false,
        object: null,
        errors,
      };
    }
  }

  validate<T>(cls: Constructor<T>, values: MaybePartial<T>): IValidationResult<T> {
    // Get metadata + types
    const validatorMeta = this.getClassMetadata(cls);

    const classDeclaration = this.getClass(validatorMeta.filename, cls.name, validatorMeta.line);

    return this.validateClassDeclaration<T>(classDeclaration, values);
  }

  validatorDecorator(options: IValidatorOptions = { auto: true }): ReturnType<typeof Reflect['metadata']> {
    const error = new Error();
    const stack = ErrorStackParser.parse(error);

    return Reflect.metadata(validatorMetadataKey, {
      filename: stack[1].fileName,
      line: stack[1].lineNumber,
      options,
    });
  }

  getClassMetadata(cls: Constructor<unknown>): IValidatorClassMeta {
    const meta = Reflect.getMetadata(validatorMetadataKey, cls);
    if (meta.filename && meta.line && meta.options) {
      return meta as IValidatorClassMeta;
    } else {
      throw new RuntimeError('No class metadata found', { cls: cls.name });
    }
  }
}

const instance = ValidatorInstance.withDefaultProject();
export const validate = instance.validate.bind(instance);
// eslint-disable-next-line @typescript-eslint/naming-convention
export const Validator = instance.validatorDecorator.bind(instance);
