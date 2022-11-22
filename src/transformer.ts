import { Project } from 'ts-morph';

import { ClassDiscovery } from './class-discovery';
import { IValidationOptions, ITypeAndTree } from './nodes';
import { SourceCodeLocationDecorator, IClassMeta } from './source-code-location-decorator';
import { Factory, TransformerParser } from './transformer-parser';
import { Constructor } from './types';
import { IValidatorConstructorOptions, ValidatorInstance, MaybePartial } from './validator';

interface ITransformerOptions {
  cls?: Constructor<unknown>;
  factory?: Factory<unknown>;
}

export interface ITransformerConstructorOptions {
  project: Project;
  validator?: Omit<IValidatorConstructorOptions, 'project'>;
  transformer?: {};
}

function defaultFactory(cls: Constructor<unknown>): Factory<unknown> {
  return (values) => {
    const obj = new cls();
    Object.assign(obj as Record<string, unknown>, values);
    return obj;
  };
}

export class TransformerInstance {
  project: Project;

  // validatorInstance: ValidatorInstance;
  parser: TransformerParser;
  classDiscovery: ClassDiscovery;
  transformerClassDecoratorFactory: SourceCodeLocationDecorator<ITransformerOptions>;

  defaultOptions: IValidationOptions;
  // valueTransformerDecoratorFactory: SourceCodeLocationDecorator<any>;

  constructor(options: IValidatorConstructorOptions) {
    this.project = options.project;
    this.classDiscovery = new ClassDiscovery(options.project);
    this.transformerClassDecoratorFactory = new SourceCodeLocationDecorator<ITransformerOptions>(
      this.classDiscovery,
      // (cls, meta) => {
      //   if (!meta.options.factory) {
      //     meta.options.factory = this.getFactory(cls);
      //   }
      // },
    );

    this.parser = TransformerParser.default(
      this.transformerClassDecoratorFactory.getClassDeclarationMapping(),
      this.classDiscovery,
      (cls) => this.getFactory(cls),
    );

    this.defaultOptions = Object.assign(
      {
        allowUnknownFields: false,
      } as IValidationOptions,
      options.defaultOptions ?? {},
    );
  }

  onDecorateValueTransformer(target: object, classMetadata: IClassMeta<any>): void {
    const dclr = this.classDiscovery.getClass(
      target.constructor.name,
      classMetadata.filename,
      classMetadata.line,
      classMetadata.column,
    );
    console.log('ondecorate', dclr);
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

  async transform<T>(cls: Constructor<T>, values: MaybePartial<T>): Promise<T> {
    const validatorMeta = this.getClassMetadata(cls);
    const classDeclaration = this.classDiscovery.getClass(
      cls.name,
      validatorMeta.filename,
      validatorMeta.line,
      validatorMeta.column,
    );

    const result = await this.parser.transform(classDeclaration, values);
    if (result.success) {
      return result.value as T;
    } else {
      throw new Error('foo');
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

  transformerDecorator(options: ITransformerOptions = {}): ReturnType<typeof Reflect['metadata']> {
    return this.transformerClassDecoratorFactory.decorator(new Error(), options);
  }

  // valueTransformerDecorator(): ReturnType<typeof Reflect['metadata']> {
  //   return this.valueTransformerDecoratorFactory.decorator(new Error());
  // }

  getClassMetadata(cls: Constructor<unknown>): IClassMeta<ITransformerOptions> {
    return this.transformerClassDecoratorFactory.getClassMetadata(cls);
  }
}
