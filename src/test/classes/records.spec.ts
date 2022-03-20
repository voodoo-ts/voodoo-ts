import { TypeNodeData, ValidationErrorType } from '../../nodes';
import { ValidatorInstance } from '../../validator';
import { expectValidationError, project } from '../utils';

describe('records', () => {
  const v = new ValidatorInstance({ project });

  @v.validatorDecorator()
  class Test {
    recordProperty!: Record<string, number>;
  }

  it('should construct the correct tree', () => {
    const { tree } = v.getPropertyTypeTreesFromConstructor(Test)[0];

    expect(tree).toEqual({
      kind: 'root',
      optional: false,
      children: [
        {
          kind: 'record',
          children: [
            { kind: 'string', reason: expect.anything(), children: [], annotations: {} },
            { kind: 'number', reason: expect.anything(), children: [], annotations: {} },
          ],
          annotations: {},
        },
      ],
      annotations: {},
    } as TypeNodeData);
  });

  it('should validate a record', () => {
    const result = v.validate(Test, { recordProperty: { one: 1, two: 2 } });

    expect(result.success).toEqual(true);
  });

  it('should validate an empty record', () => {
    const result = v.validate(Test, { recordProperty: {} });

    expect(result.success).toEqual(true);
  });

  describe('should not validate an invalid type', () => {
    const result = v.validate(Test, { recordProperty: false as any });

    it('should not validate', () => {
      expect(result.success).toEqual(false);
    });

    it('should construct the correct error', () => {
      expectValidationError(result, (result) => {
        expect(result.rawErrors).toEqual({
          success: false,
          type: 'class',
          reason: ValidationErrorType.OBJECT_PROPERTY_FAILED,
          value: { recordProperty: false },
          context: { className: 'Test' },
          previousErrors: [
            {
              success: false,
              type: 'record',
              reason: ValidationErrorType.NOT_AN_OBJECT,
              value: false,
              previousErrors: [],
              context: {
                className: 'Test',
                propertyName: 'recordProperty',
              },
            },
          ],
        });
      });
    });
  });

  describe('should not validate record with invalid value type', () => {
    const result = v.validate(Test, { recordProperty: { one: 'one', two: 2 } as any });

    it('should not validate', () => {
      expect(result.success).toEqual(false);
    });

    it('should construct the correct error', () => {
      expectValidationError(result, (result) => {
        expect(result.rawErrors).toEqual({
          success: false,
          type: 'class',
          reason: ValidationErrorType.OBJECT_PROPERTY_FAILED,
          value: { recordProperty: { one: 'one', two: 2 } },
          context: { className: 'Test' },
          previousErrors: [
            {
              success: false,
              type: 'record',
              value: { one: 'one', two: 2 },
              previousErrors: [
                {
                  success: false,
                  type: 'number',
                  reason: ValidationErrorType.NOT_A_NUMBER,
                  value: 'one',
                  previousErrors: [],
                },
              ],
              context: {
                className: 'Test',
                propertyName: 'recordProperty',
                valueInvalid: true,
                key: 'one',
              },
            },
          ],
        });
      });
    });
  });
});
