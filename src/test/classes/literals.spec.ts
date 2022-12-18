/* eslint-disable @typescript-eslint/no-shadow */
import { LiteralNode } from '../../nodes';
import { Constructor } from '../../types';
import { ValidatorInstance } from '../../validator';
import { NodeValidationErrorMatcher, RootNodeFixture } from '../fixtures';
import { expectValidationError, project } from '../utils';

interface ITests {
  property: string;
  validValue: unknown;
  invalidValue: unknown;
  cls: Constructor<unknown>;
}

describe('literals', () => {
  const v = new ValidatorInstance({ project });

  @v.validatorDecorator()
  class TestString {
    stringLiteralProperty!: 'foo';
  }

  @v.validatorDecorator()
  class TestNumber {
    numberLiteralProperty!: 9001;
  }

  @v.validatorDecorator()
  class TestBoolean {
    booleanLiteralProperty!: false;
  }

  const tests: ITests[] = [
    {
      property: 'string',
      validValue: 'foo',
      invalidValue: 'not_foo',
      cls: TestString,
    },
    {
      property: 'number',
      validValue: 9001,
      invalidValue: 9000,
      cls: TestNumber,
    },
    {
      property: 'boolean',
      validValue: false,
      invalidValue: true,
      cls: TestBoolean,
    },
  ];

  for (const testCase of tests) {
    describe(`${testCase.property} literal`, () => {
      const propertyName = `${testCase.property}LiteralProperty`;

      it('should construct the correct tree', () => {
        const { tree } = v.getPropertyTypeTreesFromConstructor(testCase.cls)[0];

        expect(tree).toEqual(
          RootNodeFixture.createRequired({
            children: [new LiteralNode(testCase.validValue)],
          }),
        );
      });

      it('should validate', () => {
        const result = v.validate(testCase.cls, { [propertyName]: testCase.validValue });

        expect(result.success).toEqual(true);
      });

      describe('should construct the correct error', () => {
        const result = v.validate(testCase.cls, { [propertyName]: testCase.invalidValue });

        it('should not validate', () => {
          expect(result.success).toEqual(false);
        });

        it('should construct the correct error', () => {
          expectValidationError(result, (result) => {
            expect(result.rawErrors).toEqual(
              NodeValidationErrorMatcher.singleObjectPropertyFailed(testCase.cls.name, propertyName, {
                previousErrors: [
                  NodeValidationErrorMatcher.literalError({
                    context: {
                      expected: testCase.validValue,
                      type: testCase.property,
                    },
                  }),
                ],
              }),
            );
          });
        });
      });
    });
  }
});
