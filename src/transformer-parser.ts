import { DateTime } from 'luxon';
import {
  ClassDeclaration,
  DefinitionInfo,
  Identifier,
  Node,
  NullLiteral,
  SyntaxKind,
  Type,
  TypeAliasDeclaration,
  TypeLiteralNode,
  TypeReferenceNode,
} from 'ts-morph';

import { ClassDiscovery } from './class-discovery';
import {
  createAnnotationDecorator,
  IsInteger,
  stackingTransform,
  PropertyDecorator,
  OneOf,
  IDecoratorOptions,
  IsISO8601,
  ValidateIf,
} from './decorators';
import { ParseError } from './errors';
import {
  ClassNode,
  IArrayNodeValidationError,
  IIntersectionNodeValidationError,
  INodeValidationResult,
  INodeValidationSuccess,
  IPropertyTransformerCallbackArguments,
  IRootNodeValidationError,
  IValidationOptions,
  RootNode,
  TypeNode,
  ValidationErrorType,
} from './nodes';
import { BasicSourceCodeLocationDecorator } from './source-code-location-decorator';
import { Constructor } from './types';
import { enumerate, zip } from './utils';
import {
  ClassOrInterfaceOrLiteral,
  getFirstSymbolDeclaration,
  getName,
  PropertyDeclarationOrSignature,
  Parser,
  PropertyDiscovery,
  TypeMap,
  getPropertyName,
  isClassOrInterfaceOrLiteral,
  TypeCache,
  IResolvedProperty as IResolvedPropertyType,
} from './validator-parser';

// eslint-disable-next-line @typescript-eslint/ban-types, @typescript-eslint/no-unused-vars
export type Transformed<FromType, ToType, TransformerOptions = {}> = ToType;
export type JSONTransformer<ToType> = Transformed<string, ToType, never>;
export type NestedTransformer<ToType> = Transformed<ToType, ToType, never>;

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface ITransformationOptions extends IValidationOptions {}

export interface ITransformationSuccess<T = unknown> {
  success: true;
  value: T;
  context?: Record<string, unknown>;
}

export interface ITransformationError {
  success: false;
  type: TypeNode['kind'];
  value: unknown;
  reason?: ValidationErrorType | string;
  expected?: unknown;
  context?: Record<string, unknown>;
  previousErrors: ITransformationError[];
}

export type TransformationResult<T = unknown> = ITransformationSuccess<T> | ITransformationError;

declare module './nodes' {
  // Extends the IAnnoationMap from ./nodes.ts
  // eslint-disable-next-line no-shadow
  export interface IAnnotationMap {
    transformerFunction?: Array<TransformerFunction<unknown>>;
    fromProperty?: string;
    isTransformedType?: boolean;
    isNullableTransformer?: boolean;
  }
}

export type TransformerFunction<
  ValueType,
  Result = Promise<unknown | (INodeValidationResult & { value: unknown })> | unknown,
> = (args: IPropertyTransformerCallbackArguments<ValueType>) => Result;
// | ((value: any, values: Record<string, unknown>) => Promise<unknown>)
// | ((value: any, values: Record<string, unknown>) => unknown);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const transformDecorator = createAnnotationDecorator<[transformer: TransformerFunction<any>]>({
  name: 'transformerFunction' as const,
  transformParameters: stackingTransform,
  type: 'root',
});

// eslint-disable-next-line @typescript-eslint/naming-convention
export function Transform<T, U = ReturnType<TransformerFunction<unknown>>>(
  transformer: TransformerFunction<T, U>,
): PropertyDecorator & { meta: IDecoratorOptions } {
  return transformDecorator(transformer);
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export const From = createAnnotationDecorator<[propertyName: string]>({
  name: 'fromProperty' as const,
  type: 'root',
});

class TransformerRegistry {
  decoratorFactory: BasicSourceCodeLocationDecorator<unknown> = new BasicSourceCodeLocationDecorator();

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- unused at compile time, used in analyze time
  decorate<T>(options: unknown = {}): ReturnType<BasicSourceCodeLocationDecorator<unknown>['decorator']> {
    return this.decoratorFactory.decorator(new Error(), options);
  }
}

export const registry = new TransformerRegistry();

export abstract class AbstractValueTransformerFactory {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  abstract getTransformer(ctx: IGetTransformerContext): TransformerFunction<any>; // TransformationNodeBase<unknown, unknown, unknown>;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getDecorators(ctx: IGetTransformerContext): PropertyDecorator[] {
    return [];
  }
}

