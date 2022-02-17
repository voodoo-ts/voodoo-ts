import { ValidatorInstance } from '../../validator';
import { project } from '../utils';

describe('arrays', () => {
  const v = new ValidatorInstance({ project });

  @v.validatorDecorator()
  class Test {
    arrayProperty!: number[];
  }

  it('should validate valid number arrays', () => {
    const result = v.validate(Test, { arrayProperty: [1, 2, 3] });

    expect(result.success).toEqual(true);
  });

  it('should validate empty number arrays', () => {
    const result = v.validate(Test, { arrayProperty: [] });

    expect(result.success).toEqual(true);
  });

  it('should fail for invalid array elements', () => {
    const result = v.validate(Test, { arrayProperty: [1, 'Two'] } as any);

    expect(result.success).toEqual(false);
    if (!result.success) {
      // Needed for type narrowing
      expect(result.errors.arrayProperty).toBeTruthy();
      expect(result.rawErrors).toEqual({
        arrayProperty: {
          success: false,
          type: 'array',
          reason: 'ELEMENT_TYPE_FAILED',
          value: [1, 'Two'],
          context: { element: 1 },
          previousErrors: [
            {
              success: false,
              type: 'number',
              reason: 'NOT_A_NUMBER',
              value: 'Two',
              previousErrors: [],
            },
          ],
        },
      });
    }
  });

  it('should fail for invalid arrays', () => {
    const result = v.validate(Test, { arrayProperty: 123 } as any);

    expect(result.success).toEqual(false);
    if (!result.success) {
      // Needed for type narrowing
      expect(result.errors.arrayProperty).toBeTruthy();
      expect(result.rawErrors).toEqual({
        arrayProperty: {
          success: false,
          type: 'array',
          value: 123,
          previousErrors: [],
          reason: 'NOT_AN_ARRAY',
        },
      });
    }
  });
});
