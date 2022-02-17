import { ValidatorInstance } from '../../validator';
import { project } from '../utils';

describe('booleans', () => {
  const v = new ValidatorInstance({ project });

  @v.validatorDecorator()
  class Test {
    booleanProperty!: boolean;
  }

  it('should validate valid boolean', () => {
    const result = v.validate(Test, { booleanProperty: true });

    expect(result.success).toEqual(true);
  });

  it('should fail for invalid booleans', () => {
    const result = v.validate(Test, { booleanProperty: 123 } as any);

    expect(result.success).toEqual(false);
    if (!result.success) {
      // Needed for type narrowing
      expect(result.errors.booleanProperty).toBeTruthy();
      expect(result.rawErrors).toEqual({
        booleanProperty: {
          success: false,
          type: 'boolean',
          value: 123,
          previousErrors: [],
          reason: 'NOT_A_BOOLEAN',
        },
      });
    }
  });
});