export interface IGetTransformerContext {
  cls?: Constructor<unknown>;
  options?: Record<string, unknown>;
}

@registry.decorate<Transformed<string, number, { radix?: number; integer?: boolean }>>()
export class StringToNumberValueTransformer extends AbstractValueTransformerFactory {
  getDecorators(ctx: IGetTransformerContext): PropertyDecorator[] {
    return [IsInteger(ctx.options?.radix as 10 | 16)];
  }

  getTransformer(ctx: IGetTransformerContext): TransformerFunction<string, number> {
    return ({ value }) => {
      return Number.parseInt(value, (ctx.options?.radix as number) ?? 10);
    };
  }
}

export const DEFAULT_TRUE_LIST = ['on', 'true', 'yes', '1'];
export const DEFAULT_FALSE_LIST = ['off', 'false', 'no', '0'];

@registry.decorate<Transformed<string, boolean, never>>()
export class StringToBooleanValueTransformer extends AbstractValueTransformerFactory {
  trueList: Set<string>;
  falseList: Set<string>;

  constructor(trueList: string[] = DEFAULT_TRUE_LIST, falseList: string[] = DEFAULT_FALSE_LIST) {
    super();
    this.trueList = new Set(trueList);
    this.falseList = new Set(falseList);
  }

  getDecorators(): PropertyDecorator[] {
    return [OneOf([...this.trueList.values(), ...this.falseList.values()], 'BooleanString')];
  }

  getTransformer(): TransformerFunction<string> {
    return ({ value }): boolean => {
      return this.trueList.has(value);
    };
  }
}

@registry.decorate<Transformed<string, DateTime, never>>()
export class ISOStringToLuxonTransformer extends AbstractValueTransformerFactory {
  luxon: typeof import('luxon');

  constructor() {
    super();
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
    this.luxon = require('luxon') as typeof import('luxon');
  }

  getDecorators(): PropertyDecorator[] {
    return [IsISO8601()];
  }
  getTransformer(): TransformerFunction<string> {
    return ({ value }) => {
      const dt = this.luxon.DateTime.fromISO(value);
      return dt;
    };
  }
}

@registry.decorate<Transformed<DateTime, string, never>>()
export class LuxonToISOStringTransformer extends AbstractValueTransformerFactory {
  luxon: typeof import('luxon');

  constructor() {
    super();
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
    this.luxon = require('luxon') as typeof import('luxon');
  }

  getDecorators(): PropertyDecorator[] {
    return [ValidateIf(() => false), IsISO8601()];
  }

  getTransformer(): TransformerFunction<DateTime> {
    return ({ value, fail }) => {
      if (!(value instanceof this.luxon.DateTime)) {
        return fail(value, { reason: ValidationErrorType.NOT_AN_OBJECT, context: { className: 'DateTime' } });
      }
      return value.toISO();
    };
  }
}

export type Factory<T> = (values: Record<string, unknown>) => T;

interface IValueTransformerTypes {
  typeName: Identifier;
  fromType: Type;
  toType: Type;
}

export function defaultFactory(cls: Constructor<unknown>): Factory<unknown> {
  return (values) => {
    const obj = new cls();
    Object.assign(obj as Record<string, unknown>, values);
    return obj;
  };
}

function isNodeValidationResult(obj: unknown): obj is INodeValidationResult & { value: unknown } {
  return typeof obj === 'object' && !!obj && 'success' in obj;
}

