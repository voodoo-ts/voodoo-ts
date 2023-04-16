/* istanbul ignore file */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import {
  AnyNode,
  ArrayNode,
  BooleanNode,
  ClassNode,
  IArrayNodeItemValidationError,
  IArrayNodeValidationError,
  IClassMeta,
  IConstraintNodeValidationError,
  IEnumNodeValidationError,
  IIntersectionNodeValidationError,
  ILeafNodeValidationError,
  ILiteralNodeValidationError,
  INodeValidationError,
  INodeValidationResult,
  INodeValidationSuccess,
  IntersectionNode,
  IRecordNodeValidationError,
  IRootNodeValidationError,
  IUnionNodeValidationError,
  LeafNode,
  LiteralNode,
  NumberNode,
  RecordNode,
  RootNode,
  StringNode,
  TupleNode,
  TypeNodeBase,
  UnionNode,
  ValidationErrorType,
} from '../nodes';
import { Constructor } from '../types';

export class ClassNodeFixture extends ClassNode {
  static create(name: string, meta: IClassMeta, r: Partial<ClassNode> = {}): ClassNode {
    meta = Object.assign(
      {
        from: expect.any(String),
        reference: expect.any(String),
      },
      meta,
    );

    const f = new ClassNode({ name, meta }, expect.any(Function));
    Object.assign(f, r);
    return f;
  }

  static createForClass(
    cls: Constructor<unknown>,
    meta: Omit<IClassMeta, 'from'> = {},
    r: Partial<ClassNode> = {},
  ): ClassNode {
    return this.create(cls.name, { from: 'class', ...meta }, r);
  }

  static createForLiteral(meta: Omit<IClassMeta, 'from'> = {}, r: Partial<ClassNode> = {}): ClassNode {
    return this.create(
      '',
      {
        from: 'object',
        ...meta,
      },
      { name: expectFilenameAndLine(), ...r },
    );
  }
}

export class IntersectionNodeFixture extends IntersectionNode {
  static create(name: string, references: string[], r: Partial<IntersectionNode> = {}): IntersectionNode {
    const f = new IntersectionNode(name, references);
    Object.assign(f, r);
    return f;
  }
}

export class RecordNodeFixture extends RecordNode {
  static create(extra: Partial<RecordNode> = {}): RecordNode {
    const fixture = new RecordNode();
    return Object.assign(fixture, extra);
  }
}

export class TupleNodeFixture extends TupleNode {
  static create(extra: Partial<TupleNode> = {}): TupleNode {
    const fixture = new TupleNode();
    return Object.assign(fixture, extra);
  }
}

export class StringNodeFixture extends StringNode {
  static create(extra: Partial<StringNode> = {}): StringNode {
    const fixture = new StringNode();
    return Object.assign(fixture, extra);
  }
}

export class NumberNodeFixture {
  static create(extra: Partial<NumberNode> = {}): NumberNode {
    const fixture = new NumberNode();
    return Object.assign(fixture, extra);
  }
}

export class BooleanNodeFixture {
  static create(extra: Partial<BooleanNode> = {}): BooleanNode {
    const fixture = new BooleanNode();
    return Object.assign(fixture, extra);
  }
}

export class AnyNodeFixture {
  static create(extra: Partial<AnyNode> = {}): AnyNode {
    const fixture = new AnyNode();
    return Object.assign(fixture, extra);
  }
}

export class LiteralNodeFixture {
  static create(expected: unknown, extra: Partial<LiteralNode> = {}): LiteralNode {
    const fixture = new LiteralNode(expected);
    return Object.assign(fixture, extra);
  }
}

export class ArrayNodeFixture {
  static create(extra: Partial<ArrayNode> = {}): ArrayNode {
    const fixture = new ArrayNode();
    return Object.assign(fixture, extra);
  }
}

export class UnionNodeFixture {
  static create(extra: Partial<UnionNode> = {}): UnionNode {
    const fixture = new UnionNode();
    return Object.assign(fixture, extra);
  }
}

export class RootNodeFixture extends RootNode {
  static create(optional: boolean, extra: Partial<RootNode>): RootNode {
    const fixture = new RootNode(optional);
    return Object.assign(fixture, extra);
  }

  static createRequired(extra: Partial<RootNode> = {}): RootNode {
    return this.create(false, extra);
  }

