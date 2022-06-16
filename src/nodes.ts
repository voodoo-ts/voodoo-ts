import { enumerate, zip } from './utils';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface IAnnotationMap {} // Will be extended from elsewhere

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
  OBJECT_PROPERTY_FAILED = 'OBJECT_PROPERTY_FAILED',
  NOT_AN_OBJECT = 'NOT_AN_OBJECT',

  // Arrays / Tuple
  ELEMENT_TYPE_FAILED = 'ELEMENT_TYPE_FAILED',
  ARRAY_TYPE_FAILED = 'ARRAY_TYPE_FAILED',
  NOT_AN_ARRAY = 'NOT_AN_ARRAY',
  NO_LENGTH_MATCH = 'NO_LENGTH_MATCH',

  // Literals
  LITERAL_NOT_MATCHING = 'LITERAL_NOT_MATCHING',

  // Decorators
  DECORATORS_FAILED = 'DECORATORS_FAILED',

  CUSTOM = 'CUSTOM',
}

export interface INodeValidationSuccess {
  success: true;
}

export interface INodeValidationError {
  success: false;
  type: TypeNode['kind'];
  value: unknown;
  reason?: ValidationErrorType | string;
  expected?: unknown;
  context?: Record<string, unknown>;
  previousErrors: INodeValidationError[];
}

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

abstract class TypeNodeBase {
  abstract kind: string;
  abstract validate(value: unknown, context: IValidationContext): INodeValidationResult;
  children: TypeNode[] = [];
  annotations: IAnnotationMap = {};

  wrapBoolean(value: unknown, result: boolean, extra: Partial<INodeValidationError> = {}): INodeValidationResult {
    if (result) {
      return this.success();
    } else {
      return this.fail(value, extra);
    }
  }

  success(): INodeValidationSuccess {
    return { success: true };
  }

  fail(value: unknown, extra: Partial<INodeValidationError> = {}): INodeValidationError {
    return {
      success: false,
      type: this.kind as TypeNode['kind'],
      value,
      previousErrors: [],
      ...extra,
    };
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

      return this.fail(value, { ...errorExtra, previousErrors: errors });
    }
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

    for (const child of this.children) {
      const result = child.validate(value, context);
      if (!result.success) {
        return result;
      }
    }
    return this.success();
  }
}

abstract class LeafNode extends TypeNodeBase {
  abstract reason: ValidationErrorType;

  fail(value: unknown, extra: Partial<INodeValidationError> = {}): INodeValidationError {
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

    return this.validateAllChildren(value, context);
  }
}

export class NumberNode extends LeafNode {
  kind = 'number' as const;
  reason = ValidationErrorType.NOT_A_NUMBER;

  validate(value: unknown, context: IValidationContext): INodeValidationResult {
    if (typeof value !== 'number') {
      return this.fail(value);
    }

    return this.validateAllChildren(value, context);
  }
}

export class BooleanNode extends LeafNode {
  kind = 'boolean' as const;
  reason = ValidationErrorType.NOT_A_BOOLEAN;

  validate(value: unknown, context: IValidationContext): INodeValidationResult {
    return this.wrapBoolean(value, typeof value === 'boolean');
  }
}

export class NullNode extends LeafNode {
  kind = 'null' as const;
  reason = ValidationErrorType.NOT_NULL;

  validate(value: unknown, context: IValidationContext): INodeValidationResult {
    return this.wrapBoolean(value, value === null);
  }
}

export class UndefinedNode extends LeafNode {
  kind = 'undefined' as const;
  reason = ValidationErrorType.CUSTOM;