export type MapItemTuple<M> = M extends Map<infer K, infer V> ? [K, V] : [never, never];

async function recurse(
  nodeValidationResult: INodeValidationSuccess,
  value: unknown,
  classDeclarationToClassReference: TypeCache<Constructor<unknown>>,
  getFactory: FactoryFunction,
  options: ITransformationOptions = {},
): Promise<INodeValidationResult & { value: unknown }> {
  const node = nodeValidationResult.node as TypeNode;

  switch (node.kind) {
    case 'tuple':
    case 'array': {
      const arrayError = node.fail(value, {
        reason: ValidationErrorType.ARRAY_FAILED,
      }) as IArrayNodeValidationError;

      const array = value as unknown[];
      const newValues: unknown[] = [];
      for (const [i, [elementValidationResult, arrayValue]] of enumerate(
        zip(nodeValidationResult.previousMatches, array),
      )) {
        const transformResult = await recurse(
          elementValidationResult,
          arrayValue,
          classDeclarationToClassReference,
          getFactory,
          options,
        );
        if (transformResult.success) {
          newValues.push(transformResult.value);
        } else {
          const arrayItemError = node.fail(arrayValue, {
            reason: ValidationErrorType.ARRAY_ITEM_FAILED,
            context: { element: i },
            previousErrors: [transformResult],
          });
          arrayError.previousErrors.push(arrayItemError);
        }
      }
      if (!arrayError.previousErrors.length) {
        return { ...node.success(), value: newValues };
      } else {
        return { ...arrayError, value: null };
      }
    }
    case 'intersection': {
      const newValues: Record<string | symbol | number, unknown> = {};
      const intersectionError = node.fail(value, {
        reason: ValidationErrorType.OBJECT_PROPERTY_FAILED,
        context: {
          className: node.name,
        },
        previousErrors: [],
      }) as IIntersectionNodeValidationError;
      for (const previousMatch of nodeValidationResult.previousMatches) {
        /* istanbul ignore if */
        if (previousMatch.node.kind !== 'class') {
          throw new ParseError('Expected class node');
        }
        const classNode = previousMatch.node as ClassNode;
        const classNodeProperties = Object.fromEntries(
          classNode
            .getClassTrees()
            .map(({ name, tree }) => [
              tree.annotations.fromProperty ?? name,
              (value as Record<string, unknown>)[tree.annotations.fromProperty ?? name],
            ]),
        );

        const result = await recurse(
          previousMatch,
          classNodeProperties,
          classDeclarationToClassReference,
          getFactory,
          options,
        );
        if (result.success) {
          for (const [key, prop] of Object.entries(result.value as Record<string, unknown>)) {
            newValues[key] = prop;
          }
        } else {
          intersectionError.previousErrors.push(result);
        }
      }

      if (!intersectionError.previousErrors.length) {
        return { ...node.success(), value: newValues };
      } else {
        return { ...intersectionError, value: null };
      }
    }
    case 'class': {
      /* istanbul ignore if */
      if (!node.meta.reference) {
        throw new ParseError('No class reference');
      }
      const cls = classDeclarationToClassReference.getByKeyWithoutParameters(node.meta.reference);

      /* istanbul ignore if */
      if (!cls && node.meta.from !== 'object' && node.meta.from !== 'interface') {
        throw new ParseError(`Can't find class by reference: ${node.meta.reference}`);
      }

      const factory = cls ? getFactory(cls) : (v: Record<string, unknown>) => ({ ...v });
      const newValues: Record<string | symbol | number, unknown> = {};
      const classError = node.fail(value, {
        reason: ValidationErrorType.OBJECT_PROPERTY_FAILED,
        context: {
          className: node.name,
        },
        previousErrors: [],
      });
      const propertyNodeValidationResult = new Map<string, INodeValidationSuccess>(
        nodeValidationResult.previousMatches.map(
          (nvs) => [nvs.context.resolvedPropertyName, nvs] as [string, INodeValidationSuccess],
        ),
      );

      const objectValues = value as Record<string | symbol | number, unknown>;
      for (const [propertyName, propertyValue] of Object.entries(objectValues)) {
        const propertyValidationResult = propertyNodeValidationResult.get(propertyName);
        if (!propertyValidationResult) {
          /* istanbul ignore else */
          if (options.allowUnknownFields) {
            // This is to be expected since unknown fields were allowed, we just skip over it
            continue;
          } else {
            throw new ParseError(`No propertyValidationResult found: ${propertyName}`);
          }
        }

        const sourcePropertyName = propertyValidationResult.context.resolvedPropertyName as string;
        const targetPropertyName = propertyValidationResult.context.propertyName as string;
        const rootError: IRootNodeValidationError = {
          type: 'root',
          success: false,
          value: propertyValue,
          annotations: propertyValidationResult.node.annotations,
          reason: ValidationErrorType.PROPERTY_FAILED,
          context: {
            className: node.name,
            propertyName,
            resolvedPropertyName: sourcePropertyName,
          },
          previousErrors: [],
        };

        // Is a transformed type but there was no handler
        if (
          propertyValidationResult.node.annotations.isTransformedType &&
          !propertyValidationResult.node.annotations.transformerFunction
        ) {
          throw new ParseError(`Can't resolve transformer`);
        }

        // Has a @Transform() decorator
        if (propertyValidationResult.node.annotations.transformerFunction) {
          if (propertyValidationResult.node.annotations.isNullableTransformer && propertyValue === null) {
            newValues[targetPropertyName] = null;
            continue;
          }

          const transformDecoratorResult = await Promise.resolve(
            propertyValidationResult.node.annotations.transformerFunction[0]({
              value: propertyValue,
              values: value as IPropertyTransformerCallbackArguments['values'],
              success: (callbackValue) => ({ ...node.success(), value: callbackValue }),
              fail: propertyValidationResult.node.fail.bind(node),
              propertyValidationResult,
            }),
          );

          // Simple value returned
          if (!isNodeValidationResult(transformDecoratorResult)) {
            newValues[targetPropertyName] = transformDecoratorResult;

            // Stop default handling -- we don't need to recurse further, a @Transformed has to recurse if needed
            continue;
          } else {
            if (transformDecoratorResult.success) {
              newValues[targetPropertyName] = transformDecoratorResult.value;
            } else {
              rootError.previousErrors = [transformDecoratorResult];
              classError.previousErrors.push(rootError);
            }
          }
        } else {
          const transformResult = await recurse(
            propertyValidationResult.previousMatches[0],
            propertyValue,
            classDeclarationToClassReference,
            getFactory,
            options,
          );
          if (transformResult.success) {
            newValues[targetPropertyName] = transformResult.value;
          } else {
            rootError.previousErrors = [transformResult];
            classError.previousErrors.push(rootError);
          }
        }
      }

      if (!classError.previousErrors.length) {
        const obj = factory(newValues);
        return { ...node.success(), value: obj };
      } else {
        return { ...classError, value: null };
      }
    }
    case 'string':
    case 'number':
    case 'boolean':
    case 'enum':
    case 'any':
    case 'literal':
    case 'record':
    case 'undefined': {
      return {
        success: true,
        value,
        node,
        context: nodeValidationResult.context,
        previousMatches: nodeValidationResult.previousMatches,
      };
    }

    /* istanbul ignore next */
    default: {
      throw new ParseError(`Nodes of type ${node.kind} should not appear`);
    }
  }
}

