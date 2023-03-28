import { enumerate, zip } from './utils';

export interface IPropertyCallbackArguments<ValueType = unknown> {
  value: ValueType;
  values: Record<string, unknown>;
  success: TypeNodeBase['success'];
  fail: TypeNodeBase['fail'];
}

export interface IPropertyCallbackArguments2<ValueType = unknown> {
  value: ValueType;
  values: Record<string, unknown>;
  success: () => INodeValidationSuccess;
  fail: (value: unknown, extra?: Partial<INodeValidationError>) => IConstraintNodeValidationError;
}

// Will be extended from elsewhere
export interface IAnnotationMap {
  validationFunctions?: Array<(args: IPropertyCallbackArguments2<unknown>) => INodeValidationResult>;
}

export interface IValidationOptions {
  allowUnknownFields?: boolean;
}
export interface IValidationContext {
  propertyName?: string;
  values: Record<string, unknown>;
  options: IValidationOptions;
}

export interface ITypeAndTree {
  name: string;
  tree: TypeNode;
}

export enum ValidationErrorType {
  VALUE_REQUIRED = 'VALUE_REQUIRED',
  UNKNOWN_FIELD = 'UNKNOWN_FIELD',

  // String
  NOT_A_STRING = 'NOT_A_STRING',

  // Number
  NOT_A_NUMBER = 'NOT_A_NUMBER',

  // Enum
  NOT_AN_ENUM = 'NOT_AN_ENUM',

  // Boolean
  NOT_A_BOOLEAN = 'NOT_A_BOOLEAN',

  // Null
  NOT_NULL = 'NOT_NULL',

  // Union
  NO_UNION_MATCH = 'NO_UNION_MATCH',

  // Class
  PROPERTY_FAILED = 'PROPERTY_FAILED',
  OBJECT_PROPERTY_FAILED = 'OBJECT_PROPERTY_FAILED',
  NOT_AN_OBJECT = 'NOT_AN_OBJECT',

  RECORD_PROPERTY_FAILED = 'RECORD_PROPERTY_FAILED',

  // Arrays / Tuple
  ARRAY_FAILED = 'ARRAY_FAILED',
  ARRAY_ITEM_FAILED = 'ELEMENT_TYPE_FAILED',
  NOT_AN_ARRAY = 'NOT_AN_ARRAY',
  NO_LENGTH_MATCH = 'NO_LENGTH_MATCH',

  // Literals
  LITERAL_NOT_MATCHING = 'LITERAL_NOT_MATCHING',

  // Decorators
  DECORATORS_FAILED = 'DECORATORS_FAILED',

  // Generic
  TYPE_CONSTRAINT_FAILED = 'TYPE_CONSTRAINT_FAILED',

  CUSTOM = 'CUSTOM',
}

export interface INodeValidationSuccess {
  success: true;
  value?: unknown;
  node: TypeNodeBase;
  context: Record<string, unknown>;
  previousMatches: INodeValidationSuccess[];
}

export interface IBaseNodeValidationError {
  success: false;
  reason: ValidationErrorType | string;
  value: unknown;
  previousErrors: INodeValidationError[];
  annotations: IAnnotationMap;
}

export interface ILeafNodeValidationError extends IBaseNodeValidationError {
  type: 'string' | 'number' | 'boolean' | 'undefined' | 'null' | 'any';
  context: Record<string, never>;
}

export interface IEnumNodeValidationError extends IBaseNodeValidationError {
  type: 'enum';
  context: {
    enumName: string;
    allowedValues: unknown[];
  };
}

export interface IRecordNodeValidationError extends IBaseNodeValidationError {
  type: 'record';
  context: {
    valueInvalid?: boolean;
    key?: string;
  };
}

export interface ILiteralNodeValidationError extends IBaseNodeValidationError {
  type: 'literal';
  context: {
    expected: unknown;
    type: string;
  };
}

export interface IClassNodeValidationError extends IBaseNodeValidationError {
  type: 'class';
  context: {
    className: string;
  };
  previousErrors: IRootNodeValidationError[];
}

export interface IIntersectionNodeValidationError extends IBaseNodeValidationError {
  type: 'intersection';
  context: {
    className: string;
    propertyName?: string;
    resolvedPropertyName?: string;
  };
}
export interface IStringDecoratorNodeError extends IBaseNodeValidationError {
  type: 'string';
  reason: ValidationErrorType.CUSTOM;
  context: {
    test: 123;
  };
}

