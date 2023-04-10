/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-shadow */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { NodeValidationErrorMatcher, RootNodeFixture, StringNodeFixture } from './fixtures';
import { expectValidationError, project } from './utils';
import { ParseError } from '../errors';
import { ValidationErrorType } from '../nodes';
import { TransformerInstance } from '../transformer';
import {
  IGetTransformerContext,
  AbstractValueTransformerFactory,
  registry,
  Transform,
  Transformed,
  TransformerFunction,
  From,
} from '../transformer-parser';

describe('Transformer', () => {
  describe('StringToNumber transformer', () => {
    const v = new TransformerInstance({ project });

    @v.transformerDecorator()
    class Test {
      test!: Transformed<string, number, { radix: 16 }>;
    }

    it('should construct the correct tree', () => {
      const { tree } = v.getPropertyTypeTreesFromConstructor(Test)[0];

      expect(tree).toEqual(
        RootNodeFixture.createRequired({
          annotations: {
            isTransformedType: true,
            transformerFunction: [expect.any(Function)],
          },
          children: [
            StringNodeFixture.create({
              annotations: {
                validationFunctions: [expect.any(Function)],
              },
            }),
          ],
        }),
      );
    });

    it('should transform correctly', async () => {
      const result = await v.transform(Test, { test: 'FF' } as any);

      expect(result.success).toBeTrue();
      expect(result.object).toEqual({
        test: 255,
      });
    });
  });

  describe('StringToBoolean transformer', () => {
    const v = new TransformerInstance({ project });

    @v.transformerDecorator()
    class Test {
      test!: Transformed<string, boolean>;
    }

    it('should construct the correct tree', () => {
      const { tree } = v.getPropertyTypeTreesFromConstructor(Test)[0];

      expect(tree).toEqual(
        RootNodeFixture.createRequired({
          annotations: {
            isTransformedType: true,
            transformerFunction: [expect.any(Function)],
          },
          children: [
            StringNodeFixture.create({
              annotations: {
                validationFunctions: [expect.any(Function)],
              },
            }),
          ],
        }),
      );
    });

    it('should transform correctly', async () => {
      const result = await v.transformOrThrow(Test, { test: 'true' } as any);
      expect(result).toEqual({ test: true });
    });

    it('should construct the correct error', async () => {
      const result = await v.transform(Test, { test: 'invalid' } as any);
      expectValidationError(result, (result) => {
        expect(result.rawErrors).toEqual(
          NodeValidationErrorMatcher.singleObjectPropertyFailed(Test, 'test', {
            annotations: {
              isTransformedType: true,
              transformerFunction: [expect.any(Function)],
            },
            previousErrors: [
              NodeValidationErrorMatcher.stringError({
                annotations: {
                  validationFunctions: [expect.any(Function)],
                },
                previousErrors: [
                  NodeValidationErrorMatcher.constraintError({
                    reason: ValidationErrorType.NOT_AN_ENUM,
                    context: {
                      enumName: 'OneOf',
                      allowedValues: expect.any(Array),
                    },
                  }),
                ],
              }),
            ],
          }),
        );
      });
    });
  });

  describe('Self referencing / embed', () => {
    const v = new TransformerInstance({ project });

    @v.transformerDecorator()
    class TestSelfReference {
      id!: Transformed<string, number>;
      children!: TestSelfReference[];
    }

    @v.transformerDecorator()
    class TestTuple {
      test!: [TestTuple | null, string];
      transformed!: Transformed<string, boolean>;
    }

    it('should transform correctly', async () => {
      const result = await v.transform(TestSelfReference, { id: '1', children: [{ id: '2', children: [] }] } as any);
      expect(result.object).toEqual({
        id: 1,
        children: [{ id: 2, children: [] }],
      });
    });

    it('should transform tuples correctly', async () => {
      const result = await v.transform(TestTuple, {
        test: [{ test: [null, 'null'], transformed: 'off' as any }, 'root'],
        transformed: 'on' as any,
      });
      expect(result.object).toEqual({
        test: [{ test: [null, 'null'], transformed: false }, 'root'],
        transformed: true,
      });
    });
  });

  describe('@From', () => {
    const v = new TransformerInstance({ project });

    @v.transformerDecorator()
    class Test {
      @From('TEST')
      test!: string;
    }

    @v.transformerDecorator()
    class TestEmbed {
      @From('TEST')
      test!: number;
    }

    @v.transformerDecorator()
    class TestWithIntersection {
      test!: TestEmbed & { otherTest: number };
    }

    it('should construct the correct tree', () => {
      const { tree } = v.getPropertyTypeTreesFromConstructor(Test)[0];
      expect(tree).toEqual(
        RootNodeFixture.createRequired({
          annotations: {
            fromProperty: 'TEST',
          },
          children: [StringNodeFixture.create({})],
        }),
      );
    });

    it('should transform the property name', async () => {
      const result = await v.transform(Test, { TEST: 'string' });

      expect(result.success).toBeTrue();
      expect(result.object).toEqual({ test: 'string' });
    });

    it('should transform the property name when used in an intersection', async () => {
      const result = await v.transform(TestWithIntersection, { test: { TEST: 123, otherTest: 234 } as any });
      expect(result.success).toBeTrue();
      expect(result.object).toEqual({ test: { test: 123, otherTest: 234 } });
    });
  });

  describe('Intersection types', () => {
    const v = new TransformerInstance({ project });

    @v.transformerDecorator()
    class TestEmbed {
      classProperty!: Transformed<string, number>;
    }

    @v.transformerDecorator()
    class Test {
      test!: TestEmbed & { intersectionProperty: number };
    }

    it('should transform correctly', async () => {
      const result = await v.transform(Test, { test: { classProperty: '9001', intersectionProperty: 9001 } } as any);
      expect(result.object).toEqual({
        test: { classProperty: 9001, intersectionProperty: 9001 },
      });
    });
  });

  describe('@Transformer', () => {
    beforeEach(() => {
      callback.mockClear();
      callbackWithNodeValidationResult.mockClear();
    });

    const v = new TransformerInstance({ project });

    const callback = jest.fn(() => 9001);
    const callbackWithNodeValidationResult = jest.fn(({ success }) => success(9001));

    @v.transformerDecorator()
    class Test1 {
      @Transform(callback)
      test!: Transformed<string, number>;
    }

    @v.transformerDecorator()
    class Test2 {
      @Transform(callbackWithNodeValidationResult)
      test!: Transformed<string, number>;
    }

    it('should add the correct annotations', () => {
      const { tree } = v.getPropertyTypeTreesFromConstructor(Test1)[0];
      expect(tree.annotations).toEqual({ isTransformedType: true, transformerFunction: [callback] });
    });

    it('should transform correctly with scalar result', async () => {
      const result = await v.transform(Test1, { test: '123' } as any);
      expect(callback).toHaveBeenCalledOnce();
      expect(result.success).toBeTrue();
      expect(result.object).toEqual({ test: 9001 });
    });

    it('should transform correctly with INodeValidationSuccess', async () => {
      const result = await v.transform(Test2, { test: '123' } as any);
      expect(callbackWithNodeValidationResult).toHaveBeenCalledOnce();
      expect(result.success).toBeTrue();
      expect(result.object).toEqual({ test: 9001 });
    });
  });

  describe('Runtime errors', () => {
    beforeEach(() => callback.mockClear());

    const v = new TransformerInstance({ project });

    const callback = jest.fn(({ fail, value }) => fail(value));

    @v.transformerDecorator()
    class TestEmbed {
      @Transform(({ fail, value }) => fail(value))
      test!: Transformed<string, number>;
    }

    @v.transformerDecorator()
    class Test {
      @Transform(callback)
      test!: Transformed<string, number>;
    }

    @v.transformerDecorator()
    class TestWithEmbed {
      simple!: TestEmbed;
      array!: TestEmbed[];
    }

    @v.transformerDecorator()
    class TestWithIntersection {
      test!: Test & { otherProperty: number };
    }

    it('should report transform errors correctly for simple and array', async () => {
      const result = await v.transform(Test, { test: '123' } as any);
      expect(callback).toHaveBeenCalledOnce();
      expect(result.success).toBeFalse();
      expectValidationError(result, (result) => {
        expect(result.rawErrors).toEqual(
          NodeValidationErrorMatcher.singleObjectPropertyFailed(Test, 'test', {
            previousErrors: [
              expect.objectContaining({
                success: false,
                reason: 'CUSTOM',
                previousErrors: [],
              }),
            ],
          }),
        );
      });
    });

    it('should propagate transform errors correctly', async () => {
      const result = await v.transform(TestWithEmbed, {
        simple: { test: '123' as any },
        array: [{ test: '123' as any }],
      });

      expectValidationError(result, (result) => {
        expect(result.rawErrors).toEqual(
          NodeValidationErrorMatcher.objectPropertyFailed(TestWithEmbed, {
            previousErrors: [
              NodeValidationErrorMatcher.rootError(TestWithEmbed, 'simple', {
                previousErrors: [
                  NodeValidationErrorMatcher.singleObjectPropertyFailed(TestEmbed, 'test', {
                    previousErrors: [
                      expect.objectContaining({
                        success: false,
                        reason: 'CUSTOM',
                        previousErrors: [],
                      }),
                    ],
                  }),
                ],
              }),
              NodeValidationErrorMatcher.rootError(TestWithEmbed, 'array', {
                previousErrors: [
                  NodeValidationErrorMatcher.arrayError({
                    previousErrors: [
                      NodeValidationErrorMatcher.arrayItemError({
                        context: {
                          element: 0,
                        },
                        previousErrors: [
                          NodeValidationErrorMatcher.singleObjectPropertyFailed(TestEmbed, 'test', {
                            previousErrors: [
                              expect.objectContaining({
                                success: false,
                                reason: 'CUSTOM',
                                previousErrors: [],
                              }),
                            ],
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        );
      });
    });

    it('should report transform errors correctly for intersections', async () => {
      const result = await v.transform(TestWithIntersection, { test: { test: '123' as any, otherProperty: 123 } });
      expect(callback).toHaveBeenCalledOnce();
      expect(result.success).toBeFalse();
      expectValidationError(result, (result) => {
        expect(result.rawErrors).toEqual(
          NodeValidationErrorMatcher.singleObjectPropertyFailed(TestWithIntersection, 'test', {
            previousErrors: [
              NodeValidationErrorMatcher.intersectionPropertyFailed({
                context: { className: expect.any(String) },
                previousErrors: [
                  NodeValidationErrorMatcher.singleObjectPropertyFailed(Test, 'test', {
                    previousErrors: [
                      expect.objectContaining({
                        success: false,
                        reason: 'CUSTOM',
                        previousErrors: [],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        );
      });
    });
  });

  describe('Factories', () => {
    const v = new TransformerInstance({ project });

    const factory = jest.fn((values) => ({ ...values, customFactory: true }));

    @v.transformerDecorator({ factory })
    class TestWithFactory {
      test!: string;
    }

    class AlternativeConstructed {
      test!: string;
    }

    @v.transformerDecorator({ cls: AlternativeConstructed })
    class TestWithCls {
      test!: string;
    }

    @v.transformerDecorator()
    class Test {
      test1!: string;
      test2!: TestWithFactory;
    }

    it('should use factories correctly if nested', async () => {
      const result = await v.transform(Test, { test1: 'test', test2: { test: 'test' } });
      expect(result.success).toBeTrue();
      expect(result.object).toBeInstanceOf(Test); // Default is to use the class constructor
      expect(result.object?.test2).toEqual({ test: 'test', customFactory: true });
      expect(factory).toHaveBeenCalledOnceWith({ test: 'test' });
    });

    it('should use factories correctly if not default and toplevel', async () => {
      const result = await v.transform(TestWithFactory, { test: 'test' });
      expect(result.success).toBeTrue();
      expect(result.object).toEqual({ test: 'test', customFactory: true });
    });

    it('should use the correct class if `cls` is set', async () => {
      const result = await v.transform(TestWithCls, { test: 'test' });
      expect(result.success).toBeTrue();
      expect(result.object).toBeInstanceOf(AlternativeConstructed);
    });
  });

  describe('Inspect time errors', () => {
    const v = new TransformerInstance({ project });

    @v.transformerDecorator()
    class TestWithMissingTransformer {
      test!: Transformed<string, string>;
    }

    @v.transformerDecorator()
    class TestEmbedGenericFromType<T> {
      test!: Transformed<T, string>;
    }

    @v.transformerDecorator()
    class TestEmbedGenericToType<T> {
      test!: Transformed<string, T>;
    }

    @v.transformerDecorator()
    class TestWithGenericEmbedToType {
      test!: TestEmbedGenericToType<string>;
    }

    @v.transformerDecorator()
    class TestWithGenericEmbedFromType {
      test!: TestEmbedGenericFromType<string>;
    }

    @v.transformerDecorator()
    class TestWithInvalidOptions {
      test!: Transformed<string, number, { radix: number }>;
    }

    @v.transformerDecorator()
    class TestWithNullOptions {
      test!: Transformed<string, number, null>;
    }

    it('should not construct when Transformed<> uses generic ToType', () => {
      expect(() => v.getPropertyTypeTreesFromConstructor(TestWithGenericEmbedToType)).toThrowWithMessage(
        ParseError,
        /Transformed<FromType, ToType, Options> can only be used with concrete types. ToType is generic type T/,
      );
    });

    it('should not construct when Transformed<> uses generic FromType', () => {
      expect(() => v.getPropertyTypeTreesFromConstructor(TestWithGenericEmbedFromType)).toThrowWithMessage(
        ParseError,
        /Transformed<FromType, ToType, Options> can only be used with concrete types. FromType is generic type T/,
      );
    });

    it('should not construct when Transformed<> receives null as options', () => {
      expect(() => v.getPropertyTypeTreesFromConstructor(TestWithNullOptions)).toThrowWithMessage(
        ParseError,
        /Invalid options object/,
      );
    });

    it('should not construct when Transformed<> receives and options object not containing a literal', () => {
      expect(() => v.getPropertyTypeTreesFromConstructor(TestWithInvalidOptions)).toThrowWithMessage(
        ParseError,
        /Options can only be number, string or boolean literals. Option 'radix' is of type 'number'/,
      );
    });

    it('should not construct if transformer is missing', () => {
      expect(() => v.getPropertyTypeTreesFromConstructor(TestWithMissingTransformer)).toThrowWithMessage(
        ParseError,
        /Property has transformed type but no factory or decorator found/,
      );
    });
  });

  describe('Aliased ValueTransformers', () => {
    const v = new TransformerInstance({ project });

    const transformer = jest.fn(() => 123);

    type StringToNumber<Options extends { radix?: number }> = Transformed<string, number, Options>;

    @registry.decorate<StringToNumber<never>>()
    class TestStringToNumberalueTransformer extends AbstractValueTransformerFactory {
      getTransformer(ctx: IGetTransformerContext): TransformerFunction<string, number> {
        return transformer;
      }
    }
    const transformerInstance = new TestStringToNumberalueTransformer();
    jest.spyOn(transformerInstance, 'getTransformer');
    jest.spyOn(transformerInstance, 'getDecorators');
    v.parser.valueTransformers.push(transformerInstance);

    @v.transformerDecorator()
    class Test {
      test!: StringToNumber<{ radix: 16 }>;
    }

    it('should add the correct annotations', () => {
      const { tree } = v.getPropertyTypeTreesFromConstructor(Test)[0];
      expect(tree.annotations.transformerFunction).toEqual([expect.any(Function)]);
      expect(transformerInstance.getDecorators).toHaveBeenCalledOnceWith(
        expect.objectContaining({ options: { radix: 16 } }),
      );
    });

    it('should transform correctly', async () => {
      const result = await v.transform(Test, { test: '0xff' } as any);
      expect(result.success).toBeTrue();
      expect(result.object).toEqual({ test: 123 });
      expect(transformerInstance.getTransformer).toHaveBeenCalledOnceWith(
        expect.objectContaining({ options: { radix: 16 } }),
      );
      expect(transformer).toHaveBeenCalledOnceWith({
        value: '0xff',
        values: { test: '0xff' },
        success: expect.any(Function),
        fail: expect.any(Function),
      });
    });
  });

  describe('Unknown fields', () => {
    const v = new TransformerInstance({ project });

    @v.transformerDecorator()
    class Test {
      test!: string;
    }

    it('should not allow unknown fields by default', async () => {
      const result = await v.transform(Test, { test: 'string', unknown: 'should not be allowed' });
      expect(result.success).toBeFalse();
    });

    it('should allow unknown fields if requested', async () => {
      const result = await v.transform(
        Test,
        { test: 'string', unknown: 'should be allowed' },
        { allowUnknownFields: true },
      );
      expect(result.success).toBeTrue();
      expect(result.object).toEqual({ test: 'string' });
    });
  });

  describe('transformer', () => {
    it('mixed', async () => {
      const t = new TransformerInstance({ project });

      interface IInterface {
        interfaceProperty: number;
      }

      interface IOtherInterface {
        otherInterfaceProperty: number;
      }

      @t.transformerDecorator()
      class TestEmbed {
        // @In<Transformed<string, DateTime>>()
        // @Out<Transformed<Date, string>>()
        // date!: DateTime;

        emebeddedProperty!: number;
        x!: Transformed<string, number>;
      }

      @t.transformerDecorator()
      class Test {
        testString!: string;
        testNumber!: number;
        testUnion!: Test | null;
        testNested!: TestEmbed;
        testArray!: TestEmbed[];
        testOptional?: string;
        testGeneric!: TestGeneric;
      }

      @t.transformerDecorator()
      class TestGenericEmeb<T> {
        genericProperty!: T;
      }

      @t.transformerDecorator()
      class TestGeneric {
        t!: TestGenericEmeb<number>;
      }

      // console.time('a');
      // for (let i = 0; i < 10000; i++) {
      const r2 = await t.transformOrThrow(Test, {
        testString: 'str',
        testNumber: 9001,
        testArray: [{ emebeddedProperty: 123, x: '456' as any }],
        testUnion: {
          testString: '',
          testNumber: 0,
          testUnion: null,
          testNested: {
            emebeddedProperty: 23,
            x: '123' as any,
          },
          testOptional: '123',
          testGeneric: {
            t: { genericProperty: 123 },
          },
          testArray: [],
        },
        testNested: {
          emebeddedProperty: 9001,
          x: '123' as any,
        },
        testGeneric: {
          t: { genericProperty: 123 },
        },
      });

      expect(r2).toBeTruthy();
      // }
      // console.timeEnd('a');
    });
  });
});