export async function transform(
  classNode: ClassNode,
  values: Record<string | number | symbol, unknown>,
  classDeclarationToClassReference: TypeCache<Constructor<unknown>>,
  getFactory: FactoryFunction,
  options: ITransformationOptions = {},
): Promise<INodeValidationResult & { value: unknown }> {
  const validationResult = classNode.validate(values, {
    values,
    options: { allowUnknownFields: options.allowUnknownFields ?? false },
  });

  if (!validationResult.success) {
    return validationResult;
  }

  return recurse(validationResult, values, classDeclarationToClassReference, getFactory, options);
}

//

type FactoryFunction = (cls: Constructor<unknown>) => Factory<unknown>; // TODO: rename

export interface IPropertyTransformerMeta {
  classPosition: string;
  options?: Record<string, unknown>;
}

export class TransformerParser extends Parser {
  classDeclarationToClassReference = new TypeCache<Constructor<unknown>>();
  propertyDiscovery: PropertyDiscovery;
  valueTransformers: AbstractValueTransformerFactory[];
  classDiscovery: ClassDiscovery;
  propertyTransformers: TypeCache<Map<string, IPropertyTransformerMeta>> = new TypeCache(); // Maps classRef -> { propertyName, transformer Meta }
  getFactory: FactoryFunction;

