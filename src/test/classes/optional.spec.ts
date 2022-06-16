/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { TypeNodeData, ValidationErrorType } from '../../nodes';
import { ValidatorInstance } from '../../validator';
import { expectValidationError, project } from '../utils';

describe('optional', () => {
  const v = new ValidatorInstance({ project });

  @v.validatorDecorator()
  class Test {
    stringProperty?: string;
  }

  it('should construct the correct tree', () => {
    const { tree } = v.getPropertyTypeTreesFromConstructor(Test)[0];

    expect(tree).toEqual({
      kind: 'root',
      children: [
        {
          kind: 'string',
          children: [],
          annotations: {},
          reason: expect.anything(),
        },
      ],
      annotations: {},
      optional: true,
    } as TypeNodeData);
  });

  it('should validate optional string with valid string', () => {
    const result = v.validate(Test, { stringProperty: 'This is a string.' });

    expect(result.success).toEqual(true);
  });

  it('should not fail optional string if undefined', () => {
    const result = v.validate(Test, {} as any);
    expect(result.success).toEqual(true);
  });

  describe('should fail optional string for invalid strings', () => {
    const result = v.validate(Test, { stringProperty: 123 } as any);

    it('should not validate', () => {
      expect(result.success).toEqual(false);
    });

    it('should construct the correct error', () => {
      expectValidationError(result, (result) => {
        expect(result.rawErrors).toEqual({
          success: false,
          type: 'class',
          reason: ValidationErrorType.OBJECT_PROPERTY_FAILED,
          value: { stringProperty: 123 },
          context: { className: 'Test' },
          previousErrors: [
            {
              success: false,
              type: 'string',
              reason: ValidationErrorType.NOT_A_STRING,
              value: 123,
              context: { className: 'Test', propertyName: 'stringProperty' },
              previousErrors: [],
            },
          ],
        });
      });
    });
  });

  describe('should fail optional string for null', () => {
    const result = v.validate(Test, { stringProperty: null } as any);

    it('should not validate', () => {
      expect(result.success).toEqual(false);
    });

    it('should construct the correct error', () => {
      expectValidationError(result, (result) => {
        expect(result.rawErrors).toEqual({
          success: false,
          type: 'class',
          reason: ValidationErrorType.OBJECT_PROPERTY_FAILED,
          value: { stringProperty: null },
          context: { className: 'Test' },
          previousErrors: [
            {
              success: false,
              type: 'string',
              value: null,
              previousErrors: [],
              reason: ValidationErrorType.NOT_A_STRING,
              context: {
                className: 'Test',
                propertyName: 'stringProperty',
              },
            },
          ],
        });
      });
    });
  });
});