  static createOptional(extra: Partial<RootNode> = {}): RootNode {
    return this.create(true, extra);
  }
}

export function expectFilenameAndLine(): ReturnType<(typeof expect)['stringMatching']> {
  return expect.stringMatching(/.*\/.+?\.spec\.(ts|js):\d+$/);
}

export function expectAnyFunction(): (...args: any[]) => any {
  return expect.any(Function);
}

export class NodeValidationErrorFixture {
  static create(
    values: Omit<INodeValidationError, 'success' | 'value' | 'previousErrors' | 'annotations' | 'context'> &
      Partial<Pick<INodeValidationError, 'success' | 'value' | 'previousErrors' | 'annotations' | 'context'>> & {
        context?: unknown;
      },
  ): INodeValidationError {
    const error = {
      success: false,
      annotations: {},
      context: {},
      previousErrors: [],
      ...values,
    } as INodeValidationError;

    return error;
  }

  static arrayError(values: Partial<IArrayNodeValidationError>): INodeValidationError {
    return this.create({ type: 'array', reason: ValidationErrorType.ARRAY_FAILED, ...values });
  }

  static arrayItemError(values: Partial<IArrayNodeItemValidationError>): INodeValidationError {
    return this.create({ type: 'array', reason: ValidationErrorType.ARRAY_ITEM_FAILED, ...values });
  }

  static tupleError(values: Partial<IArrayNodeValidationError>): INodeValidationError {
    return this.create({ type: 'tuple', reason: ValidationErrorType.ARRAY_FAILED, ...values });
  }

  static tupleItemError(values: Partial<IArrayNodeItemValidationError>): INodeValidationError {
    return this.create({ type: 'tuple', reason: ValidationErrorType.ARRAY_ITEM_FAILED, ...values });
  }

  static stringError(values: Partial<ILeafNodeValidationError> = {}): INodeValidationError {
    return this.create({ type: 'string', reason: ValidationErrorType.NOT_A_STRING, ...values });
  }

  static booleanError(values: Partial<ILeafNodeValidationError> = {}): INodeValidationError {
    return this.create({ type: 'boolean', reason: ValidationErrorType.NOT_A_BOOLEAN, ...values });
  }

  static numberError(values: Partial<ILeafNodeValidationError> = {}): INodeValidationError {
    return this.create({ type: 'number', reason: ValidationErrorType.NOT_A_NUMBER, ...values });
  }

  static recordError(values: Partial<IRecordNodeValidationError> = {}): INodeValidationError {
    return this.create({ type: 'record', reason: ValidationErrorType.CUSTOM, ...values });
  }

  static unionError(values: Partial<IUnionNodeValidationError> = {}): INodeValidationError {
    return this.create({ type: 'union', reason: ValidationErrorType.NO_UNION_MATCH, ...values });
  }

  static literalError(values: Partial<ILiteralNodeValidationError> = {}): INodeValidationError {
    return this.create({ type: 'literal', reason: ValidationErrorType.LITERAL_NOT_MATCHING, ...values });
  }

  static enumError(values: Partial<IEnumNodeValidationError> = {}): INodeValidationError {
    return this.create({ type: 'enum', reason: ValidationErrorType.NOT_AN_ENUM, ...values });
  }

  static classNotAObjectError(cls: string | Constructor<unknown>): INodeValidationError {
    const className = typeof cls === 'string' ? cls : cls.name;
    return this.create({ type: 'class', reason: ValidationErrorType.NOT_AN_OBJECT, context: { className } });
  }

  static objectPropertyUnknown<T>(
    cls: string | Constructor<T>,
    propertyName: typeof cls extends string ? string : keyof T,
    values: Partial<IRootNodeValidationError> = {},
  ): INodeValidationError {
    const className = typeof cls === 'string' ? cls : cls.name;
    return this.create({
      type: 'class',
      reason: ValidationErrorType.UNKNOWN_FIELD,
      context: { className, propertyName, resolvedPropertyName: propertyName },
      ...values,
    });
  }

  static objectPropertyFailed(
    cls: string | Constructor<unknown>,
    values: Partial<IRootNodeValidationError> = {},
  ): INodeValidationError {
    const className = typeof cls === 'string' ? cls : cls.name;
    return this.create({
      type: 'class',
      reason: ValidationErrorType.OBJECT_PROPERTY_FAILED,
      context: { className },
      ...values,
    });
  }

