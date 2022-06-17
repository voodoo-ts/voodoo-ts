/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { TypeNodeData, ValidationErrorType } from '../../nodes';
import { ValidatorInstance } from '../../validator';
import { expectValidationError, project } from '../utils';

describe('arrays', () => {
  const v = new ValidatorInstance({ project });

  @v.validatorDecorator()
  class Test {
    arrayProperty!: number[];
  }

  it('should construct the correct tree', () => {
    const { tree } = v.getPropertyTypeTreesFromConstructor(Test)[0];

    expect(tree).toEqual({
      kind: 'root',
      optional: false,
      children: [
        {
          kind: 'array',
          children: [
            {
              kind: 'number',
              reason: expect.anything(),
              children: [],
              annotations: {},
            },
          ],
          annotations: {},
        },
      ],
      annotations: {},
    } as TypeNodeData);
  });

  it('should validate valid number arrays', () => {
    const result = v.validate(Test, { arrayProperty: [1, 2, 3] });

    expect(result.success).toEqual(true);
  });

  it('should validate empty number arrays', () => {
    const result = v.validate(Test, { arrayProperty: [] });

    expect(result.success).toEqual(true);
  });

  describe('should fail for invalid array elements', () => {
    const result = v.validate(Test, { arrayProperty: [1, 'Two'] } as any);

    it('should not validate', () => {
      expect(result.success).toEqual(false);
    });

    it('should construct the correct error', () => {
      expectValidationError(result, (result) => {
        expect(result.rawErrors).toEqual({
          success: false,
          type: 'class',
          reason: ValidationErrorType.OBJECT_PROPERTY_FAILED,
          value: { arrayProperty: [1, 'Two'] },
          previousErrors: [
            {
              success: false,
              type: 'array',
              reason: ValidationErrorType.ELEMENT_TYPE_FAILED,
              value: [1, 'Two'],
              previousErrors: [
                {
                  success: false,
                  type: 'number',
                  reason: ValidationErrorType.NOT_A_NUMBER,
                  value: 'Two',
                  previousErrors: [],
                },
              ],
              context: {
                element: 1,
                className: 'Test',
                propertyName: 'arrayProperty',
              },
            },
          ],
          context: {
            className: 'Test',
          },
        });
      });
    });
  });

  describe('should fail for invalid arrays', () => {
    const result = v.validate(Test, { arrayProperty: 123 } as any);

    it('should not validate', () => {
      expect(result.success).toEqual(false);
    });

    it('should construct the correct error', () => {
      expectValidationError(result, (result) => {
        expect(result.rawErrors).toEqual({
          success: false,
          type: 'class',
          reason: ValidationErrorType.OBJECT_PROPERTY_FAILED,
          value: { arrayProperty: 123 },
          previousErrors: [
            {
              success: false,
              type: 'array',
              reason: ValidationErrorType.NOT_AN_ARRAY,
              value: 123,
              previousErrors: [],
              context: {
                className: 'Test',
                propertyName: 'arrayProperty',
              },
            },
          ],
          context: { className: 'Test' },
        });
      });
    });
  });
});
