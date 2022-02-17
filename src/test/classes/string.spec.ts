import { ValidatorInstance } from '../../validator';
import { project } from '../utils';

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

  it('should fail for invalid strings', () => {
    const v = new ValidatorInstance({ project });

    @v.validatorDecorator()
    class Test {
      stringProperty!: string;
    }
    const result = v.validate(Test, { stringProperty: 123 } as any);

    expect(result.success).toEqual(false);
    if (!result.success) {
      // Needed for type narrowing
      expect(result.errors.stringProperty).toBeTruthy();
      expect(result.rawErrors).toEqual({
        stringProperty: {
          success: false,
          type: 'string',
          value: 123,
          previousErrors: [],
          reason: 'NOT_A_STRING',
        },
      });
    }
  });
});
