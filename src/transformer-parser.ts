import {
  ClassDeclaration,
  DefinitionInfo,
  Identifier,
  Node,
  Type,
  TypeAliasDeclaration,
  TypeLiteralNode,
} from 'ts-morph';

import { ClassDiscovery } from './class-discovery';
import {
  createAnnotationDecorator,
  IsInteger2,
  stackingTransform,
  PropertyDecorator,
  OneOf2,
  IAnnotationDecoratorOptions,
  getAnnotations,
} from './decorators';
import { ParseError } from './errors';
import {
  ClassNode,
  IArrayNodeValidationError,
  IClassNodeValidationError,
  INodeValidationError,
  INodeValidationResult,
  INodeValidationSuccess,
  IPropertyCallbackArguments,
  IRootNodeValidationError,
  RootNode,
  TypeNode,
  ValidationErrorType,
  walkPropertyTypeTree,
} from './nodes';
import { BasicSourceCodeLocationDecorator } from './source-code-location-decorator';
import { debug } from './test/utils';
import { Constructor } from './types';
import { enumerate, zip } from './utils';
import {
  ClassCache,
  ClassOrInterfaceOrLiteral,
  getFirstSymbolDeclaration,
  getName,
  IMinimalProperty,
  Parser,
  PropertyDiscovery,
  TypeMap,
} from './validator-parser';

// eslint-disable-next-line @typescript-eslint/ban-types, @typescript-eslint/no-unused-vars
export type Transformed<FromType, ToType, TransformerOptions = {}> = ToType;
export type JSONTransformer<ToType> = Transformed<string, ToType, never>;
export type NestedTransformer<ToType> = Transformed<ToType, ToType, never>;

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
  }
}

export type TransformerFunction<
  ValueType,
  Result = Promise<unknown | (INodeValidationResult & { value: unknown })> | unknown,
> = (args: IPropertyCallbackArguments<ValueType>) => Result;
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
): PropertyDecorator & { meta: IAnnotationDecoratorOptions } {
  return transformDecorator(transformer);
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export const From = createAnnotationDecorator<[propertyName: string]>({
  name: 'fromProperty' as const,
  type: 'root',
});

class TransformerRegistry {
  decoratorFactory: BasicSourceCodeLocationDecorator<unknown>;

  constructor() {
    this.decoratorFactory = new BasicSourceCodeLocationDecorator();
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- unused at compile time, used in analyze time
  decorate<T>(options: unknown = {}): ReturnType<BasicSourceCodeLocationDecorator<unknown>['decorator']> {
    return this.decoratorFactory.decorator(new Error(), options);
  }
}

export const registry = new TransformerRegistry();

export abstract class AbstractValueTransformerFactory {
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
    return [IsInteger2(ctx.options?.radix as 10 | 16)];
  }

  getTransformer(ctx: IGetTransformerContext): TransformerFunction<string, number> {
    return ({ value }) => {
      return Number.parseInt(value, (ctx.options?.radix as number) ?? 10);
    };
  }
}

const DEFAULT_TRUE_LIST = ['on', 'true', 'yes', '1'];
const DEFAULT_FALSE_LIST = ['off', 'false', 'no', '0'];

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
    return [OneOf2([...this.trueList.values(), ...this.falseList.values()])];
  }

  getTransformer(): TransformerFunction<string> {
    return ({ value }): boolean => {
      return this.trueList.has(value);
    };
  }
}

export type Factory<T> = (values: Record<string, unknown>) => T;

interface IValueTransformerTypes {
  typeName: Identifier;
  fromType: Type;
  toType: Type;
}

export interface ITransformerOptions {
  constructor?: Constructor<unknown>;
  factory?: Factory<unknown>;
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

export class TransformerParser extends Parser {
  classDeclarationToClassReference = new ClassCache<Constructor<unknown>>();
  propertyDiscovery: PropertyDiscovery;
  valueTransformers: AbstractValueTransformerFactory[];
  classDiscovery: ClassDiscovery;
  getFactory: (cls: Constructor<unknown>) => Factory<unknown>;