  constructor(
    classDeclarationToClassReference: TypeCache<Constructor<unknown>>,
    classDiscovery: ClassDiscovery,
    getFactory: FactoryFunction = defaultFactory,
    valueTransformers: AbstractValueTransformerFactory[] = [],
  ) {
    super(classDeclarationToClassReference);
    this.classDeclarationToClassReference = classDeclarationToClassReference;
    this.propertyDiscovery = new PropertyDiscovery();
    this.valueTransformers = valueTransformers;
    this.classDiscovery = classDiscovery;
    this.getFactory = getFactory;
  }

  static default(
    classDeclarationToClassReference: TypeCache<Constructor<unknown>>,
    classDiscovery: ClassDiscovery,
    getFactory: (cls: Constructor<unknown>) => Factory<unknown>,
    extraValueTransformers: AbstractValueTransformerFactory[] = [],
  ): TransformerParser {
    return new this(classDeclarationToClassReference, classDiscovery, getFactory, [...extraValueTransformers]);
  }

  async transform(
    classDeclaration: ClassDeclaration,
    values: Record<string | number | symbol, unknown>,
    options: ITransformationOptions = {},
  ): Promise<INodeValidationResult & { value: unknown }> {
    return transform(
      this.getCachedClassNode(classDeclaration),
      values,
      this.classDeclarationToClassReference,
      this.getFactory,
      options,
    );
  }

  /**
   * Gets the type arguments for the AbstractValuetransformerFactory object
   */
  getValueTransformerData(valueTransformer: AbstractValueTransformerFactory): IValueTransformerTypes {
    // Find valueTransformer position in source code and get the decorator's type argument (Transformed<From, To, Opts>)
    const cls = valueTransformer.constructor as Constructor<unknown>;
    const classMetadata = registry.decoratorFactory.getClassMetadata(cls);
    const classDeclaration = this.classDiscovery.getClass(
      cls.name,
      classMetadata.filename,
      classMetadata.line,
      classMetadata.column,
    );
    const decorator = classDeclaration.getDecorators()[0];
    const typeArgument = decorator.getTypeArguments()[0];

    if (!Node.isTypeReference(typeArgument)) {
      throw new ParseError('node no type ref');
    }

    if (!Node.isTypeNode(typeArgument)) {
      throw new ParseError('type arg no type');
    }
    const typeName = typeArgument.getTypeName();

    if (!Node.isIdentifier(typeName)) {
      throw new ParseError('typename is not an identifier');
    }

    // Get type arguments to the Transformed<> type used for the decorator
    const transformerTypeArguments = typeArgument.getTypeArguments();

    if (transformerTypeArguments.some((t) => t === undefined)) {
      throw new ParseError(`Invalid type arguments for Transformed<From, To, Opts>`);
    }

    const [fromType, toType] = transformerTypeArguments.map((node) => node.getType());

    return { typeName, fromType, toType };
  }

