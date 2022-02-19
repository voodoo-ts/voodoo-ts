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

  it('should fail for invalid numbers', () => {
    const v = new ValidatorInstance({ project });

    @v.validatorDecorator()
    class Test {
      numberProperty!: number;
    }
    const result = v.validate(Test, { numberProperty: '123' } as any);

    expectValidationError(result, (result) => {
      expect(result.rawErrors).toEqual({
        numberProperty: {
          success: false,
          type: 'number',
          reason: ValidationErrorType.NOT_A_NUMBER,
          value: '123',
          previousErrors: [],
        },
      });
    });
  });
});