  static intersectionPropertyFailed(values: Partial<IIntersectionNodeValidationError> = {}): INodeValidationError {
    return this.create({
      type: 'intersection',
      reason: ValidationErrorType.OBJECT_PROPERTY_FAILED,
      ...values,
    });
  }

  static rootError<T>(
    cls: string | Constructor<T>,
    propertyName: typeof cls extends string ? string : keyof T,
    values: Partial<IRootNodeValidationError> = {},
  ): INodeValidationError {
    const className = typeof cls === 'string' ? cls : cls.name;
    return this.create({
      type: 'root',
      reason: ValidationErrorType.PROPERTY_FAILED,
      context: {
        className,
        propertyName,
        resolvedPropertyName: propertyName,
      },
      ...values,
    });
  }

  static singleObjectPropertyFailed<T>(
    cls: string | Constructor<T>,
    propertyName: typeof cls extends string ? string : keyof T,
    values: Partial<IRootNodeValidationError> = {},
  ): INodeValidationError {
    const className = typeof cls === 'string' ? cls : cls.name;
    return this.create({
      type: 'class',
      reason: ValidationErrorType.OBJECT_PROPERTY_FAILED,
      context: { className },
      previousErrors: [
        this.create({
          type: 'root',
          reason: ValidationErrorType.PROPERTY_FAILED,
          context: { className, propertyName, resolvedPropertyName: propertyName },
          ...values,
        }),
      ],
    });
  }

  static objectPropertyFailedForClass<T>(
    cls: Constructor<T>,
    propertyName: keyof T,
    values: Partial<IRootNodeValidationError>,
  ): INodeValidationError {
    return this.singleObjectPropertyFailed(cls.name, propertyName as string, values);
  }

  static constraintError(values: Partial<IConstraintNodeValidationError> & { reason: string }): INodeValidationError {
    return this.create({
      type: 'constraint',
      context: {},
      ...values,
    });
  }
}

export class NodeValidationErrorMatcher extends NodeValidationErrorFixture {
  static create(
    values: Omit<INodeValidationError, 'success' | 'value' | 'previousErrors' | 'annotations' | 'context'> &
      Partial<Pick<INodeValidationError, 'success' | 'value' | 'previousErrors' | 'annotations' | 'context'>> & {
        context?: unknown;
      },
  ): INodeValidationError {
    return super.create({
      value: expect.toBeOneOf([undefined, null, expect.anything()]),
      ...values,
    });
  }
}

export class NodeValidationSuccessExpect {
  success(nodeType: Constructor<TypeNodeBase>, values: Partial<INodeValidationSuccess> = {}): INodeValidationSuccess {
    return {
      success: true,
      previousMatches: [],
      context: {},
      node: expect.any(nodeType),
      ...values,
    };
  }

  arraySuccess(values: Partial<INodeValidationSuccess> = {}): INodeValidationSuccess {
    return this.success(ArrayNode, values);
  }

  mockSuccess(values: Partial<INodeValidationSuccess> = {}): INodeValidationSuccess {
    return this.success(MockNode, values);
  }
}

export const expectNodeValidationSuccess = new NodeValidationSuccessExpect();

export const mockValidate = jest.fn((): INodeValidationResult => {
  throw new Error('Should not have been called');
});

export const mockValidationNode = jest.fn().mockImplementation(() => {
  return { validate: mockValidate };
});

class MockNode extends LeafNode {
  reason = ValidationErrorType.NOT_A_BOOLEAN;
  kind = 'boolean' as const;
  validate(): INodeValidationResult {
    throw new Error('Method not implemented.');
  }
}

export class NodeResultFixture {
  static success(values: Partial<INodeValidationSuccess> = {}): INodeValidationSuccess {
    return {
      success: true,
      node: new MockNode(),
      context: {},
      previousMatches: [],
      ...values,
    };
  }

  static mockError(value: unknown): INodeValidationError {
    return {
      success: false,
      type: 'boolean',
      reason: 'NOT_A_BOOLEAN',
      value,
      previousErrors: [],
      context: {},
      annotations: {},
    };
  }
}