  handleRootNode(property: PropertyDeclarationOrSignature, typeMap?: TypeMap): RootNode {
    const rootNode = super.handleRootNode(property, typeMap);

    const transformerMeta = this.getTransformerMeta(property);
    if (transformerMeta?.transformerFactory) {
      const tf = transformerMeta.transformerFactory.getTransformer({
        options: transformerMeta.options,
      });
      rootNode.annotations.transformerFunction = [...(rootNode.annotations.transformerFunction ?? []), tf];
    }
    if (transformerMeta) {
      rootNode.annotations.isTransformedType = true;
      rootNode.annotations.isNullableTransformer = transformerMeta.nullable;
    }

    return rootNode;
  }

  applyDecorators(classDeclaration: ClassDeclaration, propertyKey: string, rootNode: RootNode): void {
    const property = classDeclaration.getProperties().find((p) => getPropertyName(p) === propertyKey);

    /* istanbul ignore if */
    if (!property) {
      throw new ParseError(`Can't resolve property ${classDeclaration.getName()}.${propertyKey}`);
    }

    const transformerMeta = this.getTransformerMeta(property);
    if (transformerMeta?.transformerFactory) {
      const decorators = transformerMeta.transformerFactory.getDecorators(transformerMeta ?? {});
      for (const decorator of decorators) {
        const cls = this.getClassFromDeclaration(classDeclaration);
        decorator(cls.prototype, propertyKey);
      }
    }

    super.applyDecorators(classDeclaration, propertyKey, rootNode);

    if (rootNode.annotations.isTransformedType && !rootNode.annotations.transformerFunction?.length) {
      throw new ParseError(`Property has transformed type but no factory or decorator found`);
    }
  }

  /**
   * Needed to extract type before transformation
   */
  getPropertyType(property: PropertyDeclarationOrSignature): IResolvedPropertyType {
    const transformerMeta = this.getTransformerMeta(property);
    if (transformerMeta) {
      if (!transformerMeta.fromType) {
        throw new ParseError('transformerMeta.fromType is not set');
      }

      const parent = property.getParent();
      if (!isClassOrInterfaceOrLiteral(parent)) {
        throw new ParseError('no parent match');
      }

      if (transformerMeta.transformerFactory) {
        const properties = this.propertyTransformers.get(parent, []) ?? new Map<string, IPropertyTransformerMeta>();
        const classPosition = registry.decoratorFactory.constructorToPosition.get(
          transformerMeta.transformerFactory.constructor as Constructor<unknown>,
        );
        /* istanbul ignore next */
        if (!classPosition) {
          throw new ParseError(`Could not determine class position`);
        }
        properties.set(property.getName(), { classPosition, options: transformerMeta.options });
        this.propertyTransformers.set(parent, [], properties);
      }
      return { type: transformerMeta.fromType, nullable: transformerMeta.nullable };
    } else {
      return super.getPropertyType(property);
    }
  }

  getClassFromDeclaration(classDeclaration: ClassOrInterfaceOrLiteral): Constructor<unknown> {
    const cls = this.classDeclarationToClassReference.get(classDeclaration, []);

    if (!cls) {
      throw new ParseError(`Class ${getName(classDeclaration)} is not decorated`);
    }
    return cls;
  }

  resolveNullableUnion(property: PropertyDeclarationOrSignature): {
    propertyTypeNode: TypeReferenceNode | null;
    nullable: boolean;
  } {
    const propertyTypeNode = property.getTypeNode();

    if (!propertyTypeNode) {
      throw new Error(`${property.getName()} does not have a type node`);
    }

    if (Node.isUnionTypeNode(propertyTypeNode)) {
      const children = propertyTypeNode.getChildren().at(0)?.getChildren();
      const hasNull = children?.find(
        (n): n is NullLiteral => Node.isLiteralTypeNode(n) && n.getLiteral().getKind() === SyntaxKind.NullKeyword,
      );
      const potentialTypeNode = children?.find((n): n is TypeReferenceNode => Node.isTypeReference(n));
      if (hasNull && potentialTypeNode) {
        return { propertyTypeNode: potentialTypeNode, nullable: Boolean(hasNull) };
      } else {
        return { propertyTypeNode: null, nullable: false };
      }
    } else {
      if (Node.isTypeReference(propertyTypeNode)) {
        return { propertyTypeNode, nullable: false };
      } else {
        return { propertyTypeNode: null, nullable: false };
      }
    }
  }

