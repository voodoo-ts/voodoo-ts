import { enumerate } from './utils';

interface IValidationContext {
  propertyName?: string;
  level?: number;
}

export interface ITypeAndTree<T = any, U = keyof T> {
  name: U;
  tree: TypeNode;
}

export enum ValidationErrorType {
  // String
  NOT_A_STRING = 'NOT_A_STRING',

  // Number
  NOT_A_NUMBER = 'NOT_A_NUMBER',

  // Class
  OBJECT_PROPERTY_FAILED = 'OBJECT_PROPERTY_FAILED',
  NOT_AN_OBJECT = 'NOT_AN_OBJECT',

  // Arrays
  ELEMENT_TYPE_FAILED = 'ELEMENT_TYPE_FAILED',
  NOT_AN_ARRAY = 'NOT_AN_ARRAY',

  CUSTOM = 'CUSTOM',
}

export interface INodeValidationSuccess {
  success: true;
}

export interface INodeValidationError {
  success: false;
  type: TypeNode['kind'];
  value: unknown;
  reason?: ValidationErrorType;
  expected?: unknown;
  context?: Record<string, unknown>;
  previousError?: INodeValidationError;
}

export type INodeValidationResult = INodeValidationSuccess | INodeValidationError;

abstract class TypeNodeBase {
  abstract kind: string;
  abstract validate(value: unknown, context: IValidationContext): INodeValidationResult;

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
    return Object.assign(
      {
        success: false,
        type: this.kind as TypeNode['kind'],
        value,
      },
      extra,
    );
  }

  children: TypeNodeBase[] = [];
}

export class RootNode extends TypeNodeBase {
  kind = 'root' as const;

  validate(value: unknown, context: IValidationContext): INodeValidationResult {
    if (context.level === undefined) {
      context.level = 0;
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
    return super.fail(value, { reason: this.reason });
  }
}

export class StringNode extends LeafNode {
  kind = 'string' as const;
  reason = ValidationErrorType.NOT_A_STRING;

  validate(value: unknown, context: IValidationContext): INodeValidationResult {
    return this.wrapBoolean(value, typeof value === 'string');
  }
}

export class NumberNode extends LeafNode {
  kind = 'number' as const;
  reason = ValidationErrorType.NOT_A_NUMBER;

  validate(value: unknown, context: IValidationContext): INodeValidationResult {
    return this.wrapBoolean(value, typeof value === 'number');
  }
}

export class BooleanNode extends TypeNodeBase {
  kind = 'boolean' as const;

  validate(value: unknown, context: IValidationContext): INodeValidationResult {
    return this.wrapBoolean(value, typeof value === 'boolean');
  }
}

export class NullNode extends TypeNodeBase {
  kind = 'null' as const;

  validate(value: unknown, context: IValidationContext): INodeValidationResult {
    return this.wrapBoolean(value, value === null);
  }
}

export class UndefinedNode extends TypeNodeBase {
  kind = 'undefined' as const;

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
    return this.wrapBoolean(value, this.allowedValues.includes(value));
  }
}

export class UnionNode extends TypeNodeBase {
  kind = 'union' as const;

  validate(value: unknown, context: IValidationContext): INodeValidationResult {
    for (const child of this.children) {
      const result = child.validate(value, context);
      if (result.success) {
        return result;
      }
    }

    return this.fail(value);
  }
}

export class ArrayNode extends TypeNodeBase {
  kind = 'array' as const;

  validate(value: unknown, context: IValidationContext): INodeValidationResult {
    if (Array.isArray(value)) {
      for (const [i, item] of enumerate(value)) {
        for (const child of this.children) {
          const result = child.validate(item, context);
          if (!result.success) {
            return this.fail(value, {
              reason: ValidationErrorType.ELEMENT_TYPE_FAILED,
              context: { element: i },
              previousError: result,
            });
          }
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

  constructor(fullReference: string, getClassTrees: () => ITypeAndTree[]) {
    super();
    this.name = fullReference;
    this.getClassTrees = getClassTrees;
  }

  validate(value: unknown, context: IValidationContext): INodeValidationResult {
    if (context.level === 10) {
      throw new Error('loop');
    }
    if (typeof value === 'object' && value !== null) {
      const errors: INodeValidationError[] = [];
      for (const { name, tree } of this.getClassTrees()) {
        const result = tree.validate((value as any)[name], { level: (context.level ?? 0) + 1 });
        // console.log({ name, value, x: (value as any)[name] });
        // console.log(JSON.stringify(result, null, 2));
        if (!result.success) {
          if (!result.context) {
            result.context = {};
          }
          result.context.propertyName = name;
          result.context.className = this.name;
          errors.push(result);
        }
      }
      if (errors.length) {
        return this.fail(value, {
          reason: ValidationErrorType.OBJECT_PROPERTY_FAILED,
          context: {
            classErrors: errors,
          },
        });
      } else {
        return this.success();
      }
    } else {
      return this.fail(value, { reason: ValidationErrorType.NOT_AN_OBJECT });
    }
  }
}

export type TypeNode = RootNode | StringNode | NumberNode | NullNode | EnumNode | UnionNode | ClassNode | ArrayNode;
