import { ValidationErrorType } from '../../nodes';
import { ValidatorInstance } from '../../validator';
import { expectValidationError, project } from '../utils';

describe('arrays', () => {
  const v = new ValidatorInstance({ project });

  @v.validatorDecorator()
  class Test {
    arrayProperty!: number[];
  }

  it('should construct the correct tree', () => {
    const { tree } = v.getPropertyTypeTreesFromConstructor(Test)[0];

    expect(tree).toEqual({
      kind: 'root',
      optional: false,
      children: [
        {
          kind: 'array',
          children: [
            {
              kind: 'number',
              reason: expect.anything(),
              children: [],
            },
          ],
        },
      ],
    });
  });

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

    expectValidationError(result, (result) => {
      expect(result.rawErrors).toEqual({
        arrayProperty: {
          success: false,
          type: 'array',
          reason: ValidationErrorType.ELEMENT_TYPE_FAILED,
          value: [1, 'Two'],
          context: { element: 1 },
          previousErrors: [
            {
              success: false,
              type: 'number',
              reason: ValidationErrorType.NOT_A_NUMBER,
              value: 'Two',
              previousErrors: [],
            },
          ],
        },
      });
    });
  });

  it('should fail for invalid arrays', () => {
    const result = v.validate(Test, { arrayProperty: 123 } as any);

    expectValidationError(result, (result) => {
      expect(result.rawErrors).toEqual({
        arrayProperty: {
          success: false,
          type: 'array',
          value: 123,
          previousErrors: [],
          reason: ValidationErrorType.NOT_AN_ARRAY,
        },
      });
    });
  });
});