  getTransformerMeta(property: PropertyDeclarationOrSignature): {
    transformerFactory: AbstractValueTransformerFactory | null;
    fromType: Type;
    toType: Type;
    options: Record<string, unknown> | undefined;
    nullable: boolean;
  } | null {
    const classDeclaration = property.getParent();

    if (!Node.isClassDeclaration(classDeclaration)) {
      return null;
    }

    if (!this.classDeclarationToClassReference.get(classDeclaration, [])) {
      return null; // REVIEW: really?
    }

    const { propertyTypeNode, nullable } = this.resolveNullableUnion(property);

    if (!propertyTypeNode) {
      return null;
    }

    const propertyTypeName = propertyTypeNode.getTypeName();
    if (!Node.isIdentifier(propertyTypeName)) {
      throw new Error('');
    }
    const propertyTypeNameDefinition = propertyTypeName.getDefinitions()[0].getDeclarationNode();
    if (!Node.isTypeAliasDeclaration(propertyTypeNameDefinition)) {
      return null; // REVIEW: ?
    }

    const [fromType, toType, options] = this.getComputedTypes(property) ?? [];

    if (fromType?.isTypeParameter()) {
      throw new ParseError(
        `Transformed<FromType, ToType, Options> can only be used with concrete types. FromType is generic type ${fromType.getText()}`,
        { fromType },
      );
    }

    if (toType?.isTypeParameter()) {
      throw new ParseError(
        `Transformed<FromType, ToType, Options> can only be used with concrete types. ToType is generic type ${toType.getText()}`,
        { toType },
      );
    }

    for (const transformerFactory of this.valueTransformers) {
      const {
        typeName: vtTypeName,
        fromType: vtFromType,
        toType: vtToType,
      } = this.getValueTransformerData(transformerFactory);

      const vtTypeNameDefinition = vtTypeName.getDefinitions()[0].getDeclarationNode();

      /* istanbul ignore if */
      if (!vtTypeNameDefinition) {
        throw new ParseError(`Value transformer type definition is undefined. This should not happen`);
      }

      if (this.isSameTypeNameDefinition(vtTypeNameDefinition, propertyTypeNameDefinition)) {
        if (propertyTypeName.getText() !== 'Transformed' || (fromType === vtFromType && toType === vtToType)) {
          if (!fromType || !toType) {
            throw new ParseError(`Can't resolve from/to types from '${propertyTypeNameDefinition.getText()}'`);
          }
          return {
            transformerFactory,
            fromType,
            toType,
            options,
            nullable,
          };
        }
      }
    }

    if (fromType && toType && options) {
      return { transformerFactory: null, fromType, toType, options, nullable };
    }

    return null;
  }

  isSameTypeNameDefinition(a: Node, b: TypeAliasDeclaration): boolean {
    if (a.getText() !== b.getText()) {
      return false;
    }
    const path1 = a.getSourceFile().getFilePath();
    const path2 = b.getSourceFile().getFilePath();

    const isMine = (p: string): boolean => !!p.match(new RegExp('node_modules/@voodoo-ts/voodoo-ts/(src|lib)/'));

    if (path1 === path2 || (isMine(path1) && isMine(path2))) {
      return true;
    }

    return false;
  }

