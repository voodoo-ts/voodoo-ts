/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { ValidationErrorType } from '../../nodes';
import { ValidatorInstance } from '../../validator';
import { expectValidationError, project } from '../utils';

describe('strings', () => {
  it('should validate valid string', () => {
    const v = new ValidatorInstance({ project });

    @v.validatorDecorator()
    class Test {
      stringProperty!: string;
    }
    const result = v.validate(Test, { stringProperty: 'This is a string.' });

    expect(result.success).toEqual(true);
  });

  it('should validate empty string', () => {
    const v = new ValidatorInstance({ project });

    @v.validatorDecorator()
    class Test {
      stringProperty!: string;
    }
    const result = v.validate(Test, { stringProperty: '' });

    expect(result.success).toEqual(true);
  });

  describe('should fail for invalid strings', () => {
    const v = new ValidatorInstance({ project });

    @v.validatorDecorator()
    class Test {
      stringProperty!: string;
    }
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
              previousErrors: [],
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
