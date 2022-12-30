/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { NumberNode, TypeNodeData, ValidationErrorType } from '../../nodes';
import { ValidatorInstance } from '../../validator';
import { ArrayNodeFixture, NodeValidationErrorMatcher, NumberNodeFixture, RootNodeFixture } from '../fixtures';
import { expectValidationError, project } from '../utils';

describe('arrays', () => {
  const v = new ValidatorInstance({ project });

  @v.validatorDecorator()
  class Test {
    arrayProperty!: number[];
  }

  it('should construct the correct tree', () => {
    const { tree } = v.getPropertyTypeTreesFromConstructor(Test)[0];

    expect(tree).toEqual(
      RootNodeFixture.createRequired({
        children: [
          ArrayNodeFixture.create({
            children: [NumberNodeFixture.create()],
          }),
        ],
      }),
    );
  });

  it('should validate valid number arrays', () => {
    const result = v.validate(Test, { arrayProperty: [1, 2, 3] });

    expect(result.success).toEqual(true);
  });

  it('should validate empty number arrays', () => {
    const result = v.validate(Test, { arrayProperty: [] });

    expect(result.success).toEqual(true);
  });

  describe('should fail for invalid array elements', () => {
    const result = v.validate(Test, { arrayProperty: [1, 'Two'] } as any);

    it('should not validate', () => {
      expect(result.success).toEqual(false);
    });

    it('should construct the correct error', () => {
      expectValidationError(result, (result) => {
        expect(result.rawErrors).toEqual(
          NodeValidationErrorMatcher.singleObjectPropertyFailed(Test, 'arrayProperty', {
            previousErrors: [
              NodeValidationErrorMatcher.arrayError({
                previousErrors: [
                  NodeValidationErrorMatcher.arrayItemError({
                    context: { element: 1 },
                    previousErrors: [NodeValidationErrorMatcher.numberError()],
                  }),
                ],
              }),
            ],
          }),
        );
      });
    });
  });

  describe('should fail for invalid arrays', () => {
    const result = v.validate(Test, { arrayProperty: 123 } as any);

    it('should not validate', () => {
      expect(result.success).toEqual(false);
    });

    it('should construct the correct error', () => {
      expectValidationError(result, (result) => {
        expect(result.rawErrors).toEqual(
          NodeValidationErrorMatcher.singleObjectPropertyFailed(Test, 'arrayProperty', {
            previousErrors: [
              NodeValidationErrorMatcher.arrayError({
                reason: ValidationErrorType.NOT_AN_ARRAY,
              }),
            ],
          }),
        );
      });
    });
  });
});
