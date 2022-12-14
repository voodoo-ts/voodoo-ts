/* eslint-disable @typescript-eslint/no-explicit-any */
import { TypeNodeData, ValidationErrorType } from '../../nodes';
import { ValidatorInstance } from '../../validator';
import { ClassNodeFixture, IntersectionNodeFixture, NodeValidationErrorMatcher, RootNodeFixture } from '../fixtures';
import { expectValidationError, genValidationErrorTest, formatNodeValidationError, project } from '../utils';

describe('intersection', () => {
  const v = new ValidatorInstance({ project });

  @v.validatorDecorator()
  class Test {
    property!: { foo: number } & { bar: string } & Generic<number>; // & Pick<Generic<string>, 'property'>;
    // prop!: (Test & { addedProperty: boolean })[];
  }

  @v.validatorDecorator()
  class Generic<T> {
    property!: T;
    anotherProperty!: number;
  }

  it('should construct the correct tree', () => {
    const { tree } = v.getPropertyTypeTreesFromConstructor(Test)[0];
    console.log(tree.children[0].children);
    expect(tree).toEqual(
      RootNodeFixture.createRequired({
        children: [
          IntersectionNodeFixture.create('{ foo: number; } & { bar: string; } & Generic<number>', [], {
            meta: { references: expect.anything() },
            children: [
              ClassNodeFixture.createForLiteral(),
              ClassNodeFixture.createForLiteral(),
              ClassNodeFixture.create('Generic', { from: 'class' }),
            ],
          }),
        ],
      }),
    );
    // expect(tree).toEqual({
    //   kind: 'root',
    //   optional: false,
    //   children: [
    //     IntersectionNodeFixture.create('{ foo: number; } & { bar: string; } & Generic<number>', [], {
    //       meta: { references: expect.anything() },
    //       children: [
    //         ClassNodeFixture.createForLiteral(),
    //         ClassNodeFixture.createForLiteral(),
    //         ClassNodeFixture.create('Generic', { from: 'class' }),
    //       ],
    //     }),
    //   ],
    //   annotations: {},
    // } as TypeNodeData);
  });

  it('should validate', () => {
    const result = v.validate(Test, {
      property: { foo: 123, bar: 'bar', property: 123, anotherProperty: 234 },
    });

    expect(result.success).toEqual(true);
  });

  describe('should not validate', () => {
    const result = v.validate(Test, {
      property: { foo: 123, bar: 'bar', property: 'invalid', anotherProperty: 234 } as any,
    });

    it('should not validate with a property of the wrong type', () => {
      expect(result.success).toEqual(false);
    });

    it('should construct the correct error', () => {
      expectValidationError(result, (result) => {
        expect(result.rawErrors).toEqual(
          NodeValidationErrorMatcher.singleObjectPropertyFailed(Test, 'property', {
            previousErrors: [
              NodeValidationErrorMatcher.intersectionPropertyFailed({
                context: { className: expect.any(String) },
                previousErrors: [
                  NodeValidationErrorMatcher.singleObjectPropertyFailed(Generic, 'property', {
                    previousErrors: [NodeValidationErrorMatcher.numberError()],
                  }),
                ],
              }),
            ],
          }),
        );

        // expect(result.rawErrors).toEqual({
        //   success: false,
        //   type: 'class',
        //   reason: ValidationErrorType.OBJECT_PROPERTY_FAILED,
        //   context: { className: 'Test' },
        //   value: { property: { foo: 123, bar: 'bar', property: 'invalid' } },
        //   previousErrors: [
        //     {
        //       success: false,
        //       type: 'intersection',
        //       reason: ValidationErrorType.OBJECT_PROPERTY_FAILED,
        //       context: { className: 'Test', propertyName: 'property' },
        //       value: { foo: 123, bar: 'bar', property: 'invalid' },
        //       previousErrors: [
        //         {
        //           success: false,
        //           type: 'class',
        //           reason: ValidationErrorType.OBJECT_PROPERTY_FAILED,
        //           context: { className: 'Generic' },
        //           value: { foo: 123, bar: 'bar', property: 'invalid' },
        //           previousErrors: [
        //             {
        //               success: false,
        //               type: 'number',
        //               value: 'invalid',
        //               previousErrors: [],
        //               reason: ValidationErrorType.NOT_A_NUMBER,
        //               context: { className: 'Generic', propertyName: 'property' },
        //             },
        //           ],
        //         },
        //       ],
        //     },
        //   ],
        // });
      });
    });
  });

  describe('should not validate with unknown properties', () => {
    const result = v.validate(Test, {
      property: { foo: 123, bar: 'bar', property: 123, anotherProperty: 234, unknownProperty: 'UNKNOWN' } as any,
    });

    it('should not validate', () => {
      expect(result.success).toEqual(false);
    });
    it('should construct the correct error', () => {
      expectValidationError(result, (result) => {
        expect(result.rawErrors).toEqual(
          NodeValidationErrorMatcher.singleObjectPropertyFailed(Test, 'property', {
            previousErrors: [
              NodeValidationErrorMatcher.intersectionPropertyFailed({
                context: { className: expect.any(String) },
                previousErrors: [
                  NodeValidationErrorMatcher.intersectionPropertyFailed({
                    reason: ValidationErrorType.UNKNOWN_FIELD,
                    context: {
                      className: expect.any(String),
                      propertyName: 'unknownProperty',
                    },
                  }),
                ],
              }),
            ],
          }),
        );

        // expect(result.rawErrors).toEqual({
        //   success: false,
        //   type: 'class',
        //   reason: ValidationErrorType.OBJECT_PROPERTY_FAILED,
        //   context: { className: 'Test' },
        //   value: expect.anything(),
        //   previousErrors: [
        //     {
        //       success: false,
        //       type: 'intersection',
        //       reason: ValidationErrorType.OBJECT_PROPERTY_FAILED,
        //       context: { className: 'Test', propertyName: 'property' },
        //       value: expect.anything(),
        //       previousErrors: [
        //         {
        //           success: false,
        //           type: 'intersection',
        //           reason: ValidationErrorType.UNKNOWN_FIELD,
        //           value: 'UNKNOWN',
        //           previousErrors: [],
        //           context: {
        //             className: '{ foo: number; } & { bar: string; } & Generic<number>',
        //             propertyName: 'unknownProperty',
        //           },
        //         },
        //       ],
        //     },
        //   ],
        // });
      });
    });
  });

  describe('should not validate with unknown properties', () => {
    const result = v.validate(Test, {
      property: '!' as any,
    });
    it('should not validate', () => {
      expect(result.success).toEqual(false);
    });
    it('should construct the correct error', () => {
      expectValidationError(result, (result) => {
        expect(result.rawErrors).toEqual(
          NodeValidationErrorMatcher.singleObjectPropertyFailed(Test, 'property', {
            previousErrors: [
              NodeValidationErrorMatcher.intersectionPropertyFailed({
                context: { className: expect.any(String) },
                reason: ValidationErrorType.NOT_AN_OBJECT,
              }),
            ],
          }),
        );

        // expect(result.rawErrors).toEqual({
        //   success: false,
        //   type: 'class',
        //   value: { property: '!' },
        //   previousErrors: [
        //     {
        //       success: false,
        //       type: 'intersection',
        //       value: '!',
        //       previousErrors: [],
        //       reason: 'NOT_AN_OBJECT',
        //       context: { className: 'Test', propertyName: 'property' },
        //     },
        //   ],
        //   reason: 'OBJECT_PROPERTY_FAILED',
        //   context: { className: 'Test' },
        // });
      });
    });

    genValidationErrorTest(result);
  });
});