export interface IDecoratorNodeValidationError extends IBaseNodeValidationError {
  type: 'decorator';
  context: {
    decorator: {
      name: string;
      type: string;
    };
  } & Record<string, unknown>;
}

export interface IRootNodeValidationError extends IBaseNodeValidationError {
  type: 'root';
  context: {
    className: string;
    propertyName: string;
    resolvedPropertyName: string;
  };
}

export interface IUnionNodeValidationError extends IBaseNodeValidationError {
  type: 'union';
  context: {
    name: string;
  };
}

export interface IConstraintNodeValidationError extends IBaseNodeValidationError {
  type: 'constraint';
  context: Record<string, unknown>;
}

export interface IArrayNodeValidationError extends IBaseNodeValidationError {
  type: 'array' | 'tuple';
  context: Record<string, unknown>;
}

export interface IArrayNodeItemValidationError extends IBaseNodeValidationError {
  type: 'array' | 'tuple';
  reason: ValidationErrorType.ARRAY_ITEM_FAILED;
  context: {
    element: number;
  };
}

export function isArrayNodeValidatorError(result: INodeValidationError): result is IArrayNodeValidationError {
  return result.reason === ValidationErrorType.ARRAY_FAILED && (result.type === 'array' || result.type === 'tuple');
}

export function isArrayNodeItemValidatorError(result: INodeValidationError): result is IArrayNodeItemValidationError {
  return (
    result.reason === ValidationErrorType.ARRAY_ITEM_FAILED && (result.type === 'array' || result.type === 'tuple')
  );
}

export type INodeValidationError =
  | IClassNodeValidationError
  | IIntersectionNodeValidationError
  | ILeafNodeValidationError
  | IUnionNodeValidationError
  | IEnumNodeValidationError
  | IDecoratorNodeValidationError
  | IArrayNodeValidationError
  | IArrayNodeItemValidationError
  | IRecordNodeValidationError
  | ILiteralNodeValidationError
  | IRootNodeValidationError
  | IConstraintNodeValidationError;

export type INodeValidationResult = INodeValidationSuccess | INodeValidationError;

/**
 * Walks trough a TypeNode tree and calls the callback for each child
 * @param node - The root node of the validation tree
 * @param callback - A function which is called for each child
 */
export function walkPropertyTypeTree(node: TypeNode, callback: (n: TypeNode) => unknown): void {
  if (node.kind === 'root') {
    callback(node);
  }
  for (const child of node.children) {
    callback(child);
    walkPropertyTypeTree(child, callback);
  }
}

export class Blorb {
  foobar() {}
}

export abstract class TypeNodeBase {
  abstract kind: string;
  abstract validate(value: unknown, context: IValidationContext): INodeValidationResult;
  children: TypeNode[] = [];
  annotations: IAnnotationMap = {};
  context: Record<string, unknown> = {};

  createNodeValidationError<R extends INodeValidationError>(
    value: unknown,
    type: INodeValidationError['type'],
    extra: Partial<INodeValidationError>,
  ): R {
    return {
      success: false,
      type,
      value,
      previousErrors: [],
      reason: ValidationErrorType.CUSTOM,
      annotations: this.annotations,
      context: {},
      ...extra,
    } as R;
  }

  wrapBoolean(value: unknown, result: boolean, extra: Partial<INodeValidationError> = {}): INodeValidationResult {
    if (result) {
      return this.success();
    } else {
      return this.fail(value, extra);
    }
  }

  success(
    previousMatches: INodeValidationSuccess[] = [],
    context: Record<string, unknown> = {},
  ): INodeValidationSuccess {
    return { success: true, node: this, context, previousMatches };
  }

  fail(value: unknown, extra: Partial<INodeValidationError> = {}): INodeValidationError {
    return this.createNodeValidationError(value, this.kind as TypeNode['kind'], extra);
  }

  validateAllChildren(
    value: unknown,
    context: IValidationContext,
    errorExtra: Partial<INodeValidationError> = {},
  ): INodeValidationResult {
    const errors: INodeValidationError[] = [];
    for (const child of this.children) {
      const result = child.validate(value, context);
      if (!result.success) {
        errors.push(result);
      }
    }

    if (!errors.length) {
      return this.success();
    } else {
      if (!errorExtra.reason) {
        errorExtra.reason = ValidationErrorType.DECORATORS_FAILED;
      }

      return this.fail(value, { ...errorExtra, previousErrors: errors } as INodeValidationError);
    }
  }

