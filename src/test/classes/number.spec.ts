/* eslint-disable @typescript-eslint/no-shadow */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { NumberNode } from '../../nodes';
import { ValidatorInstance } from '../../validator';
import { NodeValidationErrorMatcher, RootNodeFixture } from '../fixtures';
import { expectValidationError, project } from '../utils';

describe('numbers', () => {
  it('should validate valid numbers', () => {
    const v = new ValidatorInstance({ project });

    @v.transformerDecorator()
    class Test {
      numberProperty!: number;
    }
    const result = v.validate(Test, { numberProperty: 123 });

    expect(result.success).toEqual(true);
  });

  describe('should fail for invalid numbers', () => {
    const v = new ValidatorInstance({ project });

    @v.transformerDecorator()
    class Test {
      numberProperty!: number;
    }
    const result = v.validate(Test, { numberProperty: '123' } as any);

    it('should construct the correct tree', () => {
      const { tree } = v.getPropertyTypeTreesFromConstructor(Test)[0];

      expect(tree).toEqual(
        RootNodeFixture.createRequired({
          children: [new NumberNode()],
        }),
      );
    });

    it('should not validate a boolean', () => {
      expect(result.success).toEqual(false);
    });

    it('should construct the correct error', () => {
      expectValidationError(result, (result) => {
        expect(result.rawErrors).toEqual(
          NodeValidationErrorMatcher.singleObjectPropertyFailed(Test, 'numberProperty', {
            previousErrors: [NodeValidationErrorMatcher.numberError()],
          }),
        );
      });
    });
  });
});
