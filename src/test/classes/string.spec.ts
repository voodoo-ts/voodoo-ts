/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { StringNode, ValidationErrorType } from '../../nodes';
import { ValidatorInstance } from '../../validator';
import { NodeValidationErrorMatcher, RootNodeFixture } from '../fixtures';
import { expectValidationError, iterParsers, project } from '../utils';

describe('strings - tree', () => {
  for (const [parserName, v, decorator] of iterParsers()) {
    it(`should construct the correct tree (${parserName})`, () => {
      @decorator()
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
  }
});

describe('strings', () => {
  const v = new ValidatorInstance({ project });

  @v.validatorDecorator()
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
        // expect(result.rawErrors).toEqual({
        //   success: false,
        //   type: 'class',
        //   reason: ValidationErrorType.OBJECT_PROPERTY_FAILED,
        //   value: { stringProperty: 123 },
        //   context: { className: 'Test' },
        //   previousErrors: [
        //     {
        //       success: false,
        //       type: 'string',
        //       reason: ValidationErrorType.NOT_A_STRING,
        //       value: 123,
        //       previousErrors: [],
        //       context: {
        //         className: 'Test',
        //         propertyName: 'stringProperty',
        //       },
        //     },
        //   ],
        // });
      });
    });
  });
});
