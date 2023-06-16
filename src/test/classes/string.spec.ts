/* eslint-disable @typescript-eslint/no-shadow */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { formatErrors } from '../../error-formatter';
import { StringNode, ValidationErrorType } from '../../nodes';
import { ValidatorInstance } from '../../validator';
import { NodeValidationErrorMatcher, RootNodeFixture } from '../fixtures';
import { expectValidationError, project } from '../utils';

describe('strings - tree', () => {
  const v = new ValidatorInstance({ project });

  it(`should construct the correct tree`, () => {
    @v.transformerDecorator()
    class Test {
      stringProperty!: string;
    }

    const { tree } = v.getPropertyTypeTreesFromConstructor(Test)[0];

    expect(tree).toEqual(
      RootNodeFixture.createRequired({
        children: [new StringNode()],
      }),
    );
  });
});

describe('strings', () => {
  const v = new ValidatorInstance({ project });

  @v.transformerDecorator()
  class Test {
    stringProperty!: string;
  }

  it('should validate valid string', () => {
    const result = v.validate(Test, { stringProperty: 'This is a string.' });

    expect(result.success).toEqual(true);
  });

  it('should validate empty string', () => {
    const result = v.validate(Test, { stringProperty: '' });

    expect(result.success).toEqual(true);
  });

  describe('should fail for invalid strings', () => {
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

    it('should format the error correctly', () => {
      expectValidationError(result, (result) => {
        const errors = formatErrors(result.rawErrors);
        expect(errors).toEqual({
          ['$.stringProperty']: {
            message: "Value '123' (type: number) is not a valid string",
            code: ValidationErrorType.NOT_A_STRING,
            context: {},
          },
        });
      });
    });
  });

  describe('should fail for invalid strings (array)', () => {
    const result = v.validate(Test, { stringProperty: [123] } as any);

    it('should not validate', () => {
      expect(result.success).toEqual(false);
    });

    it('should construct the correct error', () => {
      expectValidationError(result, (result) => {
        expect(result.rawErrors).toEqual(
          NodeValidationErrorMatcher.singleObjectPropertyFailed(Test, 'stringProperty', {
            previousErrors: [
              NodeValidationErrorMatcher.stringError({
                value: [123],
              }),
            ],
          }),
        );
      });
    });

    it('should format the error correctly', () => {
      expectValidationError(result, (result) => {
        const errors = formatErrors(result.rawErrors);
        expect(errors).toEqual({
          ['$.stringProperty']: {
            message: "Value '[123]' (type: Array) is not a valid string",
            code: ValidationErrorType.NOT_A_STRING,
            context: {},
          },
        });
      });
    });
  });
});
