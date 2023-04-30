/* eslint-disable @typescript-eslint/no-shadow */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { StringNode } from '../../nodes';
import { ValidatorInstance } from '../../validator';
import { NodeValidationErrorMatcher, RootNodeFixture } from '../fixtures';
import { expectValidationError, project } from '../utils';

describe('optional', () => {
  const v = new ValidatorInstance({ project });

  @v.transformerDecorator()
  class Test {
    stringProperty?: string;
  }

  it('should construct the correct tree', () => {
    const { tree } = v.getPropertyTypeTreesFromConstructor(Test)[0];

    expect(tree).toEqual(
      RootNodeFixture.createOptional({
        children: [new StringNode()],
      }),
    );
  });

  it('should validate optional string with valid string', () => {
    const result = v.validate(Test, { stringProperty: 'This is a string.' });

    expect(result.success).toEqual(true);
  });

  it('should not fail optional string if undefined', () => {
    const result = v.validate(Test, {} as any);
    expect(result.success).toEqual(true);
  });

  describe('should fail optional string for invalid strings', () => {
    const result = v.validate(Test, { stringProperty: 123 } as any);

    it('should not validate', () => {
      expect(result.success).toEqual(false);
    });

    it('should construct the correct error', () => {
      expectValidationError(result, (result) => {
        expect(result.rawErrors).toEqual(
          NodeValidationErrorMatcher.singleObjectPropertyFailed(Test, 'stringProperty', {
            previousErrors: [NodeValidationErrorMatcher.stringError()],
          }),
        );
      });
    });
  });

  describe('should fail optional string for null', () => {
    const result = v.validate(Test, { stringProperty: null } as any);

    it('should not validate', () => {
      expect(result.success).toEqual(false);
    });

    it('should construct the correct error', () => {
      expectValidationError(result, (result) => {
        expect(result.rawErrors).toEqual(
          NodeValidationErrorMatcher.objectPropertyFailedForClass(Test, 'stringProperty', {
            previousErrors: [NodeValidationErrorMatcher.stringError()],
          }),
        );
      });
    });
  });
});
