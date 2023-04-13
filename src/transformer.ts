import { Project } from 'ts-morph';

import { ClassDiscovery } from './class-discovery';
import { formatErrors } from './error-formatter';
import { IValidationOptions, ITypeAndTree } from './nodes';
import { SourceCodeLocationDecorator, IClassMeta } from './source-code-location-decorator';
import {
  AbstractValueTransformerFactory,
  defaultFactory,
  Factory,
  ITransformationOptions,
  TransformerParser,
} from './transformer-parser';
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
  transformer?: AbstractValueTransformerFactory[];
  eager?: boolean;
}

const NODE_MODULE_PATH = './node_modules/@vvalidator/vvalidator/src/*';

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

    const onDecorate = (cls: object): void => {
      if (options.eager) {
        this.getPropertyTypeTreesFromConstructor(cls as Constructor<unknown>);
      }
    };
    this.transformerClassDecoratorFactory = new SourceCodeLocationDecorator<ITransformerOptions>(
      this.classDiscovery,
      onDecorate,
    );

    this.parser = TransformerParser.default(
      this.transformerClassDecoratorFactory.getClassDeclarationMapping(),
      this.classDiscovery,
      (cls) => this.getFactory(cls),
      options.transformer ?? [],
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

  static withDefaultProject(
    options: Omit<ITransformerConstructorOptions, 'project'> = { eager: false },
  ): TransformerInstance {
    const project = new Project({
      tsConfigFilePath: 'tsconfig.json',
    });
    project.addSourceFilesAtPaths(NODE_MODULE_PATH);

    return new TransformerInstance({ project, ...options });
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
      throw new ValidationError(result.rawErrors, formatErrors(result.rawErrors));
    }
  }

  async transform<T>(
    cls: Constructor<T>,
    values: MaybePartial<T>,
    options: ITransformationOptions = {},
  ): Promise<IValidationResult<T> & { object: unknown }> {
    const validatorMeta = this.getClassMetadata(cls);
    const classDeclaration = this.classDiscovery.getClass(
      cls.name,
      validatorMeta.filename,
      validatorMeta.line,
      validatorMeta.column,
    );

    const result = await this.parser.transform(classDeclaration, values, options);
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
        errors: formatErrors(result),
      };
    }
  }

  validate<T>(cls: Constructor<T>, values: MaybePartial<T>, options: IValidationOptions = {}): IValidationResult<T> {
    return this.validatorInstance.validate(cls, values, options);
  }

  validateOrThrow<T>(cls: Constructor<T>, values: MaybePartial<T>, options: IValidationOptions = {}): T {
    const result = this.validate(cls, values, options);
    if (result.success) {
      return result.object;
    } else {
      throw new ValidationError(result.rawErrors, formatErrors(result.rawErrors));
    }
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

  // eslint-disable-next-line @typescript-eslint/naming-convention
  unwrap(): {
    validate: TransformerInstance['validate'];
    validateOrThrow: TransformerInstance['validateOrThrow'];
    transform: TransformerInstance['transform'];
    transformOrThrow: TransformerInstance['transformOrThrow'];
    // eslint-disable-next-line @typescript-eslint/naming-convention
    Dto: TransformerInstance['transformerDecorator'];
  } {
    return {
      validate: this.validate.bind(this),
      validateOrThrow: this.validateOrThrow.bind(this),
      transform: this.transform.bind(this),
      transformOrThrow: this.transformOrThrow.bind(this),
      // eslint-disable-next-line @typescript-eslint/naming-convention
      Dto: this.transformerDecorator.bind(this),
    };
  }
}
