import { enumerate, zip } from './utils';

export interface IPropertyTransformerCallbackArguments<ValueType = unknown> {
  value: ValueType;
  values: Record<string, unknown>;
  success: TypeNodeBase['success'];
  fail: TypeNodeBase['fail'];
}

export interface IPropertyValidatorCallbackArguments<ValueType = unknown> {
  value: ValueType;
  values: Record<string, unknown>;
  success: () => INodeValidationSuccess;
  fail: (value: unknown, extra?: Partial<INodeValidationError>) => IConstraintNodeValidationError;
}

export interface IPropertyComment {
  description: string;
  tags: Array<{
    tagName: string;
    text: string;
  }>;
}

export interface IPropertyValidator {
  callback: (args: IPropertyValidatorCallbackArguments<unknown>) => INodeValidationResult;
  meta?: { name: string; context: Record<string, unknown> };
}

// Will be extended from elsewhere
export interface IAnnotationMap {
  validationFunctions?: IPropertyValidator[];
  comment?: IPropertyComment;
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

export interface ITupleNodeValidationError extends IBaseNodeValidationError {
  type: 'tuple';
  reason: ValidationErrorType.NO_LENGTH_MATCH;
  context: {
    length: number;
    expected: number;
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
  | IArrayNodeValidationError
  | IArrayNodeItemValidationError
  | IRecordNodeValidationError
  | ILiteralNodeValidationError
  | IRootNodeValidationError
  | IConstraintNodeValidationError
  | ITupleNodeValidationError;

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

  validateDecorators(value: unknown, context: IValidationContext): INodeValidationError[] {
    const errors: INodeValidationError[] = [];
    for (const propertyValidator of this.annotations.validationFunctions ?? []) {
      const fail = (v: unknown, extra?: Partial<INodeValidationError>): IConstraintNodeValidationError =>
        this.createNodeValidationError(v, 'constraint', { ...(extra ?? {}), annotations: {} });
      const result = propertyValidator.callback({
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
  }
}

export class BooleanNode extends LeafNode {
  kind = 'boolean' as const;
  reason = ValidationErrorType.NOT_A_BOOLEAN;

  validate(value: unknown): INodeValidationResult {
    return this.wrapBoolean(value, typeof value === 'boolean');
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
        type: this.expected !== null ? typeof this.expected : 'null',
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
  meta: IIntersectionMeta;

  constructor(name: string, references: string[]) {
    super();
    this.name = name;
    this.meta = { references };
  }

  validate(value: unknown, context: IValidationContext): INodeValidationResult {
    if (typeof value === 'object' && value !== null) {
      const errors: INodeValidationError[] = [];
      const previousMatches: INodeValidationSuccess[] = [];
      const allowedFields = new Set<string>();

      for (const child of this.children) {
        const childClassNodeProperties = (child as ClassNode)
          .getClassTrees()
          .map(({ name, tree }) => [name, tree.annotations.fromProperty ?? name]);

        for (const [, resolvedPropertyName] of childClassNodeProperties) {
          allowedFields.add(resolvedPropertyName);
        }

        const childClassNodeValues = Object.fromEntries(
          childClassNodeProperties.map(([, resolvedPropertyName]) => [
            resolvedPropertyName,
            (value as Record<string, unknown>)[resolvedPropertyName],
          ]),
        );

        const result = child.validate(childClassNodeValues, context);

        if (!result.success) {
          errors.push(result);
        } else {
          previousMatches.push(result);
        }
      }

      const values = value as Record<string, unknown>;
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
      const arrayTypeNode = this.children[0];
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
        const decoratorErrors = this.validateDecorators(value, context);
        if (decoratorErrors.length) {
          previousErrors.push(...decoratorErrors);
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
  reference: string;
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
        const resolvedPropertyName = tree.annotations.fromProperty ?? name;

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
      return this.fail(value, {
        reason: ValidationErrorType.NO_LENGTH_MATCH,
        context: {
          expected: this.children.length,
          length: value.length,
        },
      });
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

export type TypeNode =
  | RootNode
  | StringNode
  | NumberNode
  | EnumNode
  | UnionNode
  | ClassNode
  | ArrayNode
  | TupleNode
  | RecordNode
  | BooleanNode
  | UndefinedNode
  | LiteralNode
  | AnyNode
  | IntersectionNode;

export type TypeNodeData = Omit<
  TypeNode,
  'validate' | 'wrapBoolean' | 'success' | 'fail' | 'children' | 'getAnnotation' | 'validateDecorators'
> & {
  children: TypeNodeData[];
};
