/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-shadow */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { debug, expectValidationError, getLineNumber, project } from './utils';
import { ClassDiscovery } from '../class-discovery';
import { TransformerInstance } from '../transformer';
import {
  IGetTransformerContext,
  AbstractValueTransformerFactory,
  registry,
  Transform,
  Transformed,
  TransformerParser,
  defaultFactory,
  TransformerFunction,
  StringToNumberValueTransformer,
} from '../transformer-parser';
import { Constructor } from '../types';
import { ClassCache } from '../validator-parser';
import {
  BooleanNodeFixture,
  NodeValidationErrorMatcher,
  NumberNodeFixture,
  RootNodeFixture,
  StringNodeFixture,
} from './fixtures';
import { ValidationErrorType } from '../nodes';
import { ParseError } from '../errors';

class Nested {
  nestedStringToNumber!: Transformed<string, number>;
}

// @registry.decorate<Transformed<string, DateTime, never>>()
// class StringToDateTimeValueTransformer extends AbstractValueTransformerFactory {
//   getTransformer(ctx: IGetTransformerContext): TransformationNodeBase<unknown, unknown, unknown> {
//     return new TransformationNode(
//       [
//         (value: string) => {
//           console.log({ value, date: DateTime.fromISO(value) });
//           return DateTime.fromISO(value);
//         },
//       ],
//       { name: 'datetime' },
//     );
//   }
// }

// @registry.decorate<Transformed<string | null, number | null, never>>()
// class X extends AbstractValueTransformerFactory {
//   getTransformer(ctx: IGetTransformerContext): TransformationNodeBase<unknown, unknown, unknown> {
//     return new TransformationNode(
//       [
//         (value: string | null) => {
//           return 0;
//         },
//       ],
//       { name: 'xyz' },
//     );
//   }
// }

type StringToNumber<Options extends { radix?: number }> = Transformed<string, number, Options>;
interface ISTONOPT {
  radix?: number;
}
type StringToNumberOptions<T extends ISTONOPT> = T;

@registry.decorate<StringToNumber<never>>()
class TestStringToNumberalueTransformer extends AbstractValueTransformerFactory {
  getTransformer(ctx: IGetTransformerContext): TransformerFunction<string, number> {
    console.log(ctx);
    return ({ value }) => {
      return 123;
    };
  }
}

const LINE = getLineNumber();
class Test {
  blorb!: StringToNumber<{ radix: 10 }>;
  str!: string;

  stringToNumber!: Transformed<string, number, { radix: 16 }>;
  // stn2: Transformed<string, number> | undefined;
  // rr: Record<string, Transformed<string, number>>;
  // rr: Transformed<Record<string, string>, Record<string, number>;
  // specialStringToNumber1!: Transformed<string, number, StringToNumberOptions<{ radix: 16 }>>;

  // // specialStringToNumber2!: StringToNumber<{ radix: 16 }>;

  // stringToBool!: Transformed<string, boolean>;

  @Transform<string>(({ value }) => value.split(','))
  stringToList!: Transformed<string, string[]>;
  // // nested!: NestedTransformer<Nested>;

  // stringToDateTime!: Transformed<string, DateTime>;

  // t1!: Transformed<string | null, number | null>;
  // t2!: Transformed<null | string, number | null>;
}

describe.skip('transformer', () => {
  it('shoud', async () => {
    const cd = new ClassDiscovery(project);
    const cc = new ClassCache<Constructor<any>>();
    const dclr = cd.getClass('Test', 'src/test/transformer.spec.ts', LINE, 0);
    cc.set(dclr, Test);
    // const p = new TransformerValidatorParser(cc);
    // const pn = p.getClassNode(dclr);
    // console.log(pn);

    const tp = TransformerParser.default(cc, cd, defaultFactory, [
      /*new X(), new StringToDateTimeValueTransformer()*/
      new TestStringToNumberalueTransformer(),
    ]);
    const tree = tp.getPropertyTypeTrees(dclr);

    console.log(JSON.stringify(tree));

    const x = await tp.transform(dclr, {
      blorb: '44',
      str: 'str',
      stringToNumber: '9001',
      stringToList: '1,2,3',
    });

    console.log(x);
    // const n = tp.getTransformerNode(dclr);
    // console.log(n);
    // const result = await n.transform({
    //   str: '123',
    //   stringToNumber: '9001',
    //   specialStringToNumber1: '0xFF',
    //   stringToList: '1,9001',
    //   stringToBool: 'true',
    //   stringToDateTime: '2022-08-15T12:34:56Z',
    //   t1: null,
    //   t2: null,
    // });
    // console.log(result);
    // console.log(JSON.stringify(result, null, 2));
    // const x = tp.parse(dclr);
    // console.debug(x);
    // console.log(JSON.stringify(x, null, 2));
    // cd.classCache.set()
    // const cn = p.getClassNode(dclr);
    // console.log(cn);
  });

  // it('should', async () => {
  //   const v = new TransformerInstance({ project });
  //
  //   @v.transformerDecorator()
  //   class Test {
  //     test!: Transformed<string, boolean>;
  //   }
  //
  //   const tree = v.getPropertyTypeTreesFromConstructor(Test)[0];
  //
  //   const result = await v.validate(Test, { test: 'truex' } as any);
  //   console.log(result);
  // });
});

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
      console.log(result);
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

    it('should report transform errors correctly', async () => {
      const result = await v.transform(Test, { test: '123' } as any);
      expect(callback).toHaveBeenCalledOnce();
      expect(result.success).toBeFalse();
      expectValidationError(result, (result) => {
        console.log(JSON.stringify(result, null, 2));
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
        // testIntersection!: IInterface & IOtherInterface;
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

      const trees = t.getPropertyTypeTreesFromConstructor(Test);
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
        // testIntersection: {
        //   interfaceProperty: 1,
        //   otherInterfaceProperty: 2,
        // },
      });

      console.log(r2);
    });

    it('should', () => {
      const inst = new TransformerInstance({ project });
    });
  });
});
