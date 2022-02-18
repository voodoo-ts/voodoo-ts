import { enumerate, zip } from './utils';

export interface IValidationContext {
  propertyName?: string;
  level?: number;
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

abstract class TypeNodeBase {
  abstract kind: string;
  abstract validate(value: unknown, context: IValidationContext): INodeValidationResult;
  children: TypeNode[] = [];

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

  validateAllChildren(value: unknown, context: IValidationContext): INodeValidationResult {
    for (const child of this.children) {
      const result = child.validate(value, context);
      if (!result.success) {
        return result;
      }
    }

    return this.success();
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
    if (context.level === undefined) {
      context.level = 0;
    }

    if (!this.optional && value === undefined) {
      return this.fail(value, {
        reason: ValidationErrorType.VALUE_REQUIRED,
      });
    }

    if (this.optional && value === undefined) {
      return this.success();
    }

    return this.validateAllChildren(value, context);
  }

  static rootError(value: unknown, reason: ValidationErrorType): INodeValidationError {
    return {
      success: false,
      type: 'root',
      value,
      reason,
      previousErrors: [],
    };
  }

  static unknownFieldError(value: unknown): INodeValidationError {
    return this.rootError(value, ValidationErrorType.UNKNOWN_FIELD);
  }
}

abstract class LeafNode extends TypeNodeBase {
  abstract reason: ValidationErrorType;

  fail(value: unknown, extra: Partial<INodeValidationError> = {}): INodeValidationError {
    return super.fail(value, { reason: this.reason });
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
          name: this.name,
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
            reason: ValidationErrorType.ARRAY_TYPE_FAILED,
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

export class ClassNode extends TypeNodeBase {
  kind = 'class' as const;
  name: string;
  getClassTrees: () => ITypeAndTree[];
  meta: Record<string, unknown> = {};

  constructor(name: string, getClassTrees: () => ITypeAndTree[], meta: Record<string, unknown> = {}) {
    super();
    this.name = name;
    this.getClassTrees = getClassTrees;
    this.meta = meta;
  }

  validate(value: unknown, context: IValidationContext): INodeValidationResult {
    if (typeof value === 'object' && value !== null) {
      const errors: INodeValidationError[] = [];
      for (const { name, tree } of this.getClassTrees()) {
        const result = tree.validate((value as any)[name], {
          level: (context.level ?? 0) + 1,
        });
        if (!result.success) {
          if (!result.context) {
            result.context = {};
          }
          result.context.propertyName = name;
          result.context.name = this.name;
          errors.push(result);
        }

        this.validateAllChildren(value, context);
      }
      if (errors.length) {
        return this.fail(value, {
          reason: ValidationErrorType.OBJECT_PROPERTY_FAILED,
          previousErrors: errors,
          context: {
            name: this.name,
          },
        });
      } else {
        return this.success();
      }
    } else {
      return this.fail(value, { reason: ValidationErrorType.NOT_AN_OBJECT, context: { name: this.name } });
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
  validationFunc: (value: unknown, context: IValidationContext) => INodeValidationResult;

  constructor(validationFunc: (value: unknown, context: IValidationContext) => INodeValidationResult) {
    super();
    this.validationFunc = validationFunc.bind(this);
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
  | UndefinedNode;
