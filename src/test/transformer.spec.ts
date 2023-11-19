/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-shadow */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { DateTime } from 'luxon';

import {
  ArrayNodeFixture,
  ClassNodeFixture,
  LiteralNodeFixture,
  NodeValidationErrorMatcher,
  RootNodeFixture,
  StringNodeFixture,
  UnionNodeFixture,
} from './fixtures';
import { expectValidationError, project } from './utils';
import { StringValidationError } from '../decorators';
import { ParseError } from '../errors';
import { IRootNodeValidationError, ValidationErrorType } from '../nodes';
import { TransformerInstance } from '../transformer';
import { ValidationError } from '../transformer';
import {
  AbstractValueTransformerFactory,
  registry,
  Transform,
  Transformed,
  TransformerFunction,
  From,
} from '../transformer-parser';
import { Constructor } from '../types';
import {
  StringToNumberValueTransformer,
  StringToBooleanValueTransformer,
  StringToStringArrayTransformer,
  StringArrayToStringTransformer,
} from '../value-transformers';
import { IsoStringToDateTimeTransformer, DateTimeToIsoStringTransformer } from '../value-transformers/luxon';

describe('Transformer', () => {
  describe('StringToNumber transformer', () => {
    const v = new TransformerInstance({
      project,
      additionalValueTransformerFactories: [new StringToNumberValueTransformer()],
    });

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
            isNullableTransformer: false,
            hasInitializer: false,
          },
          children: [
            StringNodeFixture.create({
              annotations: {
                validationFunctions: [{ callback: expect.any(Function), meta: expect.anything() }],
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

  describe('StringToNumber | null transformer', () => {
    const v = new TransformerInstance({
      project,
      additionalValueTransformerFactories: [new StringToNumberValueTransformer()],
    });

    @v.transformerDecorator()
    class Test {
      test!: Transformed<string, number> | null;
    }

    it('should construct the correct tree', () => {
      const { tree } = v.getPropertyTypeTreesFromConstructor(Test)[0];

      expect(tree).toEqual(
        RootNodeFixture.createRequired({
          annotations: {
            isTransformedType: true,
            transformerFunction: [expect.any(Function)],
            isNullableTransformer: true,
            hasInitializer: false,
          },
          children: [
            UnionNodeFixture.create({
              children: [
                LiteralNodeFixture.create(null),
                StringNodeFixture.create({
                  annotations: {
                    validationFunctions: [{ callback: expect.any(Function), meta: expect.anything() }],
                  },
                }),
              ],
            }),
          ],
        }),
      );
    });

    it('should transform correctly', async () => {
      const result = await v.transform(Test, { test: '255' } as any);

      expect(result.success).toBeTrue();
      expect(result.object).toEqual({
        test: 255,
      });
    });

    it('should transform correctly', async () => {
      const result = await v.transform(Test, { test: null } as any);

      expect(result.success).toBeTrue();
      expect(result.object).toEqual({
        test: null,
      });
    });
  });

  describe('StringToBoolean transformer', () => {
    const v = new TransformerInstance({
      project,
      additionalValueTransformerFactories: [new StringToBooleanValueTransformer()],
    });

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
            isNullableTransformer: false,
            hasInitializer: false,
          },
          children: [
            StringNodeFixture.create({
              annotations: {
                validationFunctions: [{ callback: expect.any(Function), meta: expect.anything() }],
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
              isNullableTransformer: false,
              hasInitializer: false,
            },
            previousErrors: [
              NodeValidationErrorMatcher.stringError({
                annotations: {
                  validationFunctions: [{ callback: expect.any(Function), meta: expect.anything() }],
                },
                previousErrors: [
                  NodeValidationErrorMatcher.constraintError({
                    reason: ValidationErrorType.NOT_AN_ENUM,
                    context: {
                      enumName: 'BooleanString',
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

  describe('ISOStringToDateTimeTransformer transformer', () => {
    const v = new TransformerInstance({
      project,
      additionalValueTransformerFactories: [new IsoStringToDateTimeTransformer()],
    });

    @v.transformerDecorator()
    class Test {
      test!: Transformed<string, DateTime>;
    }

    it('should construct the correct tree', () => {
      const { tree } = v.getPropertyTypeTreesFromConstructor(Test)[0];

      expect(tree).toEqual(
        RootNodeFixture.createRequired({
          annotations: {
            isTransformedType: true,
            transformerFunction: [expect.any(Function)],
            isNullableTransformer: false,
            hasInitializer: false,
          },
          children: [
            StringNodeFixture.create({
              annotations: {
                validationFunctions: [
                  {
                    callback: expect.any(Function),
                    meta: {
                      context: {},
                      name: '@IsISO8601',
                    },
                  },
                ],
              },
            }),
          ],
        }),
      );
    });

    it('should transform correctly', async () => {
      const result = await v.transformOrThrow(Test, { test: '2023-05-04T12:34:56.789Z' } as any);
      expect(result).toEqual({ test: expect.any(DateTime) });
    });

    it('should construct the correct error', async () => {
      const result = await v.transform(Test, { test: 'invalid' } as any);
      expectValidationError(result, (result) => {
        expect(result.rawErrors).toEqual(
          NodeValidationErrorMatcher.singleObjectPropertyFailed(Test, 'test', {
            annotations: {
              isTransformedType: true,
              transformerFunction: [expect.any(Function)],
              isNullableTransformer: false,
              hasInitializer: false,
            },
            previousErrors: [
              NodeValidationErrorMatcher.stringError({
                annotations: {
                  validationFunctions: [{ callback: expect.any(Function), meta: expect.anything() }],
                },
                previousErrors: [
                  NodeValidationErrorMatcher.constraintError({
                    reason: StringValidationError.INVALID_ISO_8601_STRING,
                  }),
                ],
              }),
            ],
          }),
        );
      });
    });
  });

  describe('DateTimeToISOStringTransformer transformer - validation types', () => {
    const v = new TransformerInstance({
      project,
      additionalValueTransformerFactories: [new DateTimeToIsoStringTransformer()],
    });

    @v.transformerDecorator()
    class Test {
      test!: Transformed<DateTime, string>;
    }

    it('should construct the correct transformed tree', () => {
      const { tree } = v.getPropertyTypeTreesFromConstructor(Test)[0];

      expect(tree).toEqual(
        RootNodeFixture.createRequired({
          annotations: {
            isTransformedType: true,
            transformerFunction: [expect.any(Function)],
            isNullableTransformer: false,
            hasInitializer: false,
            validateIf: expect.any(Function),
          },
          children: [
            ClassNodeFixture.createForClass(
              DateTime as unknown as Constructor<DateTime>,
              {
                reference: expect.any(String),
              },
              { annotations: { comment: expect.anything() } },
            ),
          ],
        }),
      );
    });

    it('should transform correctly', async () => {
      const now = DateTime.now();
      const result = await v.transformOrThrow(Test, { test: now } as any);
      expect(result).toEqual({ test: now.toISO() });
    });

    it('should construct the correct error', async () => {
      const result = await v.transform(Test, { test: 'invalid' } as any);
      expectValidationError(result, (result) => {
        expect(result.rawErrors).toEqual(
          NodeValidationErrorMatcher.singleObjectPropertyFailed(Test, 'test', {
            annotations: {
              isTransformedType: true,
              transformerFunction: [expect.any(Function)],
              isNullableTransformer: false,
              hasInitializer: false,
              validateIf: expect.any(Function),
            },
            previousErrors: [
              NodeValidationErrorMatcher.classNotAObjectError(DateTime as unknown as Constructor<DateTime>),
            ],
          }),
        );
      });
    });
  });

  describe('DateTimeToISOStringTransformer transformer - target type', () => {
    const v = new TransformerInstance({
      project,
      additionalValueTransformerFactories: [new DateTimeToIsoStringTransformer()],
    });

    @v.transformerDecorator()
    class Test {
      test!: Transformed<DateTime, string>;
    }

    it('should construct the correct untransformed tree', () => {
      const { tree } = v.getTransformationTargetClassNode(Test).getClassTrees()[0];

      expect(tree).toEqual(
        RootNodeFixture.createRequired({
          annotations: {
            hasInitializer: false,
            validateIf: expect.any(Function),
          },
          children: [
            StringNodeFixture.create({
              annotations: {
                validationFunctions: [
                  {
                    callback: expect.any(Function),
                    meta: {
                      context: {},
                      name: '@IsISO8601',
                    },
                  },
                ],
              },
            }),
          ],
        }),
      );
    });
  });

  describe('StringToStringArrayTransformer transformer', () => {
    const v = new TransformerInstance({
      project,
      additionalValueTransformerFactories: [new StringToStringArrayTransformer()],
    });

    @v.transformerDecorator()
    class Test {
      testDefaultSplit!: Transformed<string, string[]>;
      testCustomSplit!: Transformed<string, string[], { separator: ':' }>;
      testCustomSplitRegex!: Transformed<string, string[], { separator: ',\\s+'; regex: true }>;
    }

    it('should construct the correct tree', () => {
      const { tree } = v.getPropertyTypeTreesFromConstructor(Test)[0];

      expect(tree).toEqual(
        RootNodeFixture.createRequired({
          annotations: {
            isTransformedType: true,
            transformerFunction: [expect.any(Function)],
            isNullableTransformer: false,
            hasInitializer: false,
          },
          children: [StringNodeFixture.create({})],
        }),
      );
    });

    it('should transform correctly', async () => {
      const result = await v.transformOrThrow(Test, {
        testDefaultSplit: '1,2,3',
        testCustomSplit: '1:2:3',
        testCustomSplitRegex: '1,  2,   3',
      } as any);
      expect(result).toEqual({
        testDefaultSplit: ['1', '2', '3'],
        testCustomSplit: ['1', '2', '3'],
        testCustomSplitRegex: ['1', '2', '3'],
      });
    });

    it('should construct the correct error', async () => {
      const result = await v.transform(Test, {
        testDefaultSplit: '1,2,3',
        testCustomSplit: '1:2:3',
        testCustomSplitRegex: 0,
      } as any);
      expectValidationError(result, (result) => {
        expect(result.rawErrors).toEqual(
          NodeValidationErrorMatcher.singleObjectPropertyFailed(Test, 'testCustomSplitRegex', {
            annotations: {
              isTransformedType: true,
              transformerFunction: [expect.any(Function)],
              isNullableTransformer: false,
              hasInitializer: false,
            },
            previousErrors: [NodeValidationErrorMatcher.stringError({})],
          }),
        );
      });
    });
  });

  describe('StringArrayToStringTransformer transformer', () => {
    const v = new TransformerInstance({
      project,
      additionalValueTransformerFactories: [new StringArrayToStringTransformer()],
    });

    @v.transformerDecorator()
    class Test {
      testDefault!: Transformed<string[], string>;
      testCustom!: Transformed<string[], string, { separator: ':' }>;
    }

    it('should construct the correct tree', () => {
      const { tree } = v.getPropertyTypeTreesFromConstructor(Test)[0];

      expect(tree).toEqual(
        RootNodeFixture.createRequired({
          annotations: {
            isTransformedType: true,
            transformerFunction: [expect.any(Function)],
            isNullableTransformer: false,
            hasInitializer: false,
          },
          children: [
            ArrayNodeFixture.create({
              children: [StringNodeFixture.create({})],
            }),
          ],
        }),
      );
    });

    it('should transform correctly', async () => {
      const result = await v.transformOrThrow(Test, {
        testDefault: ['1', '2', '3'],
        testCustom: ['1', '2', '3'],
      } as any);
      expect(result).toEqual({
        testDefault: '1,2,3',
        testCustom: '1:2:3',
      });
    });

    it('should construct the correct error', async () => {
      const result = await v.transform(Test, {
        testDefault: ['1', '2', '3'],
        testCustom: '123',
      } as any);
      expectValidationError(result, (result) => {
        expect(result.rawErrors).toEqual(
          NodeValidationErrorMatcher.singleObjectPropertyFailed(Test, 'testCustom', {
            annotations: {
              isTransformedType: true,
              transformerFunction: [expect.any(Function)],
              isNullableTransformer: false,
              hasInitializer: false,
            },
            previousErrors: [NodeValidationErrorMatcher.arrayError({ reason: ValidationErrorType.NOT_AN_ARRAY })],
          }),
        );
      });
    });
  });

  describe('Self referencing / embed', () => {
    const v = new TransformerInstance({
      project,
      additionalValueTransformerFactories: [
        new StringToNumberValueTransformer(),
        new StringToBooleanValueTransformer(),
      ],
    });

    interface IEmbed {
      interfaceProperty: string;
    }

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

    @v.transformerDecorator()
    class TestInterface {
      test!: IEmbed;
    }

    it('should transform classes correctly', async () => {
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

    it('should transform interfaces correctly', async () => {
      const result = await v.transform(TestInterface, {
        test: { interfaceProperty: 'test' },
      });

      expect(result.object).toEqual({
        test: {
          interfaceProperty: 'test',
        },
      });
    });
  });

  describe('Default values', () => {
    const v = new TransformerInstance({ project });

    @v.transformerDecorator()
    class Test {
      test: string = 'default';
    }

    it('should transform with default value', async () => {
      const result = await v.transform(Test, {});
      expect(result.success).toBeTrue();
      expect(result.object?.test).toEqual('default');
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
            hasInitializer: false,
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

    it('should transform the property name in errors', async () => {
      const result = await v.transform(Test, { TEST: 123 });

      expect(result.success).toBeFalse();
      expectValidationError(result, (result) => {
        expect(
          (result.rawErrors.previousErrors[0].context as IRootNodeValidationError['context']).propertyName,
        ).toEqual('test');
        expect(
          (result.rawErrors.previousErrors[0].context as IRootNodeValidationError['context']).resolvedPropertyName,
        ).toEqual('TEST');

        expect(result.errors['$.TEST']).toBeTruthy();
        expect(result.errors['$.test']).toBeFalsy();
      });
    });

    it('should transform the property name when used in an intersection', async () => {
      const result = await v.transform(TestWithIntersection, { test: { TEST: 123, otherTest: 234 } as any });
      expect(result.success).toBeTrue();
      expect(result.object).toEqual({ test: { test: 123, otherTest: 234 } });
    });
  });

  describe('Intersection types', () => {
    const v = new TransformerInstance({
      project,
      additionalValueTransformerFactories: [new StringToNumberValueTransformer()],
    });

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
      expect(tree.annotations).toEqual({
        isTransformedType: true,
        transformerFunction: [callback],
        isNullableTransformer: false,
        hasInitializer: false,
      });
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
            annotations: {
              isNullableTransformer: false,
              isTransformedType: true,
              transformerFunction: [callback],
              hasInitializer: false,
            },
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
                    annotations: {
                      isNullableTransformer: false,
                      isTransformedType: true,
                      transformerFunction: [expect.any(Function)],
                      hasInitializer: false,
                    },
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
                            annotations: {
                              isNullableTransformer: false,
                              isTransformedType: true,
                              transformerFunction: [expect.any(Function)],
                              hasInitializer: false,
                            },
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
                    annotations: {
                      isNullableTransformer: false,
                      isTransformedType: true,
                      transformerFunction: [callback],
                      hasInitializer: false,
                    },
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
      expect(factory).toHaveBeenCalledExactlyOnceWith({ test: 'test' });
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

  describe('Custom ValueTransformers', () => {
    const v = new TransformerInstance({ project });

    @registry.decorate<Transformed<string[], Set<string>, unknown>>()
    class StringArrayToSet extends AbstractValueTransformerFactory {
      getTransformer(): TransformerFunction<string[], Set<string>> {
        return ({ value }) => new Set<string>(value);
      }
    }

    @registry.decorate<Transformed<string[], Set<number>, unknown>>()
    class StringArrayToNumberSet extends AbstractValueTransformerFactory {
      getTransformer(): TransformerFunction<string[], Set<number>> {
        return ({ value }) => new Set<number>(value.map((v) => parseInt(v, 10)));
      }
    }

    const stringArrayToSet = new StringArrayToSet();
    jest.spyOn(stringArrayToSet, 'getTransformer');
    jest.spyOn(stringArrayToSet, 'getDecorators');

    const stringArrayToNumberSet = new StringArrayToNumberSet();
    jest.spyOn(stringArrayToNumberSet, 'getTransformer');
    jest.spyOn(stringArrayToNumberSet, 'getDecorators');

    v.parser.valueTransformers.push(stringArrayToSet);
    v.parser.valueTransformers.push(stringArrayToNumberSet);

    @v.transformerDecorator()
    class Test {
      test1!: Transformed<string[], Set<string>>;
      test2!: Transformed<string[], Set<number>>;
    }

    it('should add the correct annotations', () => {
      const trees = v.getPropertyTypeTreesFromConstructor(Test);
      const { tree: tree1 } = trees[0];
      const { tree: tree2 } = trees[1];

      expect(tree1.annotations.transformerFunction).toEqual([expect.any(Function)]);
      expect(stringArrayToSet.getDecorators).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ options: {} }));
      expect(tree2.annotations.transformerFunction).toEqual([expect.any(Function)]);
      expect(stringArrayToNumberSet.getDecorators).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ options: {} }),
      );
    });

    it('should transform correctly', async () => {
      const result = await v.transform(Test, { test1: ['a', 'b'], test2: ['1', '2'] } as any);

      expect(result.success).toBeTrue();
      expect(result.object).toEqual({ test1: new Set(['a', 'b']), test2: new Set([1, 2]) });
      expect(stringArrayToSet.getTransformer).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ options: {} }));
    });
  });

  describe('Aliased ValueTransformers', () => {
    const v = new TransformerInstance({
      project,
      additionalValueTransformerFactories: [new StringToNumberValueTransformer()],
    });

    const transformer = jest.fn(() => 123);

    type StringToNumber<Options extends { radix?: number }> = Transformed<string, number, Options>;

    @registry.decorate<StringToNumber<never>>()
    class TestStringToNumberalueTransformer extends AbstractValueTransformerFactory {
      getTransformer(): TransformerFunction<string, number> {
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
      expect(transformerInstance.getDecorators).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ options: { radix: 16 } }),
      );
    });

    it('should transform correctly', async () => {
      const result = await v.transform(Test, { test: '0xff' } as any);
      expect(result.success).toBeTrue();
      expect(result.object).toEqual({ test: 123 });
      expect(transformerInstance.getTransformer).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ options: { radix: 16 } }),
      );
      expect(transformer).toHaveBeenCalledExactlyOnceWith({
        value: '0xff',
        values: { test: '0xff' },
        success: expect.any(Function),
        fail: expect.any(Function),
        propertyValidationResult: expect.any(Object),
      });
    });
  });

  describe('Namespaced aliased ValueTransformers', () => {
    it.todo('should allow namespaced aliases');
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

  describe('End to end', () => {
    const t = new TransformerInstance({
      project,
      additionalValueTransformerFactories: [new StringToNumberValueTransformer()],
    });

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

    const VALID_OBJECT = {
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
    };

    it('should construct an instance with TransformerInstance.withDefaultProject()', () => {
      const v = TransformerInstance.withDefaultProject();
      expect(v).toBeInstanceOf(TransformerInstance);
    });

    it('should unwrap', async () => {
      const t = new TransformerInstance({ project });
      // eslint-disable-next-line @typescript-eslint/naming-convention
      const { validate, validateOrThrow, transform, transformOrThrow, Dto, transformer } = t.unwrap();

      @Dto()
      class Test {
        test!: number;
      }

      expect(validate(Test, { test: 1 }).success).toBeTrue();
      expect(validate(Test, { test: 'a' as any }).success).toBeFalse();

      expect((await transform(Test, { test: 1 })).success).toBeTrue();
      expect((await transform(Test, { test: 'a' as any })).success).toBeFalse();

      expect(validateOrThrow).toBeTruthy();
      expect(transformOrThrow).toBeTruthy();

      expect(transformer).toBeTruthy();
    });

    it('should load eager if enabled', () => {
      const t = new TransformerInstance({ project, eager: true });

      @t.transformerDecorator()
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      class Test {
        test!: number;
      }

      expect(t.parser.classTreeCache.map.size).toEqual(1);
    });

    it('should not load eager if disabled', () => {
      const t = new TransformerInstance({ project });
      @t.transformerDecorator()
      class Test {
        test!: number;
      }

      expect(t.getClassMetadata(Test)).toBeTruthy();
      expect(t.parser.classTreeCache.map.size).toEqual(0);
    });

    it.skip('should test performance', async () => {
      console.time('a');
      for (let i = 0; i < 10000; i++) {
        await t.transformOrThrow(Test, VALID_OBJECT);
        t.validateOrThrow(Test, VALID_OBJECT);
      }
      console.timeEnd('a');
    });

    it('should transform with valid data', async () => {
      const result = await t.transformOrThrow(Test, VALID_OBJECT);
      const validationResult = t.validateOrThrow(Test, VALID_OBJECT);

      expect(validationResult).toEqual(VALID_OBJECT);
      expect(result).toBeTruthy();
      expect(result).toEqual({
        testString: 'str',
        testNumber: 9001,
        testArray: [
          {
            emebeddedProperty: 123,
            x: 456,
          },
        ],
        testUnion: {
          testString: '',
          testNumber: 0,
          testUnion: null,
          testNested: {
            emebeddedProperty: 23,
            x: 123,
          },
          testOptional: '123',
          testGeneric: {
            t: {
              genericProperty: 123,
            },
          },
          testArray: [],
        },
        testNested: {
          emebeddedProperty: 9001,
          x: 123,
        },
        testGeneric: { t: { genericProperty: 123 } },
      });
    });

    it('should not validate with invalid data', async () => {
      const result = await t.transform(Test, {} as any);
      expect(result.success).toBeFalse();
      expect(() => t.validateOrThrow(Test, {} as any)).toThrowError(ValidationError);
    });

    it('should throw with invalid data when using TransformerInstance.transformOrThrow', async () => {
      const getException = async () => {
        try {
          await t.transformOrThrow(Test, {} as any);
        } catch (e: unknown) {
          return e;
        }
      };

      const error = await getException();
      expect(error).toBeInstanceOf(ValidationError);
      expect(error).toEqual(
        expect.objectContaining({
          errors: expect.toBeObject(),
          rawErrors: expect.toBeObject(),
        }),
      );
    });

    it('should validate with the TransformerInstance.validate method', () => {
      const validationResult = t.validate(Test, VALID_OBJECT);
      expect(validationResult.success).toBeTrue();
    });
  });
});
