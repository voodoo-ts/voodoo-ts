/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { ParseError } from '../../errors';
import { ClassNode, TypeNodeData, ValidationErrorType } from '../../nodes';
import { isParseError } from '../../parser';
import { ValidatorInstance } from '../../validator';
import { expectValidationError, project } from '../utils';

describe('nested', () => {
  describe('simple', () => {
    const v = new ValidatorInstance({ project });

    @v.validatorDecorator()
    class TestEmbed {
      embeddedProperty!: number;
    }

    @v.validatorDecorator()
    class Test {
      embeddedObject!: TestEmbed;
    }

    it('should validate', () => {
      const result = v.validate(Test, { embeddedObject: { embeddedProperty: 123 } });

      expect(result.success).toEqual(true);
    });

    describe('should not validate if attribute is missing', () => {
      const result = v.validate(Test, { embeddedObject: {} } as any);

      it('should not validate', () => {
        expect(result.success).toEqual(false);
      });

      it('should construct the correct error', () => {
        expectValidationError(result, (result) => {
          expect(result.rawErrors).toEqual({
            success: false,
            type: 'class',
            reason: ValidationErrorType.OBJECT_PROPERTY_FAILED,
            value: { embeddedObject: {} },
            context: { className: 'Test' },
            previousErrors: [
              {
                success: false,
                type: 'class',
                reason: ValidationErrorType.OBJECT_PROPERTY_FAILED,
                value: {},
                context: { className: 'Test', propertyName: 'embeddedObject' },
                previousErrors: [
                  {
                    success: false,
                    type: 'root',
                    previousErrors: [],
                    reason: ValidationErrorType.VALUE_REQUIRED,
                    context: { className: 'TestEmbed', propertyName: 'embeddedProperty' },
                  },
                ],
              },
            ],
          });
        });
      });
    });

    describe('should not validate if attribute has invalid type', () => {
      const result = v.validate(Test, { embeddedObject: { embeddedProperty: null } } as any);

      it('should not validate', () => {
        expect(result.success).toEqual(false);
      });

      it('should construct the correct error', () => {
        expectValidationError(result, (result) => {
          expect(result.rawErrors).toEqual({
            success: false,
            type: 'class',
            reason: ValidationErrorType.OBJECT_PROPERTY_FAILED,
            value: { embeddedObject: { embeddedProperty: null } },
            context: { className: 'Test' },
            previousErrors: [
              {
                success: false,
                type: 'class',
                reason: ValidationErrorType.OBJECT_PROPERTY_FAILED,
                value: { embeddedProperty: null },
                context: { className: 'Test', propertyName: 'embeddedObject' },
                previousErrors: [
                  {
                    success: false,
                    type: 'number',
                    reason: ValidationErrorType.NOT_A_NUMBER,
                    value: null,
                    previousErrors: [],
                    context: { className: 'TestEmbed', propertyName: 'embeddedProperty' },
                  },
                ],
              },
            ],
          });
        });
      });
    });
  });

  describe('cycle', () => {
    const v = new ValidatorInstance({ project });

    @v.validatorDecorator()
    class Test {
      name!: string;
      children!: Test[];
    }

    it('should construct the correct tree', () => {
      const { tree } = v.getPropertyTypeTreesFromConstructor(Test)[1];

      expect(tree).toEqual({
        kind: 'root',
        optional: false,
        children: [
          {
            kind: 'array',
            children: [
              {
                kind: 'class',
                name: 'Test',
                children: [],
                annotations: {},
                meta: expect.anything(),
                getClassTrees: expect.any(Function),
              },
            ],
            annotations: {},
          },
        ],
        annotations: {},
      } as TypeNodeData);
    });

    it('should validate', () => {
      const result = v.validate(Test, {
        name: 'root',
        children: [
          { name: 'Child1', children: [] },
          { name: 'Child2', children: [{ name: 'Child2-1' as string, children: [] }] },
          { name: 'Child3', children: [] },
        ],
      });
      expect(result.success).toEqual(true);
    });

    describe('should not validate invalid input', () => {
      const result = v.validate(Test, {
        name: 'root',
        children: [
          { name: 'Child1', children: [] },
          { name: 'Child2', children: [{ name: 123 as unknown as string, children: [1337] as any }] },
          { name: 'Child3', children: [] },
        ],
      });

      it('should not validate', () => {
        expect(result.success).toEqual(false);
      });

      it('should construct the correct error', () => {
        expectValidationError(result, (result) => {
          expect(result.rawErrors).toEqual({
            success: false,
            type: 'class',
            reason: ValidationErrorType.OBJECT_PROPERTY_FAILED,
            value: expect.anything(),
            context: { className: 'Test' },
            previousErrors: [
              {
                success: false,
                type: 'array',
                reason: ValidationErrorType.ELEMENT_TYPE_FAILED,
                value: expect.anything(),
                context: { element: 1, className: 'Test', propertyName: 'children' },
                previousErrors: [
                  {
                    success: false,
                    type: 'class',
                    reason: ValidationErrorType.OBJECT_PROPERTY_FAILED,
                    value: expect.anything(),
                    context: { className: 'Test' },
                    previousErrors: [
                      {
                        success: false,
                        type: 'array',
                        reason: ValidationErrorType.ELEMENT_TYPE_FAILED,
                        value: expect.anything(),
                        context: { element: 0, className: 'Test', propertyName: 'children' },
                        previousErrors: [
                          {
                            success: false,
                            type: 'class',
                            reason: ValidationErrorType.OBJECT_PROPERTY_FAILED,
                            value: { name: 123, children: [1337] },
                            context: { className: 'Test' },
                            previousErrors: [
                              {
                                success: false,
                                type: 'string',
                                reason: ValidationErrorType.NOT_A_STRING,
                                value: 123,
                                previousErrors: [],
                                context: { className: 'Test', propertyName: 'name' },
                              },
                              {
                                success: false,
                                type: 'array',
                                reason: ValidationErrorType.ELEMENT_TYPE_FAILED,
                                value: [1337],
                                context: { element: 0, className: 'Test', propertyName: 'children' },
                                previousErrors: [
                                  {
                                    success: false,
                                    type: 'class',
                                    reason: ValidationErrorType.NOT_AN_OBJECT,
                                    value: 1337,
                                    previousErrors: [],
                                    context: { className: 'Test' },
                                  },
                                ],
                              },
                            ],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          });
        });
      });
    });
  });

  describe('Omit<T, U>', () => {
    describe('basic', () => {
      const v = new ValidatorInstance({ project });

      type SkippedKeys = 'embeddedProperty1' | 'embeddedProperty2';

      @v.validatorDecorator()
      class TestEmbed {
        embeddedProperty1!: number;
        embeddedProperty2!: number;
        embeddedProperty3?: number;
      }

      @v.validatorDecorator()
      class Test {
        embeddedObject!: Omit<TestEmbed, 'embeddedProperty2'>;
        embeddedObjectMultikey!: Omit<TestEmbed, 'embeddedProperty1' | 'embeddedProperty2'>;
        embeddedObjectMultikeyAlias!: Omit<TestEmbed, SkippedKeys>;
      }

      it('should construct the tree correctly (single propery omitted)', () => {
        const { tree } = v.getPropertyTypeTreesFromConstructor(Test)[0];

        expect(tree).toEqual({
          kind: 'root',
          optional: false,
          children: [
            {
              kind: 'class',
              name: 'TestEmbed',
              children: [],
              annotations: {},
              getClassTrees: expect.any(Function),
              meta: {
                from: 'class',
                reference: expect.any(String),
                omitted: new Set(['embeddedProperty2']),
              },
            },
          ],
          annotations: {},
        } as TypeNodeData);

        expect((tree.children[0] as ClassNode).getClassTrees().map((t) => t.name)).toEqual([
          'embeddedProperty1',
          'embeddedProperty3',
        ]);
      });

      it('should construct the tree correctly (multiple properties omitted)', () => {
        const { tree } = v.getPropertyTypeTreesFromConstructor(Test)[1];

        expect(tree).toEqual({
          kind: 'root',
          optional: false,
          children: [
            {
              kind: 'class',
              name: 'TestEmbed',
              meta: {
                from: 'class',
                reference: expect.any(String),
                omitted: new Set(['embeddedProperty1', 'embeddedProperty2']),
              },
              getClassTrees: expect.any(Function),
              children: [],
              annotations: {},
            },
          ],
          annotations: {},
        } as TypeNodeData);
      });

      it('should construct the tree correctly (aliased)', () => {
        const { tree } = v.getPropertyTypeTreesFromConstructor(Test)[2];

        expect(tree).toEqual({
          kind: 'root',
          optional: false,
          children: [
            {
              kind: 'class',
              name: 'TestEmbed',
              meta: {
                from: 'class',
                reference: expect.any(String),
                omitted: new Set(['embeddedProperty1', 'embeddedProperty2']),
              },
              getClassTrees: expect.any(Function),
              children: [],
              annotations: {},
            },
          ],
          annotations: {},
        });
      });

      it('should validate', () => {
        const result = v.validate(Test, {
          embeddedObject: { embeddedProperty1: 123 },
          embeddedObjectMultikey: {},
          embeddedObjectMultikeyAlias: {},
        });

        expect(result.success).toEqual(true);
      });

      describe('should not validate if attribute is missing', () => {
        const result = v.validate(Test, {
          embeddedObject: { embeddedProperty3: 123 } as any,
          embeddedObjectMultikey: {},
          embeddedObjectMultikeyAlias: {},
        });

        it('should not validate', () => {
          expect(result.success).toEqual(false);
        });

        it('should construct the correct error', () => {
          expectValidationError(result, (result) => {
            expect(result.rawErrors).toEqual({
              success: false,
              type: 'class',
              reason: ValidationErrorType.OBJECT_PROPERTY_FAILED,
              value: expect.anything(),
              previousErrors: [
                {
                  success: false,
                  type: 'class',
                  value: { embeddedProperty3: 123 },
                  context: {
                    className: 'Test',
                    propertyName: 'embeddedObject',
                  },
                  previousErrors: [
                    {
                      success: false,
                      type: 'root',
                      reason: ValidationErrorType.VALUE_REQUIRED,
                      previousErrors: [],
                      context: {
                        className: 'TestEmbed',
                        propertyName: 'embeddedProperty1',
                      },
                    },
                  ],
                  reason: ValidationErrorType.OBJECT_PROPERTY_FAILED,
                },
              ],
              context: { className: 'Test' },
            });
          });
        });
      });

      describe('should not validate if omitted attribute is supplied', () => {
        const result = v.validate(Test, {
          embeddedObject: { embeddedProperty1: 123, embeddedProperty2: 123 } as any,
          embeddedObjectMultikey: {},
          embeddedObjectMultikeyAlias: {},
        });

        it('should not validate', () => {
          expect(result.success).toEqual(false);
        });

        it('should construct the correct error', () => {
          expectValidationError(result, (result) => {
            expect(result.rawErrors).toEqual({
              success: false,
              type: 'class',
              reason: ValidationErrorType.OBJECT_PROPERTY_FAILED,
              value: expect.anything(),
              previousErrors: [
                {
                  success: false,
                  type: 'class',
                  reason: ValidationErrorType.OBJECT_PROPERTY_FAILED,
                  value: { embeddedProperty1: 123, embeddedProperty2: 123 },
                  previousErrors: [
                    {
                      success: false,
                      type: 'class',
                      reason: ValidationErrorType.UNKNOWN_FIELD,
                      value: 123,
                      previousErrors: [],
                      context: {
                        className: 'TestEmbed',
                        propertyName: 'embeddedProperty2',
                      },
                    },
                  ],
                  context: {
                    className: 'Test',
                    propertyName: 'embeddedObject',
                  },
                },
              ],
              context: { className: 'Test' },
            });
          });
        });
      });
    });

    describe('with unsupported type', () => {
      const v = new ValidatorInstance({ project });

      @v.validatorDecorator()
      class Test {
        embeddedObject!: Omit<Record<string, string>, 'embeddedProperty2'>;
      }

      it('should throw ParseError()', () => {
        try {
          v.validate(Test, {
            embeddedObject: { embeddedProperty1: '123' },
          });
        } catch (error) {
          expect(error).toBeInstanceOf(ParseError);
          if (isParseError(error)) {
            expect(error.context.class).toBeTruthy();
            expect(error.context.asText).toBeTruthy();
          }
        }
      });
    });
  });

  describe('Pick<T, U>', () => {
    describe('basic', () => {
      const v = new ValidatorInstance({ project });

      type SkippedKeys = 'embeddedProperty1' | 'embeddedProperty2';

      @v.validatorDecorator()
      class TestEmbed {
        embeddedProperty1!: number;
        embeddedProperty2!: number;
        embeddedProperty3?: number;
      }

      @v.validatorDecorator()
      class Test {
        embeddedObject!: Pick<TestEmbed, 'embeddedProperty2'>;
        embeddedObjectMultikey!: Pick<TestEmbed, 'embeddedProperty1' | 'embeddedProperty2'>;
        embeddedObjectMultikeyAlias!: Pick<TestEmbed, SkippedKeys>;
      }

      it('should construct the tree correctly (single propery picked)', () => {
        const { tree } = v.getPropertyTypeTreesFromConstructor(Test)[0];

        expect(tree).toEqual({
          kind: 'root',
          optional: false,
          children: [
            {
              kind: 'class',
              name: 'TestEmbed',
              children: [],
              getClassTrees: expect.any(Function),
              meta: {
                from: 'class',
                reference: expect.any(String),
                picked: new Set(['embeddedProperty2']),
              },
              annotations: {},
            },
          ],
          annotations: {},
        } as TypeNodeData);
      });

      it('should construct the tree correctly (multiple properties picked)', () => {
        const { tree } = v.getPropertyTypeTreesFromConstructor(Test)[1];

        expect(tree).toEqual({
          kind: 'root',
          optional: false,
          children: [
            {
              kind: 'class',
              name: 'TestEmbed',
              meta: {
                from: 'class',
                reference: expect.any(String),
                picked: new Set(['embeddedProperty1', 'embeddedProperty2']),
              },
              getClassTrees: expect.any(Function),
              children: [],
              annotations: {},
            },
          ],
          annotations: {},
        });
      });

      it('should construct the tree correctly (aliased)', () => {
        const { tree } = v.getPropertyTypeTreesFromConstructor(Test)[2];

        expect(tree).toEqual({
          kind: 'root',
          optional: false,
          children: [
            {
              kind: 'class',
              name: 'TestEmbed',
              meta: {
                from: 'class',
                reference: expect.any(String),
                picked: new Set(['embeddedProperty1', 'embeddedProperty2']),
              },
              getClassTrees: expect.any(Function),
              children: [],
              annotations: {},
            },
          ],
          annotations: {},
        });
      });

      it('should validate', () => {
        const result = v.validate(Test, {
          embeddedObject: { embeddedProperty2: 123 },
          embeddedObjectMultikey: { embeddedProperty1: 1, embeddedProperty2: 2 },
          embeddedObjectMultikeyAlias: { embeddedProperty1: 1, embeddedProperty2: 2 },
        });

        expect(result.success).toEqual(true);
      });

      describe('should not validate', () => {
        const result = v.validate(Test, {
          embeddedObject: { embeddedProperty1: '123', embeddedProperty2: '123', embeddedProperty3: '123' } as any,
          embeddedObjectMultikey: { embeddedProperty1: 1, embeddedProperty2: 2 },
          embeddedObjectMultikeyAlias: { embeddedProperty1: 1, embeddedProperty2: 2 },
        });

        it('should not validate', () => {
          expect(result.success).toEqual(false);
        });
        it('should construct the correct error', () => {
          expectValidationError(result, (result) => {
            expect(result.rawErrors).toEqual({
              success: false,
              type: 'class',
              reason: ValidationErrorType.OBJECT_PROPERTY_FAILED,
              value: expect.anything(),
              previousErrors: [
                {
                  success: false,
                  type: 'class',
                  reason: ValidationErrorType.OBJECT_PROPERTY_FAILED,
                  value: expect.anything(),
                  previousErrors: [
                    {
                      success: false,
                      type: 'number',
                      reason: ValidationErrorType.NOT_A_NUMBER,
                      value: '123',
                      previousErrors: [],
                      context: { className: 'TestEmbed', propertyName: 'embeddedProperty2' },
                    },
                    {
                      success: false,
                      type: 'class',
                      reason: ValidationErrorType.UNKNOWN_FIELD,
                      value: '123',
                      previousErrors: [],
                      context: { className: 'TestEmbed', propertyName: 'embeddedProperty1' },
                    },

                    {
                      success: false,
                      type: 'class',
                      reason: ValidationErrorType.UNKNOWN_FIELD,
                      value: '123',
                      previousErrors: [],
                      context: { className: 'TestEmbed', propertyName: 'embeddedProperty3' },
                    },
                  ],

                  context: { className: 'Test', propertyName: 'embeddedObject' },
                },
              ],
              context: { className: 'Test' },
            });
          });
        });
      });
    });
  });
});