  validate(value: unknown, context: IValidationContext): INodeValidationResult {
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
  reason = ValidationErrorType.CUSTOM;

  validate(value: unknown, context: IValidationContext): INodeValidationResult {
    return this.validateAllChildren(value, context);
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

  validate(value: unknown, context: IValidationContext): INodeValidationResult {
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
    const errors: INodeValidationError[] = [];
    for (const child of this.children) {
      const result = child.validate(value, context);
      if (!result.success) {
        if (result.reason === ValidationErrorType.OBJECT_PROPERTY_FAILED) {
          const previousErrors = result.previousErrors.filter((e) => e.reason !== ValidationErrorType.UNKNOWN_FIELD);

          if (!previousErrors.length) {
            continue;
          } else {
            result.previousErrors = previousErrors;
          }
        }
        errors.push(result);
      }
    }

    const values = value as Record<string, unknown>;
    const allowedFields = this.getAllowedFields();
    for (const name of Object.keys(values)) {
      if (!allowedFields.has(name)) {
        const error = this.fail(values[name], {
          reason: ValidationErrorType.UNKNOWN_FIELD,
          context: {
            className: this.name,
            propertyName: name,
          },
        });
        errors.push(error);
      }
    }

    if (errors.length) {
      return this.fail(value, {
        reason: ValidationErrorType.OBJECT_PROPERTY_FAILED,
        previousErrors: errors,
        context: {},
      });
    }

    return this.success();
  }
}

export class ArrayNode extends TypeNodeBase {
  kind = 'array' as const;

  validate(value: unknown, context: IValidationContext): INodeValidationResult {
    if (Array.isArray(value)) {
      const [arrayTypeNode, ...children] = this.children;
      for (const [i, item] of enumerate(value)) {
        const result = arrayTypeNode.validate(item, context);
        if (!result.success) {
          return this.fail(value, {
            reason: ValidationErrorType.ELEMENT_TYPE_FAILED,
            context: { element: i },
            previousErrors: [result],
          });
        }
      }

      for (const child of children) {
        const result = child.validate(value, context);
        if (!result.success) {
          return this.fail(value, {
            reason: ValidationErrorType.DECORATORS_FAILED,
            previousErrors: [result],
          });
        }
      }

      return this.success();
    } else {
      return this.fail(value, { reason: ValidationErrorType.NOT_AN_ARRAY });
    }
  }
}

export interface IClassOptions {
  name: string;
  meta?: Record<string, unknown>;
  validationOptions?: IValidationOptions;
}

export class ClassNode extends TypeNodeBase {
  kind = 'class' as const;

  name: string;
  meta: Record<string, unknown> = {};
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
      for (const { name, tree } of this.getClassTrees()) {
        properties.delete(name);
        if (tree.annotations.validateIf) {
          if (!tree.annotations.validateIf(value, context.values)) {
            continue;
          }
        }
        const result = tree.validate(values[name], context);
        if (!result.success) {
          if (!result.context) {
            result.context = {};
          }
          result.context.className = this.name;
          result.context.propertyName = name;
          errors.push(result);
        }

        const childrenResult = this.validateAllChildren(value, context);
        if (!childrenResult.success) {
          errors.push(childrenResult);
        }
      }

      const allowUnknownFields = context.options.allowUnknownFields;
      if (!allowUnknownFields && properties.size) {
        for (const name of properties.values()) {
          const error = this.fail(values[name], {
            reason: ValidationErrorType.UNKNOWN_FIELD,
            context: {
              className: this.name,
              propertyName: name,
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
      } else {
        return this.success();
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

    for (const [i, [child, tupleElementValue]] of enumerate(zip(this.children, value))) {
      const result = child.validate(tupleElementValue, context);
      if (!result.success) {
        return this.fail(value, {
          reason: ValidationErrorType.ELEMENT_TYPE_FAILED,
          context: { element: i },
          previousErrors: [result],
        });
      }
    }

    return this.success();
  }
}

export class RecordNode extends TypeNodeBase {
  kind = 'record' as const;

  validate(value: unknown, context: IValidationContext): INodeValidationResult {
    if (typeof value === 'object' && value !== null) {
      const valueValidationNode = this.children[1];
      for (const [objectKey, objectValue] of Object.entries(value)) {
        const valueResult = valueValidationNode.validate(objectValue, context);
        if (!valueResult.success) {
          return this.fail(value, {
            previousErrors: [valueResult],
            context: {
              valueInvalid: true,
              key: objectKey,
            },
          });
        }
      }

      return this.success();
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

  fail(value: unknown, extra: Partial<INodeValidationError> = {}): INodeValidationError {
    const context = extra.context ?? {};
    if (!context.decorator) {
      context.decorator = {
        name: this.name,
        type: this.type,
      };
    }

    extra.context = context;

    return super.fail(value, extra);
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
  'validate' | 'wrapBoolean' | 'success' | 'fail' | 'validateAllChildren' | 'children' | 'getAnnotation'
> & {
  children: TypeNodeData[];
};
