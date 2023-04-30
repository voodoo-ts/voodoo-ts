import { Project } from 'ts-morph';

import { ClassDiscovery } from './class-discovery';
import { FormattedErrors, formatErrors } from './error-formatter';
import { IValidationOptions, ITypeAndTree, ClassNode, INodeValidationError, INodeValidationResult } from './nodes';
import {
  SourceCodeLocationDecorator,
  BasicSourceCodeLocationDecorator,
  IClassMeta,
} from './source-code-location-decorator';
import {
  AbstractValueTransformerFactory,
  defaultFactory,
  Factory,
  ITransformationOptions,
  TransformerParser,
} from './transformer-parser';
import { Constructor } from './types';
import { Parser, TypeCache } from './validator-parser';

export interface ITransformerOptions extends IValidatorOptions {
  cls?: Constructor<unknown>;
  factory?: Factory<unknown>;
}

export interface ITransformerConstructorOptions {
  project: Project;
  validator?: Omit<IValidatorConstructorOptions, 'project'>;
  transformer?: AbstractValueTransformerFactory[];
  eager?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface IValidatorOptions {}

export interface IValidationSuccess<T> {
  success: true;
  object: T;
}

export interface IValidationError {
  success: false;
  object: null;
  errors: FormattedErrors;
  rawErrors: INodeValidationError;
}

export type IValidationResult<T> = IValidationSuccess<T> | IValidationError;

export type MaybePartial<T> = Partial<T> & Record<any, any>;

export interface IValidatorConstructorOptions {
  project: Project;
  defaultOptions?: IValidationOptions;
  parser?: (classDeclarationMapping: TypeCache<Constructor<unknown>>) => Parser;
  classDiscovery?: ClassDiscovery;
  decorator?: SourceCodeLocationDecorator<IValidatorOptions>;
}

export class ValidationError extends Error {
  errors: FormattedErrors;
  rawErrors: INodeValidationError;

  constructor(rawErros: INodeValidationError, formattedErrors: FormattedErrors) {
    super('Validation failed');
    this.errors = formattedErrors;
    this.rawErrors = rawErros;
  }
}

const NODE_MODULE_PATH = './node_modules/@vvalidator/vvalidator/src/*';

export abstract class BaseTransformerInstance {
  abstract transformerClassDecoratorFactory: BasicSourceCodeLocationDecorator<ITransformerOptions>;

  abstract transform<T>(
    cls: Constructor<T>,
    values: MaybePartial<T>,
    options?: ITransformationOptions,
  ): Promise<IValidationResult<T> & { object: unknown }>;

  abstract validate<T>(
    cls: Constructor<T>,
    values: MaybePartial<T>,
    options?: IValidationOptions,
  ): IValidationResult<T>;
  abstract getClassNode<T>(cls: Constructor<T>): ClassNode;

  transformerDecorator(options: ITransformerOptions = {}): ReturnType<(typeof Reflect)['metadata']> {
    return this.transformerClassDecoratorFactory.decorator(new Error(), options);
  }

  getClassMetadata(cls: Constructor<unknown>): IClassMeta<ITransformerOptions> {
    return this.transformerClassDecoratorFactory.getClassMetadata(cls);
  }

  nodeValidationResultToValidationResult<T>(result: INodeValidationResult): IValidationResult<T> {
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

  validateOrThrow<T>(cls: Constructor<T>, values: MaybePartial<T>, options: IValidationOptions = {}): T {
    const result = this.validate(cls, values, options);
    if (result.success) {
      return result.object;
    } else {
      throw new ValidationError(result.rawErrors, formatErrors(result.rawErrors));
    }
  }

  async transformOrThrow<T>(
    cls: Constructor<T>,
    values: MaybePartial<T>,
    options: ITransformationOptions = {},
  ): Promise<T> {
    const result = await this.transform(cls, values, options);
    if (result.success) {
      return result.object;
    } else {
      throw new ValidationError(result.rawErrors, formatErrors(result.rawErrors));
    }
  }

  // eslint-disable-next-line @typescript-eslint/naming-convention
  unwrap(): {
    transformer: BaseTransformerInstance;
    validate: BaseTransformerInstance['validate'];
    validateOrThrow: BaseTransformerInstance['validateOrThrow'];
    transform: BaseTransformerInstance['transform'];
    transformOrThrow: BaseTransformerInstance['transformOrThrow'];
    // eslint-disable-next-line @typescript-eslint/naming-convention
    Dto: BaseTransformerInstance['transformerDecorator'];
  } {
    return {
      transformer: this,
      validate: this.validate.bind(this),
      validateOrThrow: this.validateOrThrow.bind(this),
      transform: this.transform.bind(this),
      transformOrThrow: this.transformOrThrow.bind(this),
      // eslint-disable-next-line @typescript-eslint/naming-convention
      Dto: this.transformerDecorator.bind(this),
    };
  }
}

export class TransformerInstance extends BaseTransformerInstance {
  project: Project;

  parser: TransformerParser;
  classDiscovery: ClassDiscovery;
  transformerClassDecoratorFactory: SourceCodeLocationDecorator<ITransformerOptions>;

  defaultOptions: IValidationOptions;

  constructor(options: ITransformerConstructorOptions) {
    super();

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

  getClassNode<T>(cls: Constructor<T>): ClassNode {
    // Get metadata + types
    const validatorMeta = this.getClassMetadata(cls);
    const classDeclaration = this.classDiscovery.getClass(
      cls.name,
      validatorMeta.filename,
      validatorMeta.line,
      validatorMeta.column,
    );

    return this.parser.getCachedClassNode(classDeclaration);
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

  validateClassDeclaration<T>(
    validatorClass: ClassNode,
    values: MaybePartial<T>,
    options: IValidationOptions = {},
  ): IValidationResult<T> {
    const allowUnknownFields = options.allowUnknownFields ?? this.defaultOptions.allowUnknownFields;
    const result = validatorClass.validate(values, {
      options: { allowUnknownFields },
      values,
    });

    if (result.success) {
      return {
        success: true,
        object: values as T,
      };
    } else {
      return {
        success: false,
        object: null,
        errors: formatErrors(result),
        rawErrors: result,
      };
    }
  }

  validate<T>(cls: Constructor<T>, values: MaybePartial<T>, options: IValidationOptions = {}): IValidationResult<T> {
    // Get metadata + types
    const validatorClass = this.getClassNode(cls);

    return this.validateClassDeclaration<T>(validatorClass, values, options);
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
}