  validateDecorators(value: unknown, context: IValidationContext): INodeValidationError[] {
    const errors: INodeValidationError[] = [];
    for (const constraintValidator of this.annotations.validationFunctions ?? []) {
      const fail = (v: unknown, extra?: Partial<INodeValidationError>): IConstraintNodeValidationError =>
        this.createNodeValidationError(v, 'constraint', { ...(extra ?? {}), annotations: {} });
      const result = constraintValidator({
        value,
        values: context.values,
        success: this.success.bind(this),
        fail,
      });

      if (!result.success) {
        errors.push(result);
      }
    }
    return errors;
  }
}

export class RootNode extends TypeNodeBase {
  kind = 'root' as const;
  optional: boolean;

  constructor(optional: boolean) {
    super();
    this.optional = optional;
  }

  validate(value: unknown, context: IValidationContext): INodeValidationResult {
    if (!this.optional && value === undefined) {
      return this.fail(value, {
        reason: ValidationErrorType.VALUE_REQUIRED,
      });
    }

    if (this.optional && value === undefined) {
      return this.success();
    }

    const previousMatches: INodeValidationSuccess[] = [];
    for (const child of this.children) {
      const result = child.validate(value, context);
      if (!result.success) {
        return this.fail(value, {
          reason: ValidationErrorType.PROPERTY_FAILED,
          previousErrors: [result],
        });
      } else {
        previousMatches.push(result);
      }
    }

    const errors = this.validateDecorators(value, context);

    if (errors.length) {
      return this.fail(value, {
        reason: ValidationErrorType.PROPERTY_FAILED,
        previousErrors: errors,
      });
    }

    return this.success(previousMatches);
  }

  // validateChildren(children: TypeNode[], value: unknown, context: IValidationContext): INodeValidationResult {
  //   const previousMatches: INodeValidationSuccess[] = [];
  //   for (const child of children) {
  //     const result = child.validate(value, context);
  //     if (!result.success) {
  //       return result;
  //     } else {
  //       previousMatches.push(result);
  //     }
  //   }
  //   return this.success(previousMatches);
  // }
}

export abstract class LeafNode extends TypeNodeBase {
  abstract reason: ValidationErrorType;

  fail(value: unknown, extra: Partial<ILeafNodeValidationError> = {}): INodeValidationError {
    return super.fail(value, { reason: this.reason, ...extra });
  }
}

export class StringNode extends LeafNode {
  kind = 'string' as const;
  reason = ValidationErrorType.NOT_A_STRING;

  validate(value: unknown, context: IValidationContext): INodeValidationResult {
    if (typeof value !== 'string') {
      return this.fail(value);
    }

    const errors = this.validateDecorators(value, context);

    if (!errors.length) {
      return this.success();
    } else {
      return this.fail(value, {
        previousErrors: errors,
      });
    }
    // return this.validateAllChildren(value, context);
  }
}

export class NumberNode extends LeafNode {
  kind = 'number' as const;
  reason = ValidationErrorType.NOT_A_NUMBER;

  validate(value: unknown, context: IValidationContext): INodeValidationResult {
    if (typeof value !== 'number') {
      return this.fail(value);
    }

    const errors = this.validateDecorators(value, context);

    if (!errors.length) {
      return this.success();
    } else {
      return this.fail(value, {
        previousErrors: errors,
      });
    }
    // return this.validateAllChildren(value, context);
  }
}

export class BooleanNode extends LeafNode {
  kind = 'boolean' as const;
  reason = ValidationErrorType.NOT_A_BOOLEAN;

  validate(value: unknown): INodeValidationResult {
    return this.wrapBoolean(value, typeof value === 'boolean');
  }
}

export class NullNode extends LeafNode {
  kind = 'null' as const;
  reason = ValidationErrorType.NOT_NULL;

  validate(value: unknown): INodeValidationResult {
    return this.wrapBoolean(value, value === null);
  }
}

export class UndefinedNode extends LeafNode {
  kind = 'undefined' as const;
  reason = ValidationErrorType.CUSTOM;

  validate(value: unknown): INodeValidationResult {
    return this.wrapBoolean(value, value === undefined);
  }
}

