import 'reflect-metadata';

import { ClassDeclaration, Project } from 'ts-morph';

import { ClassDiscovery } from './class-discovery';
import { flattenValidationError, IErrorMessage } from './error-formatter';
import { INodeValidationError, ITypeAndTree, IValidationOptions } from './nodes';
import { IClassMeta, SourceCodeLocationDecorator } from './source-code-location-decorator';
import { Constructor } from './types';
import { Parser } from './validator-parser';

export const validatorMetadataKey = Symbol('validatorMetadata');

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface IValidatorOptions {}

export interface IValidationSuccess<T> {
  success: true;
  object: T;
  x: any; // TMP
}

export interface IValidationError<T> {
  success: false;
  object: null;
  errors: IErrorMessage[];
  rawErrors: INodeValidationError;
}

export type IValidationResult<T> = IValidationSuccess<T> | IValidationError<T>;

export type MaybePartial<T> = Partial<T> & Record<any, any>;

export interface IValidatorConstructorOptions {
  project: Project;
  defaultOptions?: IValidationOptions;
  parserClass?: Constructor<Parser>;
}

export class ValidatorInstance {
  project: Project;

  parser: Parser;
  classDiscovery: ClassDiscovery;
  decorator: SourceCodeLocationDecorator<IValidatorOptions>;

  defaultOptions: IValidationOptions;

  constructor(options: IValidatorConstructorOptions) {
    this.project = options.project;
    this.classDiscovery = new ClassDiscovery(options.project);
    this.decorator = new SourceCodeLocationDecorator<IValidatorOptions>(this.classDiscovery);
    this.parser = new (options.parserClass ?? Parser)(this.decorator.getClassDeclarationMapping());

    this.defaultOptions = Object.assign(
      {
        allowUnknownFields: false,
      } as IValidationOptions,
      options.defaultOptions ?? {},
    );
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
   * This loops through all direct and indirect properties of `cls` and outputs them in the internal
   * TypeNode tree format
   *
   * @param classDeclaration - A ts-morph class declaration whose members will be processed
   */
  getPropertyTypeTrees(classDeclaration: ClassDeclaration): ITypeAndTree[] {
    return this.parser.getPropertyTypeTrees(classDeclaration);
  }

  getPropertyTypeTreesFromConstructor<T>(cls: Constructor<T>): ITypeAndTree[] {
    const validatorMeta = this.getClassMetadata(cls);
    const classDeclaration = this.classDiscovery.getClass(
      cls.name,
      validatorMeta.filename,
      validatorMeta.line,
      validatorMeta.column,
    );
    return this.getPropertyTypeTrees(classDeclaration);
  }

  validateClassDeclaration<T>(
    classDeclaration: ClassDeclaration,
    values: MaybePartial<T>,
    options: IValidationOptions = {},
  ): IValidationResult<T> {
    const validatorClass = this.parser.getClassNode(classDeclaration);

    const allowUnknownFields = options.allowUnknownFields ?? this.defaultOptions.allowUnknownFields;
    const result = validatorClass.validate(values, {
      options: { allowUnknownFields },
      values,
    });

    if (result.success) {
      return {
        success: true,
        object: values as T,
        x: result,
      };
    } else {
      return {
        success: false,
        object: null,
        errors: flattenValidationError(result),
        rawErrors: result,
      };
    }
  }

  validate<T>(cls: Constructor<T>, values: MaybePartial<T>, options: IValidationOptions = {}): IValidationResult<T> {
    // Get metadata + types
    const validatorMeta = this.getClassMetadata(cls);
    const classDeclaration = this.classDiscovery.getClass(
      cls.name,
      validatorMeta.filename,
      validatorMeta.line,
      validatorMeta.column,
    );

    return this.validateClassDeclaration<T>(classDeclaration, values, options);
  }

  validatorDecorator(options: IValidatorOptions = {}): ReturnType<typeof Reflect['metadata']> {
    return this.decorator.decorator(new Error(), options);
  }

  getClassMetadata(cls: Constructor<unknown>): IClassMeta<IValidatorOptions> {
    return this.decorator.getClassMetadata(cls);
  }
}

const instance = ValidatorInstance.withDefaultProject();
export const validate = instance.validate.bind(instance);
// eslint-disable-next-line @typescript-eslint/naming-convention
export const Validator = instance.validatorDecorator.bind(instance);
