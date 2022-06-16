/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { ValidationErrorType } from '../../nodes';
import { ValidatorInstance } from '../../validator';
import { expectValidationError, project } from '../utils';

describe('numbers', () => {
  it('should validate valid numbers', () => {
    const v = new ValidatorInstance({ project });

    @v.validatorDecorator()
    class Test {
      numberProperty!: number;
    }
    const result = v.validate(Test, { numberProperty: 123 });

    expect(result.success).toEqual(true);
  });

  describe('should fail for invalid numbers', () => {
    const v = new ValidatorInstance({ project });

    @v.validatorDecorator()
    class Test {
      numberProperty!: number;
    }
    const result = v.validate(Test, { numberProperty: '123' } as any);

    it('should not validate', () => {
      expect(result.success).toEqual(false);
    });

    it('should construct the correct error', () => {
      expectValidationError(result, (result) => {
        expect(result.rawErrors).toEqual({
          success: false,
          type: 'class',
          reason: ValidationErrorType.OBJECT_PROPERTY_FAILED,
          value: { numberProperty: '123' },
          context: { className: 'Test' },
          previousErrors: [
            {
              success: false,
              type: 'number',
              reason: ValidationErrorType.NOT_A_NUMBER,
              value: '123',
              context: {
                className: 'Test',
                propertyName: 'numberProperty',
              },
              previousErrors: [],
            },
          ],
        });
      });
    });
  });
});
