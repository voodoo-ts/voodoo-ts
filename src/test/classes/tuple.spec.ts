import { ValidatorInstance } from '../../validator';
import { expectValidationError, project } from '../utils';

describe('tuple', () => {
  const v = new ValidatorInstance({ project });

  @v.validatorDecorator()
  class Test {
    tupleProperty!: [number, string, boolean];
  }

  it('should construct the correct tree', () => {
    const { tree } = v.getPropertyTypeTreesFromConstructor(Test)[0];

    expect(tree).toEqual({
      kind: 'root',
      children: [
        {
          kind: 'tuple',
          children: [
            { kind: 'number', reason: 'NOT_A_NUMBER', children: [] },
            { kind: 'string', reason: 'NOT_A_STRING', children: [] },
            { kind: 'boolean', reason: 'NOT_A_BOOLEAN', children: [] },
          ],
        },
      ],
      optional: false,
    });
  });

  it('should validate valid tuples', () => {
    const result = v.validate(Test, { tupleProperty: [1, 'two', false] });

    expect(result.success).toEqual(true);
  });

  it('should not validate empty tuples', () => {
    const result = v.validate(Test, { tupleProperty: [] as any });

    expectValidationError(result, (result) => {
      expect(result.rawErrors).toEqual({
        tupleProperty: {
          success: false,
          type: 'tuple',
          reason: 'NO_LENGTH_MATCH',
          value: [],
          previousErrors: [],
        },
      });
    });
  });

  it('should fail for invalid tuple elements', () => {
    const result = v.validate(Test, { tupleProperty: [1, 'two', 'three'] } as any);

    expectValidationError(result, (result) => {
      expect(result.rawErrors).toEqual({
        tupleProperty: {
          success: false,
          type: 'tuple',
          value: [1, 'two', 'three'],
          previousErrors: [
            {
              success: false,
              type: 'boolean',
              reason: 'NOT_A_BOOLEAN',
              value: 'three',
              previousErrors: [],
            },
          ],
          reason: 'ELEMENT_TYPE_FAILED',
          context: { element: 2 },
        },
      });
    });
  });

  it('should fail for invalid types', () => {
    const result = v.validate(Test, { tupleProperty: 123 } as any);

    expectValidationError(result, (result) => {
      expect(result.rawErrors).toEqual({
        tupleProperty: {
          success: false,
          type: 'tuple',
          reason: 'NOT_AN_ARRAY',
          value: 123,
          previousErrors: [],
        },
      });
    });
  });

  it('should fail if property is undefined', () => {
    const result = v.validate(Test, {} as any);

    expectValidationError(result, (result) => {
      expect(result.rawErrors).toEqual({
        tupleProperty: {
          success: false,
          type: 'root',
          reason: 'VALUE_REQUIRED',
          previousErrors: [],
        },
      });
    });
  });
});