export class LiteralNode extends LeafNode {
  kind = 'literal' as const;
  reason = ValidationErrorType.LITERAL_NOT_MATCHING;

  expected: unknown;

  constructor(expected: unknown) {
    super();
    this.expected = expected;
  }

  validate(value: unknown): INodeValidationResult {
    return this.wrapBoolean(value, value === this.expected, {
      context: {
        type: typeof this.expected,
        expected: this.expected,
      },
    });
  }
}

export class AnyNode extends LeafNode {
  kind = 'any' as const;
  reason = ValidationErrorType.TYPE_CONSTRAINT_FAILED;

  validate(value: unknown, context: IValidationContext): INodeValidationResult {
    const errors = this.validateDecorators(value, context);

    if (!errors.length) {
      return this.success();
    } else {
      return this.fail(value, {
        previousErrors: errors,
      });
    }
    // return this.validateAllChildren(value, context);
  }
}

export class EnumNode extends TypeNodeBase {
  kind = 'enum' as const;
  name: string;
  allowedValues: unknown[];

  constructor(name: string, allowedValues: unknown[]) {
    super();
    this.name = name;
    this.allowedValues = allowedValues;
  }

  validate(value: unknown): INodeValidationResult {
    if (this.allowedValues.includes(value)) {
      return this.success();
    } else {
      return this.fail(value, {
        reason: ValidationErrorType.NOT_AN_ENUM,
        context: {
          enumName: this.name,
          allowedValues: this.allowedValues,
        },
      });
    }
  }
}

export class UnionNode extends TypeNodeBase {
  kind = 'union' as const;

  validate(value: unknown, context: IValidationContext): INodeValidationResult {
    const errors: INodeValidationError[] = [];
    for (const child of this.children) {
      const result = child.validate(value, context);
      if (result.success) {
        return result;
      } else {
        errors.push(result);
      }
    }

    return this.fail(value, {
      reason: ValidationErrorType.NO_UNION_MATCH,
      previousErrors: errors,
      context: {},
    });
  }
}

export interface IIntersectionMeta {
  references: string[];
}
export class IntersectionNode extends TypeNodeBase {
  kind = 'intersection' as const;

  name: string;
  getAllowedFields: () => Set<string>;

  meta: IIntersectionMeta;

  constructor(name: string, getAllowedFields: () => Set<string>, references: string[]) {
    super();
    this.name = name;
    this.getAllowedFields = getAllowedFields;
    this.meta = { references };
  }

  validate(value: unknown, context: IValidationContext): INodeValidationResult {
    if (typeof value === 'object' && value !== null) {
      const errors: INodeValidationError[] = [];
      const previousMatches: INodeValidationSuccess[] = [];

      for (const child of this.children) {
        const childClassNodeProperties = (child as ClassNode).getClassTrees().map(({ name }) => name);

        const childClassNodeValues = Object.fromEntries(
          childClassNodeProperties.map((name) => [name, (value as Record<string, unknown>)[name]]),
        );

        const result = child.validate(childClassNodeValues, context);
        if (!result.success) {
          if (result.reason === ValidationErrorType.OBJECT_PROPERTY_FAILED) {
            // TODO: implement subtype missing field handling
            // const previousErrors = (result.previousErrors as INodeValidationError[]).filter(
            //   (e) => e.reason !== ValidationErrorType.UNKNOWN_FIELD,
            // );
            // if (!previousErrors.length) {
            // continue;
            // } else {
            // result.previousErrors = previousErrors;
            // }
          }
          errors.push(result);
        } else {
          previousMatches.push(result);
        }
      }

      const values = value as Record<string, unknown>;
      const allowedFields = this.getAllowedFields();
      for (const name of Object.keys(values)) {
        // TODO: resolved name
        if (!allowedFields.has(name)) {
          const error = this.fail(values[name], {
            reason: ValidationErrorType.UNKNOWN_FIELD,
            context: {
              className: this.name,
              propertyName: name,
              resolvedPropertyName: name,
            },
          });
          errors.push(error);
        }
      }

      if (errors.length) {
        return this.fail(value, {
          reason: ValidationErrorType.OBJECT_PROPERTY_FAILED,
          previousErrors: errors,
          context: {
            className: this.name,
          },
        });
      }

      return this.success(previousMatches);
    } else {
      return this.fail(value, {
        reason: ValidationErrorType.NOT_AN_OBJECT,
        context: {
          className: this.name,
        },
      });
    }
  }
}