  constructor(
    classDeclarationToClassReference: ClassCache<Constructor<unknown>>,
    classDiscovery: ClassDiscovery,
    getFactory: (cls: Constructor<unknown>) => Factory<unknown> = defaultFactory,
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
    classDeclarationToClassReference: ClassCache<Constructor<unknown>>,
    classDiscovery: ClassDiscovery,
    getFactory: (cls: Constructor<unknown>) => Factory<unknown>,
    extraValueTransformers: AbstractValueTransformerFactory[] = [],
  ): TransformerParser {
    return new this(classDeclarationToClassReference, classDiscovery, getFactory, [
      ...extraValueTransformers,
      new StringToNumberValueTransformer(),
      new StringToBooleanValueTransformer(),
    ]);
  }

  async recurse(
    nodeValidationResult: INodeValidationSuccess,
    value: unknown,
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
          const transformResult = await this.recurse(elementValidationResult, arrayValue);
          if (transformResult.success) {
            newValues.push(transformResult.value);
          } else {
            console.log(elementValidationResult);
            const arrayItemError = node.fail(arrayValue, {
              reason: ValidationErrorType.ARRAY_ITEM_FAILED,
              context: { element: i },
              previousErrors: [transformResult],
            });
            arrayError.previousErrors.push(arrayItemError);
            // failValidationResult(nodeValidationResult, transformResult);
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
          if (previousMatch.node.kind !== 'class') {
            throw new ParseError('Expected class node');
          }
          const classNode = previousMatch.node as ClassNode;
          const classNodeProperties = Object.fromEntries(
            classNode.getClassTrees().map(({ name }) => [name, (value as Record<string, unknown>)[name]]),
          );
          const result = await this.recurse(previousMatch, classNodeProperties);
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
        if (!node.meta.reference) {
          throw new ParseError('No class reference');
        }
        const cls = this.classDeclarationToClassReference.getByTypeReference(node.meta.reference);

        if (!cls && node.meta.from !== 'object') {
          throw new ParseError(`Can't find class by reference: ${node.meta.reference}`);
        }

        const factory = cls ? this.getFactory(cls) : (v: Record<string, unknown>) => ({ ...v });
        const newValues: Record<string | symbol | number, unknown> = {};
        const classError = node.fail(value, {
          reason: ValidationErrorType.OBJECT_PROPERTY_FAILED,
          context: {
            className: node.name,
          },
          previousErrors: [
            // {
            //   type: 'root',
            //   success: false,
            //   value: propertyValue,
            //   annotations: {},
            //   reason: ValidationErrorType.PROPERTY_FAILED,
            //   context: {
            //     className: node.name,
            //     propertyName,
            //     resolvedPropertyName: propertyName, // TODO:
            //   },
            //   previousErrors: [transformDecoratorResult],
            // },
          ],
        });
        const propertyNodeValidationResult = new Map<string, INodeValidationSuccess>(
          nodeValidationResult.previousMatches.map(
            (nvs) => [nvs.context.propertyName, nvs] as [string, INodeValidationSuccess],
          ),
        );

        const objectValues = value as Record<string | symbol | number, unknown>;
        for (const [propertyName, propertyValue] of Object.entries(objectValues)) {
          const propertyValidationResult = propertyNodeValidationResult.get(propertyName);
          const rootError: IRootNodeValidationError = {
            type: 'root',
            success: false,
            value: propertyValue,
            annotations: {},
            reason: ValidationErrorType.PROPERTY_FAILED,
            context: {
              className: node.name,
              propertyName,
              resolvedPropertyName: propertyName, // TODO:
            },
            previousErrors: [],
          };
          /* istanbul ignore if */
          if (!propertyValidationResult) {
            throw new ParseError('No propertyValidationResult found');
          }

          // Is a transformed type but there was no handler
          if (
            propertyValidationResult.node.annotations.isTransformedType &&
            !propertyValidationResult.node.annotations.transformerFunction
          ) {
            throw new ParseError(`Can't resolve transformer`);
          }

          // Has a @Transform() decorator
          if (propertyValidationResult.node.annotations.transformerFunction) {
            const transformDecoratorResult = await Promise.resolve(
              propertyValidationResult.node.annotations.transformerFunction[0]({
                value: propertyValue,
                values: value as IPropertyCallbackArguments['values'],
                success: (value) => ({ ...node.success(), value }),
                fail: node.fail.bind(node),
              }),
            );

            // Simple value returned
            if (!isNodeValidationResult(transformDecoratorResult)) {
              newValues[propertyName] = transformDecoratorResult;

              // Stop default handling -- we don't need to recurse further, a @Transformed has to recurse if needed
              continue;
            } else {
              if (transformDecoratorResult.success) {
                console.log('BLERB', transformDecoratorResult);
                newValues[propertyName] = transformDecoratorResult.value;
              } else {
                rootError.previousErrors = [transformDecoratorResult];
                classError.previousErrors.push(rootError);
              }
            }
          } else {
            const transformResult = await this.recurse(propertyValidationResult.previousMatches[0], propertyValue);
            if (transformResult.success) {
              newValues[propertyName] = transformResult.value;
            } else {
              rootError.previousErrors = [transformResult];
              classError.previousErrors.push(rootError);
              // failValidationResult(nodeValidationResult, transformResult);
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
      // case 'root': {
      //   const transformationResult = await this.recurse(nodeValidationResult.previousMatches[0], value);
      //   if (transformationResult.success) {
      //     return { ...node.success(), value: transformationResult.value };
      //   } else {
      //     return { ...node.fail(nodeValidationResult.value) };
      //   }
      // }
      case 'string':
      case 'number':
      case 'boolean':
      case 'null':
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
      case 'root':
      case 'decorator':
      case 'union': {
        throw new ParseError(`Nodes of type ${node.kind} should not appear`);
      }
    }
  }

  async transform(
    classDeclaration: ClassOrInterfaceOrLiteral,
    values: Record<string | number | symbol, unknown>,
  ): Promise<INodeValidationResult & { value: unknown }> {
    const validationResult = this.getClassNode(classDeclaration).validate(values, {
      values,
      options: { allowUnknownFields: false },
    });

    if (!validationResult.success) {
      return validationResult;
    }

    // const recurse = async (
    //   nodeValidationResult: INodeValidationSuccess,
    //   value: unknown,
    // ): Promise<INodeValidationResult & { value: unknown }> => {
    //   const node = nodeValidationResult.node as TypeNode;
    //
    //   switch (node.kind) {
    //     case 'tuple':
    //     case 'array': {
    //       const array = value as unknown[];
    //       const newValues: unknown[] = [];
    //       for (const [elementValidationResult, arrayValue] of zip(nodeValidationResult.previousMatches, array)) {
    //         const transformResult = await recurse(elementValidationResult, arrayValue);
    //         if (transformResult.success) {
    //           newValues.push(transformResult.value);
    //         } else {
    //           failValidationResult(nodeValidationResult, transformResult);
    //         }
    //       }
    //       if (nodeValidationResult.success) {
    //         return { ...node.success(), value: newValues };
    //       } else {
    //         return { ...node.fail(value) };
    //       }
    //     }
    //     case 'intersection':
    //       const newValues: Record<string | symbol | number, unknown> = {};
    //
    //       const propertyNodeValidationResult = new Map<string, INodeValidationSuccess>(
    //         nodeValidationResult.previousMatches.map(
    //           (nvs) => [nvs.context.propertyName, nvs] as [string, INodeValidationSuccess],
    //         ),
    //       );
    //
    //       const objectValues = value as Record<string | symbol | number, unknown>;
    //
    //       console.log(nodeValidationResult);
    //       return { ...node.success(), value: objectValues };
    //
    //     case 'class': {
    //       const cls = this.getClassFromDeclaration(classDeclaration);
    //       const factory = this.getFactory(cls);
    //       const newValues: Record<string | symbol | number, unknown> = {};
    //
    //       const propertyNodeValidationResult = new Map<string, INodeValidationSuccess>(
    //         nodeValidationResult.previousMatches.map(
    //           (nvs) => [nvs.context.propertyName, nvs] as [string, INodeValidationSuccess],
    //         ),
    //       );
    //
    //       const objectValues = value as Record<string | symbol | number, unknown>;
    //       for (const [propertyName, propertyValue] of Object.entries(objectValues)) {
    //         const propertyValidationResult = propertyNodeValidationResult.get(propertyName);
    //         if (!propertyValidationResult) {
    //           throw new ParseError('No propertyValidationResult found');
    //         }
    //
    //         // Is a transformed type but there was no handler
    //         if (
    //           propertyValidationResult.node.annotations.isTransformedType &&
    //           !propertyValidationResult.node.annotations.transformerFunction
    //         ) {
    //           throw new ParseError(`Can't resolve transformer`);
    //         }
    //
    //         // Has a @Transform() decorator
    //         if (propertyValidationResult.node.annotations.transformerFunction) {
    //           const transformDecoratorResult = await Promise.resolve(
    //             propertyValidationResult.node.annotations.transformerFunction[0]({
    //               value: propertyValue,
    //               values: value as IPropertyCallbackArguments['values'],
    //               success: node.success.bind(node),
    //               fail: node.fail.bind(node),
    //             }),
    //           );
    //
    //           if (!isNodeValidationResult(transformDecoratorResult)) {
    //             newValues[propertyName] = transformDecoratorResult;
    //
    //             // Stop default handling -- we don't need to recurse further, a @Transformed has to recurse if needed
    //             continue;
    //           } else {
    //             if (transformDecoratorResult.success) {
    //               newValues[propertyName] = transformDecoratorResult.value;
    //             } else {
    //               failValidationResult(nodeValidationResult, transformDecoratorResult);
    //             }
    //           }
    //         }
    //
    //         const transformResult = await recurse(propertyValidationResult.previousMatches[0], propertyValue);
    //         if (transformResult.success) {
    //           newValues[propertyName] = transformResult.value;
    //         } else {
    //           failValidationResult(nodeValidationResult, transformResult);
    //         }
    //       }
    //
    //       const obj = factory(newValues);
    //       if (nodeValidationResult.success) {
    //         return { ...node.success(), value: obj };
    //       } else {
    //         return { ...node.fail(objectValues) };
    //       }
    //     }
    //     case 'root': {
    //       const transformationResult = await recurse(nodeValidationResult.previousMatches[0], value);
    //       if (transformationResult.success) {
    //         return { ...node.success(), value: transformationResult.value };
    //       } else {
    //         return { ...node.fail(nodeValidationResult.value) };
    //       }
    //     }
    //     case 'string':
    //     case 'number':
    //     case 'boolean':
    //     case 'null':
    //     case 'enum':
    //     case 'any':
    //     case 'literal':
    //     case 'record':
    //     case 'undefined': {
    //       return {
    //         success: true,
    //         value,
    //         node,
    //         context: nodeValidationResult.context,
    //         previousMatches: nodeValidationResult.previousMatches,
    //       };
    //     }
    //     case 'decorator': {
    //       throw new Error('Not implemented yet: "decorator" case');
    //     }
    //     case 'union': {
    //       throw new ParseError('Union should not appear');
    //     }
    //   }
    // };

    return this.recurse(validationResult, values);
  }

  getValueTransformerData(valueTransformer: AbstractValueTransformerFactory): IValueTransformerTypes {
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

    const transformerTypeArguments = typeArgument.getTypeArguments();

    if (transformerTypeArguments.some((t) => t === undefined)) {
      throw new ParseError('blorb');
    }

    const [fromType, toType] = transformerTypeArguments.map((node) => node.getType());

    return { typeName, fromType, toType };
  }

  handleRootNode(property: IMinimalProperty, typeMap?: TypeMap): RootNode {
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
    }

    return rootNode;
  }

  applyDecorators(classDeclaration: ClassDeclaration, propertyKey: string, rootNode: RootNode): void {
    const property = classDeclaration.getProperty(propertyKey);

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
  getPropertyType(property: IMinimalProperty): Type {
    const transformerMeta = this.getTransformerMeta(property);
    if (transformerMeta) {
      if (!transformerMeta.fromType) {
        throw new ParseError('transformerMeta.fromType is not set');
      }
      return transformerMeta.fromType;
    } else {
      return super.getPropertyType(property);
    }
  }

  getClassFromDeclaration(classDeclaration: ClassOrInterfaceOrLiteral): Constructor<unknown> {
    const cls = this.classDeclarationToClassReference.get(classDeclaration);

    if (!cls) {
      throw new ParseError(`Class ${getName(classDeclaration)} is not decorated`);
    }
    return cls;
  }

  getTransformerMeta(property: IMinimalProperty): {
    transformerFactory: AbstractValueTransformerFactory | null;
    fromType: Type;
    toType: Type;
    options: Record<string, unknown> | undefined;
  } | null {
    const classDeclaration = property.getParent();

    if (Node.isInterfaceDeclaration(classDeclaration) || Node.isTypeLiteral(classDeclaration)) {
      return null;
    }

    if (!Node.isClassDeclaration(classDeclaration)) {
      return null;
    }

    if (!this.classDeclarationToClassReference.get(classDeclaration)) {
      return null; // REVIEW: really?
    }

    if (!Node.isNode(property)) {
      throw new Error(`Property ${property.getName()} isn't a valid node`);
    }

    if (!Node.isPropertySignature(property) && !Node.isPropertyDeclaration(property)) {
      throw new Error(`Property ${property.getName()} does not have the correct type`);
    }

    const propertyTypeNode = property.getTypeNode();

    if (!propertyTypeNode) {
      throw new Error(`${property.getName()} does not have a type node`);
    }
    if (!Node.isTypeReference(propertyTypeNode)) {
      return null;
    }

    // If property is not a type reference, it can't be a Transformed<>, so just copy value
    if (!Node.isTypeReference(propertyTypeNode)) {
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

      if (vtTypeNameDefinition === propertyTypeNameDefinition) {
        if (propertyTypeName.getText() !== 'Transformed' || (fromType === vtFromType && toType === vtToType)) {
          if (!fromType || !toType) {
            throw new ParseError(`Can't resolve from/to types from '${propertyTypeNameDefinition.getText()}'`);
          }
          return {
            transformerFactory,
            fromType,
            toType,
            options,
          };
        }
      }
    }

    if (fromType && toType && options) {
      return { transformerFactory: null, fromType, toType, options };
    }

    return null;
  }

  getComputedTypes(property: IMinimalProperty): [Type, Type, Record<string, unknown>] | null {
    if (!Node.isNode(property)) {
      throw new ParseError(`Property ${property.getName()} isn't a valid node`);
    }

    if (!Node.isPropertySignature(property) && !Node.isPropertyDeclaration(property)) {
      throw new ParseError(`Property ${property.getName()} does not have the correct type`);
    }

    const propertyTypeNode = property.getTypeNode();

    if (!propertyTypeNode) {
      throw new ParseError(`${property.getName()} does not have a type node`);
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
        throw new Error('props null');
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
      const optionProperties = getFirstSymbolDeclaration(optionsNode).getProperties();
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
