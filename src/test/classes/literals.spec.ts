import { ValidationErrorType } from '../../nodes';
import { Constructor } from '../../types';
import { ValidatorInstance } from '../../validator';
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
    // nullLiteralProperty!: null;
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

        expect(tree).toEqual({
          kind: 'root',
          optional: false,
          children: [
            {
              kind: 'literal',
              reason: ValidationErrorType.LITERAL_NOT_MATCHING,
              expected: testCase.validValue,
              children: [],
              annotations: {},
            },
          ],
          annotations: {},
        });
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
            expect(result.rawErrors).toEqual({
              success: false,
              type: 'class',
              reason: 'OBJECT_PROPERTY_FAILED',
              value: { [propertyName]: testCase.invalidValue },
              context: { className: testCase.cls.name },
              previousErrors: [
                {
                  success: false,
                  type: 'literal',
                  reason: 'LITERAL_NOT_MATCHING',
                  value: testCase.invalidValue,
                  previousErrors: [],
                  context: {
                    type: testCase.property,
                    expected: testCase.validValue,
                    className: testCase.cls.name,
                    propertyName,
                  },
                },
              ],
            });
          });
        });
      });
    });
  }
  // describe('simple -> (string | number)', () => {
  //   it('should construct the correct tree', () => {
  //     const { tree } = v.getPropertyTypeTreesFromConstructor(Test)[0];
  //     console.log(tree);
  //     expect(tree).toEqual({
  //       kind: 'root',
  //       optional: false,
  //       children: [
  //         {
  //           kind: 'literal',
  //           reason: ValidationErrorType.LITERAL_NOT_MATCHING,
  //           expected: 'foo',
  //           children: [],
  //           annotations: {},
  //         },
  //       ],
  //       annotations: {},
  //     });
  //   });

  //   it('should validate', () => {
  //     const result = v.validate(Test, { stringLiteralProperty: 'foo' });

  //     expect(result.success).toEqual(true);
  //   });

  //   describe('should construct the correct error', () => {
  //     const result = v.validate(Test, { stringLiteralProperty: 'not_foo' } as any);

  //     it('should not validate', () => {
  //       expect(result.success).toEqual(false);
  //     });

  //     it('should construct the correct error', () => {
  //       expectValidationError(result, (result) => {
  //         expect(result.rawErrors).toEqual({
  //           success: false,
  //           type: 'class',
  //           reason: 'OBJECT_PROPERTY_FAILED',
  //           value: { stringLiteralProperty: 'not_foo' },
  //           context: { className: 'Test' },
  //           previousErrors: [
  //             {
  //               success: false,
  //               type: 'literal',
  //               reason: 'LITERAL_NOT_MATCHING',
  //               value: 'not_foo',
  //               previousErrors: [],
  //               context: {
  //                 type: 'string',
  //                 expected: 'foo',
  //                 className: 'Test',
  //                 propertyName: 'stringLiteralProperty',
  //               },
  //             },
  //           ],
  //         });
  //       });
  //     });
  //   });
  // });
});