export class ArrayNode extends TypeNodeBase {
  kind = 'array' as const;

  validate(value: unknown, context: IValidationContext): INodeValidationResult {
    if (Array.isArray(value)) {
      const [arrayTypeNode, ...children] = this.children;
      const previousMatches: INodeValidationSuccess[] = [];
      const previousErrors: INodeValidationError[] = [];
      // Validate type for each element
      for (const [i, item] of enumerate(value)) {
        const result = arrayTypeNode.validate(item, context);
        if (!result.success) {
          previousErrors.push(
            this.fail(value, {
              reason: ValidationErrorType.ARRAY_ITEM_FAILED,
              context: { element: i },
              previousErrors: [result],
            }),
          );
        } else {
          result.context.array = { i };
          previousMatches.push(result);
        }
      }

      if (!previousErrors.length) {
        // Validate decorators for each child
        for (const child of children) {
          const result = child.validate(value, context);
          if (!result.success) {
            previousErrors.push(
              this.fail(value, {
                reason: ValidationErrorType.DECORATORS_FAILED,
                previousErrors: [result],
              }),
            );
          }
        }
      }

      if (previousErrors.length) {
        return this.fail(value, {
          reason: ValidationErrorType.ARRAY_FAILED,
          previousErrors,
        });
      } else {
        return this.success(previousMatches);
      }
    } else {
      return this.fail(value, { reason: ValidationErrorType.NOT_AN_ARRAY });
    }
  }
}

export interface IClassOptions {
  name: string;
  meta: IClassMeta;
  validationOptions?: IValidationOptions;
}

export interface IClassMeta {
  from: 'class' | 'interface' | 'object' | 'unknown';
  reference?: string;
  picked?: Set<string>;
  omitted?: Set<string>;
  partial?: boolean;
}

export class ClassNode extends TypeNodeBase {
  kind = 'class' as const;

  name: string;
  meta: IClassMeta;
  getClassTrees: () => ITypeAndTree[];

  constructor(options: IClassOptions, getClassTrees: () => ITypeAndTree[]) {
    super();
    this.name = options.name;
    this.getClassTrees = getClassTrees;
    this.meta = options.meta ?? {};
  }

  validate(value: unknown, context: IValidationContext): INodeValidationResult {
    if (typeof value === 'object' && value !== null) {
      const values = value as Record<string, unknown>;
      const properties = new Set(Object.keys(value));

      const errors: INodeValidationError[] = [];
      const previousMatches: INodeValidationSuccess[] = [];
      for (const { name, tree } of this.getClassTrees()) {
        const resolvedPropertyName = tree.annotations.from ?? name;

        properties.delete(resolvedPropertyName);
        if (tree.annotations.validateIf) {
          if (!tree.annotations.validateIf(value, context.values)) {
            continue;
          }
        }

        const result = tree.validate(values[resolvedPropertyName], context);
        if (!result.success) {
          // Ignore undefined values if this is a Partial<T>
          if (result.reason === ValidationErrorType.VALUE_REQUIRED && this.meta.partial) {
            continue;
          }

          const rootResult = result as IRootNodeValidationError;
          rootResult.context = {
            className: this.name,
            propertyName: name,
            resolvedPropertyName,
          };

          errors.push(rootResult);
        } else {
          result.context.className = this.name;
          result.context.propertyName = name;
          result.context.resolvedPropertyName = resolvedPropertyName;
          previousMatches.push(result);
        }

        const decoratorErrors = this.validateDecorators(value, context);
        if (decoratorErrors.length) {
          errors.push(...decoratorErrors);
        }
        // const childrenResult = this.validateAllChildren(value, context);
        // if (!childrenResult.success) {
        //   errors.push(childrenResult);
        // }
      }

      errors.push(...this.getUnknownFieldErrors(properties, context.options.allowUnknownFields, values));

      if (errors.length) {
        return this.fail(value, {
          reason: ValidationErrorType.OBJECT_PROPERTY_FAILED,
          previousErrors: errors,
          context: {
            className: this.name,
          },
        } as Partial<IClassNodeValidationError>);
      } else {
        return this.success(previousMatches);
      }
    } else {
      return this.fail(value, {
        reason: ValidationErrorType.NOT_AN_OBJECT,
        context: {
          className: this.name,
        },
      });
    }
  }