  /**
   *
   * @param property
   * @returns
   */
  getComputedTypes(property: PropertyDeclarationOrSignature): [Type, Type, Record<string, unknown>] | null {
    const propertyTypeNode = this.resolveNullableUnion(property).propertyTypeNode;
    if (!propertyTypeNode) {
      return null;
    }
    if (!Node.isTypeReference(propertyTypeNode)) {
      return null;
    }

    const propertyTypeName = propertyTypeNode.getTypeName();

    if (!Node.isIdentifier(propertyTypeName)) {
      return null;
    }

    const propertyTypeNameDefinition = propertyTypeName.getDefinitionNodes()[0];
    if (!Node.isTypeAliasDeclaration(propertyTypeNameDefinition)) {
      return null;
    }

    if (this.isTransformedType(propertyTypeNameDefinition)) {
      const [fromType, toType, options] = propertyTypeNode.getTypeArguments().map((a) => a.getType());
      return [fromType, toType, this.getOptions(options)];
    }

    const firstDefinitionReference = propertyTypeNameDefinition.findReferences()[0];
    const referenceDeclaration = firstDefinitionReference.getDefinition();
    const referenceDeclarationNode = referenceDeclaration.getDeclarationNode();

    if (!Node.isTypeAliasDeclaration(referenceDeclarationNode)) {
      return null;
    }

    const possibleTransformedReference = referenceDeclarationNode.getChildren().at(-2);

    if (!Node.isTypeReference(possibleTransformedReference)) {
      return null;
    }

    const referenceTypeName = possibleTransformedReference.getTypeName();

    if (!Node.isIdentifier(referenceTypeName)) {
      return null;
    }

    const referenceTypeDefinition = referenceTypeName.getDefinitions()[0];

    if (this.isTransformedType(referenceTypeDefinition)) {
      const [fromType, toType] = possibleTransformedReference
        .getTypeArguments()
        .slice(0, 2)
        .map((a) => a.getType());

      const typeArgs = propertyTypeNode.getTypeArguments();

      const typeParams = propertyTypeNameDefinition.getTypeParameters();

      const typeAliasToType = Array.from<[string, Node]>(
        zip(
          typeParams.map((p) => p.getName()),
          typeArgs,
        ),
      );

      // Get the type for the Options slot in Transformed<>
      const transformedOptions = possibleTransformedReference.getTypeArguments().at(-1);

      const [, typeNodeOptions] = typeAliasToType.find(([name]) => name === transformedOptions?.getText()) ?? [];

      const optionNode = Node.isTypeLiteral(transformedOptions)
        ? transformedOptions
        : Node.isTypeLiteral(typeNodeOptions)
        ? typeNodeOptions
        : null;
      if (!optionNode) {
        return [fromType, toType, {}];
      }
      const options = this.getOptions(optionNode);

      return [fromType, toType, options];
    }

    return null;
  }

  isTransformedType(propertyTypeNameDefinition: TypeAliasDeclaration | DefinitionInfo): boolean {
    return (
      propertyTypeNameDefinition.getName() === 'Transformed' &&
      propertyTypeNameDefinition.getSourceFile().getFilePath().endsWith('.ts')
    );
  }

  getOptions(optionsNode?: Type | TypeLiteralNode): Record<string, unknown> {
    if (!optionsNode) {
      return {};
    }
    // TODO: Allow nesting
    const options: Record<string, unknown> = {};
    if (options) {
      let optionProperties: ReturnType<ClassOrInterfaceOrLiteral['getProperties']>;
      try {
        optionProperties = getFirstSymbolDeclaration(optionsNode).getProperties();
      } catch (e: unknown) {
        if (e instanceof ParseError && e.message === 'No declaration found') {
          throw new ParseError('Invalid options object', {
            options: optionsNode.getText(),
          });
        } else {
          /* istanbul ignore next */
          throw e;
        }
      }
      for (const optionProperty of optionProperties) {
        if (!optionProperty.getType().isLiteral()) {
          throw new ParseError(
            `Options can only be number, string or boolean literals. Option '${optionProperty.getName()}' is of type '${optionProperty
              .getType()
              .getText()}'`,
          );
        }
        options[optionProperty.getName()] = optionProperty.getType().getLiteralValue();
      }
    }
    return options;
  }
}
