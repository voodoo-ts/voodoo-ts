import { ParseError } from '../../errors';
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

    it('should not validate if attribute is missing', () => {
      const result = v.validate(Test, { embeddedObject: {} } as any);

      expectValidationError(result, (result) => {
        expect(result.rawErrors).toEqual({
          embeddedObject: {
            success: false,
            type: 'class',
            value: {},
            reason: 'OBJECT_PROPERTY_FAILED',
            context: { name: 'TestEmbed' },
            previousErrors: [
              {
                success: false,
                type: 'root',
                reason: 'VALUE_REQUIRED',
                context: { propertyName: 'embeddedProperty', name: 'TestEmbed' },
                previousErrors: [],
              },
            ],
          },
        });
      });
    });

    it('should not validate if attribute has invalid type', () => {
      const result = v.validate(Test, { embeddedObject: { embeddedProperty: null } } as any);

      expectValidationError(result, (result) => {
        expect(result.rawErrors).toEqual({
          embeddedObject: {
            success: false,
            type: 'class',
            reason: 'OBJECT_PROPERTY_FAILED',
            value: { embeddedProperty: null },
            previousErrors: [
              {
                success: false,
                type: 'number',
                reason: 'NOT_A_NUMBER',
                value: null,
                previousErrors: [],
                context: { propertyName: 'embeddedProperty', name: 'TestEmbed' },
              },
            ],
            context: { name: 'TestEmbed' },
          },
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

    it('should not validate invalid input', () => {
      const result = v.validate(Test, {
        name: 'root',
        children: [
          { name: 'Child1', children: [] },
          { name: 'Child2', children: [{ name: 123 as unknown as string, children: [1337] as any }] },
          { name: 'Child3', children: [] },
        ],
      });

      expectValidationError(result, (result) => {
        expect(result.rawErrors).toEqual({
          children: {
            success: false,
            type: 'array',
            reason: 'ELEMENT_TYPE_FAILED',
            value: expect.anything(),
            context: { element: 1 },
            previousErrors: [
              {
                success: false,
                type: 'class',
                reason: 'OBJECT_PROPERTY_FAILED',
                value: { name: 'Child2', children: [{ name: 123, children: [1337] }] },
                context: { name: 'Test' },
                previousErrors: [
                  {
                    success: false,
                    type: 'array',
                    reason: 'ELEMENT_TYPE_FAILED',
                    value: [{ name: 123, children: [1337] }],
                    context: { element: 0, propertyName: 'children', name: 'Test' },
                    previousErrors: [
                      {
                        success: false,
                        type: 'class',
                        reason: 'OBJECT_PROPERTY_FAILED',
                        value: { name: 123, children: [1337] },
                        context: { name: 'Test' },
                        previousErrors: [
                          {
                            success: false,
                            type: 'string',
                            reason: 'NOT_A_STRING',
                            value: 123,
                            context: { propertyName: 'name', name: 'Test' },
                            previousErrors: [],
                          },
                          {
                            success: false,
                            type: 'array',
                            value: [1337],
                            reason: 'ELEMENT_TYPE_FAILED',
                            context: { element: 0, propertyName: 'children', name: 'Test' },
                            previousErrors: [
                              {
                                success: false,
                                type: 'class',
                                value: 1337,
                                previousErrors: [],
                                reason: 'NOT_AN_OBJECT',
                                context: { name: 'Test' },
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
        const { filename, line } = v.getClassMetadata(Test);
        const cls = v.classDiscovery.getClass('Test', filename, line);
        const trees = v.getPropertyTypeTrees(Test, cls);
        const tree = trees[0].tree;

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
                omitted: new Set(['embeddedProperty2']),
              },
            },
          ],
        });
      });

      it('should construct the tree correctly (multiple properties omitted)', () => {
        const { filename, line } = v.getClassMetadata(Test);
        const cls = v.classDiscovery.getClass('Test', filename, line);
        const trees = v.getPropertyTypeTrees(Test, cls);
        const tree = trees[1].tree;

        expect(tree).toEqual({
          kind: 'root',
          optional: false,
          children: [
            {
              kind: 'class',
              name: 'TestEmbed',
              meta: {
                omitted: new Set(['embeddedProperty1', 'embeddedProperty2']),
              },
              getClassTrees: expect.any(Function),
              children: [],
            },
          ],
        });
      });

      it('should construct the tree correctly (aliased)', () => {
        const { filename, line } = v.getClassMetadata(Test);
        const cls = v.classDiscovery.getClass('Test', filename, line);
        const trees = v.getPropertyTypeTrees(Test, cls);
        const tree = trees[2].tree;

        expect(tree).toEqual({
          kind: 'root',
          optional: false,
          children: [
            {
              kind: 'class',
              name: 'TestEmbed',
              meta: {
                omitted: new Set(['embeddedProperty1', 'embeddedProperty2']),
              },
              getClassTrees: expect.any(Function),
              children: [],
            },
          ],
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
});