  getUnknownFieldErrors(
    properties: Set<unknown>,
    allowUnknownFields: boolean | undefined,
    value: Record<string, unknown>,
  ): INodeValidationError[] {
    const errors: INodeValidationError[] = [];
    if (!allowUnknownFields && properties.size) {
      for (const name of properties.values()) {
        const error = this.fail(value, {
          reason: ValidationErrorType.UNKNOWN_FIELD,
          context: {
            className: this.name,
            propertyName: name,
            resolvedPropertyName: name,
          },
        });
        errors.push(error);
      }
    }
    return errors;
  }
}

export class TupleNode extends TypeNodeBase {
  kind = 'tuple' as const;

  validate(value: unknown, context: IValidationContext): INodeValidationResult {
    if (!Array.isArray(value)) {
      return this.fail(value, { reason: ValidationErrorType.NOT_AN_ARRAY });
    }

    if (value.length !== this.children.length) {
      return this.fail(value, { reason: ValidationErrorType.NO_LENGTH_MATCH });
    }

    const previousMatches: INodeValidationSuccess[] = [];
    const previousErrors: INodeValidationError[] = [];

    for (const [i, [child, tupleElementValue]] of enumerate(zip(this.children, value))) {
      const result = child.validate(tupleElementValue, context);
      if (!result.success) {
        previousErrors.push(
          this.fail(value, {
            reason: ValidationErrorType.ARRAY_ITEM_FAILED,
            context: { element: i },
            previousErrors: [result],
          }),
        );
      } else {
        result.context.array = { i };
        previousMatches.push(result);
      }
    }

    if (previousErrors.length) {
      return this.fail(value, {
        reason: ValidationErrorType.ARRAY_FAILED,
        previousErrors,
      });
    }

    return this.success(previousMatches);
  }
}

export class RecordNode extends TypeNodeBase {
  kind = 'record' as const;

  validate(value: unknown, context: IValidationContext): INodeValidationResult {
    if (typeof value === 'object' && value !== null) {
      const valueValidationNode = this.children[1];
      const previousMatches: INodeValidationSuccess[] = [];
      for (const [objectKey, objectValue] of Object.entries(value)) {
        const valueResult = valueValidationNode.validate(objectValue, context);
        if (!valueResult.success) {
          return this.fail(value, {
            previousErrors: [valueResult],
            reason: ValidationErrorType.RECORD_PROPERTY_FAILED,
            context: {
              valueInvalid: true,
              key: objectKey,
            },
          });
        } else {
          valueResult.context.record = { property: objectKey };
          previousMatches.push(valueResult);
        }
      }

      return this.success(previousMatches);
    } else {
      return this.fail(value, { reason: ValidationErrorType.NOT_AN_OBJECT });
    }
  }
}

export class DecoratorNode extends TypeNodeBase {
  kind = 'decorator' as const;
  name: string;
  type: string;
  validationFunc: (value: unknown, context: IValidationContext) => INodeValidationResult;

  constructor(
    name: string,
    type: string,
    validationFunc: (value: unknown, context: IValidationContext) => INodeValidationResult,
  ) {
    super();
    this.name = name;
    this.type = type;
    this.validationFunc = validationFunc.bind(this);
  }

  fail(
    value: unknown,
    extra: Partial<INodeValidationError & { context: Record<string, unknown> }> = {},
  ): INodeValidationError {
    const decoratorContext = {
      name: this.name,
      type: this.type,
    };
    if (!extra.context) {
      extra.context = { decorator: decoratorContext };
    } else {
      extra.context.decorator = decoratorContext;
    }

    return super.fail(value, extra as Partial<INodeValidationError>);
  }

  validate(value: unknown, context: IValidationContext): INodeValidationResult {
    return this.validationFunc(value, context);
  }
}

export type TypeNode =
  | RootNode
  | StringNode
  | NumberNode
  | NullNode
  | EnumNode
  | UnionNode
  | ClassNode
  | ArrayNode
  | TupleNode
  | RecordNode
  | DecoratorNode
  | BooleanNode
  | UndefinedNode
  | LiteralNode
  | AnyNode
  | IntersectionNode;

export type TypeNodeData = Omit<
  TypeNode,
  | 'validate'
  | 'wrapBoolean'
  | 'success'
  | 'fail'
  | 'validateAllChildren'
  | 'children'
  | 'getAnnotation'
  | 'validateDecorators'
> & {
  children: TypeNodeData[];
};
