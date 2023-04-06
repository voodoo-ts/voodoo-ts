import { Project } from 'ts-morph';

import { ClassDiscovery } from './class-discovery';
import { IValidationOptions, ITypeAndTree } from './nodes';
import { SourceCodeLocationDecorator, IClassMeta } from './source-code-location-decorator';
import { defaultFactory, Factory, TransformerParser } from './transformer-parser';
import { Constructor } from './types';
import {
  IValidatorConstructorOptions,
  ValidatorInstance,
  MaybePartial,
  IValidationResult,
  IValidatorOptions,
  ValidationError,
} from './validator';

interface ITransformerOptions extends IValidatorOptions {
  cls?: Constructor<unknown>;
  factory?: Factory<unknown>;
}

export interface ITransformerConstructorOptions {
  project: Project;
  validator?: Omit<IValidatorConstructorOptions, 'project'>;
  transformer?: {};
}

export class TransformerInstance {
  project: Project;

  validatorInstance: ValidatorInstance;
  parser: TransformerParser;
  classDiscovery: ClassDiscovery;
  transformerClassDecoratorFactory: SourceCodeLocationDecorator<ITransformerOptions>;

  defaultOptions: IValidationOptions;

  constructor(options: ITransformerConstructorOptions) {
    this.project = options.project;
    this.classDiscovery = new ClassDiscovery(options.project);
    this.transformerClassDecoratorFactory = new SourceCodeLocationDecorator<ITransformerOptions>(this.classDiscovery);

    this.parser = TransformerParser.default(
      this.transformerClassDecoratorFactory.getClassDeclarationMapping(),
      this.classDiscovery,
      (cls) => this.getFactory(cls),
    );

    this.validatorInstance = new ValidatorInstance({
      project: options.project,
      classDiscovery: this.classDiscovery,
      decorator: this.transformerClassDecoratorFactory,
      parser: () => this.parser,
      ...options.validator,
    });

    this.defaultOptions = {};
  }

  static withDefaultProject(): TransformerInstance {
    return new TransformerInstance({
      project: new Project({
        tsConfigFilePath: 'tsconfig.json',
        // Optionally specify compiler options, tsconfig.json, in-memory file system, and more here.
        // If you initialize with a tsconfig.json, then it will automatically populate the project
        // with the associated source files.
        // Read more: https://ts-morph.com/setup/
      }),
    });
  }

  getFactory(cls: Constructor<unknown>): Factory<unknown> {
    const validatorMeta = this.getClassMetadata(cls);
    if (validatorMeta.options.factory) {
      return validatorMeta.options.factory;
    } else if (validatorMeta.options.cls) {
      return defaultFactory(validatorMeta.options.cls);
    } else {
      return defaultFactory(cls);
    }
  }

  async transformOrThrow<T>(cls: Constructor<T>, values: MaybePartial<T>): Promise<T> {
    const result = await this.transform(cls, values);
    if (result.success) {
      return result.object;
    } else {
      throw new ValidationError(result.rawErrors);
    }
  }

  async transform<T>(
    cls: Constructor<T>,
    values: MaybePartial<T>,
  ): Promise<IValidationResult<T> & { object: unknown }> {
    const validatorMeta = this.getClassMetadata(cls);
    const classDeclaration = this.classDiscovery.getClass(
      cls.name,
      validatorMeta.filename,
      validatorMeta.line,
      validatorMeta.column,
    );

    const result = await this.parser.transform(classDeclaration, values);
    if (result.success) {
      return {
        success: true,
        object: result.value as T,
      };
    } else {
      return {
        success: false,
        rawErrors: result,
        object: null,
        errors: [],
      };
    }
  }

  validate<T>(cls: Constructor<T>, values: MaybePartial<T>, options: IValidationOptions = {}): IValidationResult<T> {
    return this.validatorInstance.validate(cls, values, options);
  }

  getPropertyTypeTreesFromConstructor<T>(cls: Constructor<T>): ITypeAndTree[] {
    const validatorMeta = this.getClassMetadata(cls);
    const classDeclaration = this.classDiscovery.getClass(
      cls.name,
      validatorMeta.filename,
      validatorMeta.line,
      validatorMeta.column,
    );
    return this.parser.getPropertyTypeTrees(classDeclaration);
  }

  transformerDecorator(options: ITransformerOptions = {}): ReturnType<(typeof Reflect)['metadata']> {
    return this.transformerClassDecoratorFactory.decorator(new Error(), options);
  }

  getClassMetadata(cls: Constructor<unknown>): IClassMeta<ITransformerOptions> {
    return this.transformerClassDecoratorFactory.getClassMetadata(cls);
  }
}
