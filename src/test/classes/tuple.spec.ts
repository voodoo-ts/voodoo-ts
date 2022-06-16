/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { TypeNodeData, ValidationErrorType } from '../../nodes';
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
            { kind: 'number', reason: expect.anything(), children: [], annotations: {} },
            { kind: 'string', reason: expect.anything(), children: [], annotations: {} },
            { kind: 'boolean', reason: expect.anything(), children: [], annotations: {} },
          ],
          annotations: {},
        },
      ],
      annotations: {},
      optional: false,
    } as TypeNodeData);
  });

  it('should validate valid tuples', () => {
    const result = v.validate(Test, { tupleProperty: [1, 'two', false] });

    expect(result.success).toEqual(true);
  });

  describe('should not validate empty tuples', () => {
    const result = v.validate(Test, { tupleProperty: [] as any });

    it('should not validate', () => {
      expect(result.success).toEqual(false);
    });
    it('should construct the correct error', () => {
      expectValidationError(result, (result) => {
        expect(result.rawErrors).toEqual({
          success: false,
          type: 'class',
          reason: ValidationErrorType.OBJECT_PROPERTY_FAILED,
          value: { tupleProperty: [] },
          context: { className: 'Test' },
          previousErrors: [
            {
              success: false,
              type: 'tuple',
              value: [],
              previousErrors: [],
              reason: ValidationErrorType.NO_LENGTH_MATCH,
              context: {
                className: 'Test',
                propertyName: 'tupleProperty',
              },
            },
          ],
        });
      });
    });
  });

  describe('should fail for invalid tuple elements', () => {
    const result = v.validate(Test, { tupleProperty: [1, 'two', 'three'] } as any);

    it('should not validate', () => {
      expect(result.success).toEqual(false);
    });
    it('should construct the correct error', () => {
      expectValidationError(result, (result) => {
        expect(result.rawErrors).toEqual({
          success: false,
          type: 'class',
          reason: ValidationErrorType.OBJECT_PROPERTY_FAILED,
          value: { tupleProperty: [1, 'two', 'three'] },
          context: { className: 'Test' },
          previousErrors: [
            {
              success: false,
              type: 'tuple',
              reason: ValidationErrorType.ELEMENT_TYPE_FAILED,
              value: [1, 'two', 'three'],
              context: {
                className: 'Test',
                propertyName: 'tupleProperty',
                element: 2,
              },
              previousErrors: [
                {
                  success: false,
                  type: 'boolean',
                  reason: 'NOT_A_BOOLEAN',
                  value: 'three',
                  previousErrors: [],
                },
              ],
            },
          ],
        });
      });
    });
  });

  describe('should fail for invalid types', () => {
    const result = v.validate(Test, { tupleProperty: 123 } as any);

    it('should not validate', () => {
      expect(result.success).toEqual(false);
    });
    it('should construct the correct error', () => {
      expectValidationError(result, (result) => {
        expect(result.rawErrors).toEqual({
          success: false,
          type: 'class',
          reason: ValidationErrorType.OBJECT_PROPERTY_FAILED,
          value: { tupleProperty: 123 },
          context: { className: 'Test' },
          previousErrors: [
            {
              success: false,
              type: 'tuple',
              reason: ValidationErrorType.NOT_AN_ARRAY,
              value: 123,
              previousErrors: [],
              context: { className: 'Test', propertyName: 'tupleProperty' },
            },
          ],
        });
      });
    });
  });

  describe('should fail if property is undefined', () => {
    const result = v.validate(Test, {} as any);

    it('should not validate', () => {
      expect(result.success).toEqual(false);
    });
    it('should construct the correct error', () => {
      expectValidationError(result, (result) => {
        expect(result.rawErrors).toEqual({
          success: false,
          type: 'class',
          reason: ValidationErrorType.OBJECT_PROPERTY_FAILED,
          value: {},
          context: { className: 'Test' },
          previousErrors: [
            {
              success: false,
              type: 'root',
              reason: ValidationErrorType.VALUE_REQUIRED,
              previousErrors: [],
              context: { className: 'Test', propertyName: 'tupleProperty' },
            },
          ],
        });
      });
    });
  });
});
