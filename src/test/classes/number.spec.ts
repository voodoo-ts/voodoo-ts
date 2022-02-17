import { ValidatorInstance } from '../../validator';
import { project } from '../utils';

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

    expect(result.success).toEqual(false);
    if (!result.success) {
      // Needed for type narrowing
      expect(result.errors.numberProperty).toBeTruthy();
    }
  });
});
