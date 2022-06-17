/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { ValidationErrorType } from '../../nodes';
import { ValidatorInstance } from '../../validator';
import { expectValidationError, project } from '../utils';

describe('booleans', () => {
  const v = new ValidatorInstance({ project });

  @v.validatorDecorator()
  class Test {
    booleanProperty!: boolean;
  }

  it('should validate true', () => {
    const result = v.validate(Test, { booleanProperty: true });

    expect(result.success).toEqual(true);
  });

  it('should validate false', () => {
    const result = v.validate(Test, { booleanProperty: false });

    expect(result.success).toEqual(true);
  });

  describe('should fail for invalid booleans', () => {
    const result = v.validate(Test, { booleanProperty: 123 } as any);

    it('should not validate', () => {
      expect(result.success).toEqual(false);
    });

    it('should construct the correct error', () => {
      expectValidationError(result, (result) => {
        expect(result.rawErrors).toEqual({
          success: false,
          type: 'class',
          reason: ValidationErrorType.OBJECT_PROPERTY_FAILED,
          value: { booleanProperty: 123 },
          previousErrors: [
            {
              success: false,
              type: 'boolean',
              value: 123,
              reason: ValidationErrorType.NOT_A_BOOLEAN,
              previousErrors: [],
              context: {
                className: 'Test',
                propertyName: 'booleanProperty',
              },
            },
          ],
          context: { className: 'Test' },
        });
      });
    });
  });
});
