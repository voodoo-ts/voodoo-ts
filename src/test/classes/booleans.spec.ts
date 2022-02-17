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

  it('should fail for invalid booleans', () => {
    const result = v.validate(Test, { booleanProperty: 123 } as any);

    expectValidationError(result, (result) => {
      expect(result.rawErrors).toEqual({
        booleanProperty: {
          success: false,
          type: 'boolean',
          value: 123,
          previousErrors: [],
          reason: 'NOT_A_BOOLEAN',
        },
      });
    });
  });
});
