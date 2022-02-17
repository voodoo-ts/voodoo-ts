import { ValidatorInstance } from '../../validator';
import { project } from '../utils';

describe('enums', () => {
  const v = new ValidatorInstance({ project });

  enum TestEnum {
    YES = 'yes',
    NO = 'no',
  }
  @v.validatorDecorator()
  class Test {
    enumProperty!: TestEnum;
  }

  it('should validate valid enum', () => {
    const result = v.validate(Test, { enumProperty: TestEnum.YES });

    expect(result.success).toEqual(true);
  });

  it('should format invalid enum errors correctly', () => {
    const result = v.validate(Test, { enumProperty: 123 } as any);

    expect(result.success).toEqual(false);
    if (!result.success) {
      // Needed for type narrowing
      expect(result.errors.enumProperty).toBeTruthy();
      expect(result.rawErrors).toEqual({
        enumProperty: {
          success: false,
          type: 'enum',
          value: 123,
          reason: 'NOT_AN_ENUM',
          context: { name: 'TestEnum', allowedValues: ['yes', 'no'] },
          previousErrors: [],
        },
      });
    }
  });
});
