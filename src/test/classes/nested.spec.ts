/* eslint-disable @typescript-eslint/no-shadow */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { ParseError } from '../../errors';
import { ClassNode, ValidationErrorType } from '../../nodes';
import { ValidatorInstance } from '../../validator';
import { isParseError } from '../../validator-parser';
import { ArrayNodeFixture, ClassNodeFixture, NodeValidationErrorMatcher, RootNodeFixture } from '../fixtures';
import { expectValidationError, project } from '../utils';

describe('nested', () => {
  const v = new ValidatorInstance({ project });

  describe(`simple`, () => {
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
          expect(result.rawErrors).toEqual(
            NodeValidationErrorMatcher.singleObjectPropertyFailed(Test, 'embeddedObject', {
              previousErrors: [
                NodeValidationErrorMatcher.singleObjectPropertyFailed(TestEmbed, 'embeddedProperty', {
                  reason: ValidationErrorType.VALUE_REQUIRED,
                }),
              ],
            }),
          );
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
          expect(result.rawErrors).toEqual(
            NodeValidationErrorMatcher.singleObjectPropertyFailed(Test, 'embeddedObject', {
              previousErrors: [
                NodeValidationErrorMatcher.singleObjectPropertyFailed(TestEmbed, 'embeddedProperty', {
                  previousErrors: [NodeValidationErrorMatcher.numberError()],
                }),
              ],
            }),
          );
        });
      });
    });
  });

  describe(`Partial<T>`, () => {
    @v.validatorDecorator()
    class TestEmbed {
      embeddedProperty!: number;
    }

    @v.validatorDecorator()
    class Test {
      embeddedObject!: Partial<TestEmbed>;
    }

    it('should construct the correct tree', () => {
      const { tree } = v.getPropertyTypeTreesFromConstructor(Test)[0];
      expect(tree).toEqual(
        RootNodeFixture.createRequired({
          children: [ClassNodeFixture.createForClass(TestEmbed, { partial: true })],
        }),
      );
    });

    it('should validate', () => {
      const result = v.validate(Test, { embeddedObject: { embeddedProperty: 123 } });

      expect(result.success).toEqual(true);
    });

    it('should validate if attribute is missing', () => {
      const result = v.validate(Test, { embeddedObject: {} });

      expect(result.success).toEqual(true);
    });
  });

  describe(`cycle`, () => {
    @v.validatorDecorator()
    class Test {
      name!: string;
      children!: Test[];
    }

    it('should construct the correct tree', () => {
      const { tree } = v.getPropertyTypeTreesFromConstructor(Test)[1];
      expect(tree).toEqual(
        RootNodeFixture.createRequired({
          children: [
            ArrayNodeFixture.create({
              children: [ClassNodeFixture.createForClass(Test)],
            }),
          ],
        }),
      );
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
          expect(result.rawErrors).toEqual(
            NodeValidationErrorMatcher.singleObjectPropertyFailed(Test, 'children', {
              previousErrors: [
                NodeValidationErrorMatcher.arrayError({
                  previousErrors: [
                    NodeValidationErrorMatcher.arrayItemError({
                      context: { element: 1 },
                      previousErrors: [
                        NodeValidationErrorMatcher.singleObjectPropertyFailed(Test, 'children', {
                          previousErrors: [
                            NodeValidationErrorMatcher.arrayError({
                              previousErrors: [
                                NodeValidationErrorMatcher.arrayItemError({
                                  context: { element: 0 },
                                  previousErrors: [
                                    NodeValidationErrorMatcher.objectPropertyFailed(Test, {
                                      previousErrors: [
                                        NodeValidationErrorMatcher.rootError(Test, 'name', {
                                          previousErrors: [NodeValidationErrorMatcher.stringError()],
                                        }),
                                        NodeValidationErrorMatcher.rootError(Test, 'children', {
                                          previousErrors: [
                                            NodeValidationErrorMatcher.arrayError({
                                              previousErrors: [
                                                NodeValidationErrorMatcher.arrayItemError({
                                                  context: { element: 0 },
                                                  previousErrors: [
                                                    NodeValidationErrorMatcher.classNotAObjectError(Test),
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

        expect(tree).toEqual(
          RootNodeFixture.createRequired({
            children: [
              ClassNodeFixture.createForClass(TestEmbed, {
                omitted: new Set(['embeddedProperty2']),
              }),
            ],
          }),
        );

        expect((tree.children[0] as ClassNode).getClassTrees().map((t) => t.name)).toEqual([
          'embeddedProperty1',
          'embeddedProperty3',
        ]);
      });

      it('should construct the tree correctly (multiple properties omitted)', () => {
        const { tree } = v.getPropertyTypeTreesFromConstructor(Test)[1];

        expect(tree).toEqual(
          RootNodeFixture.createRequired({
            children: [
              ClassNodeFixture.createForClass(TestEmbed, {
                omitted: new Set(['embeddedProperty1', 'embeddedProperty2']),
              }),
            ],
          }),
        );
      });

      it('should construct the tree correctly (aliased)', () => {
        const { tree } = v.getPropertyTypeTreesFromConstructor(Test)[2];

        expect(tree).toEqual(
          RootNodeFixture.createRequired({
            children: [
              ClassNodeFixture.createForClass(TestEmbed, {
                omitted: new Set(['embeddedProperty1', 'embeddedProperty2']),
              }),
            ],
          }),
        );
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
            expect(result.rawErrors).toEqual(
              NodeValidationErrorMatcher.singleObjectPropertyFailed(Test, 'embeddedObject', {
                previousErrors: [
                  NodeValidationErrorMatcher.singleObjectPropertyFailed(TestEmbed, 'embeddedProperty1', {
                    reason: ValidationErrorType.VALUE_REQUIRED,
                    previousErrors: [],
                  }),
                ],
              }),
            );
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
            expect(result.rawErrors).toEqual(
              NodeValidationErrorMatcher.singleObjectPropertyFailed(Test, 'embeddedObject', {
                previousErrors: [
                  NodeValidationErrorMatcher.objectPropertyFailed(TestEmbed, {
                    previousErrors: [NodeValidationErrorMatcher.objectPropertyUnknown(TestEmbed, 'embeddedProperty2')],
                  }),
                ],
              }),
            );
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

        expect(tree).toEqual(
          RootNodeFixture.createRequired({
            children: [
              ClassNodeFixture.createForClass(TestEmbed, {
                picked: new Set(['embeddedProperty2']),
              }),
            ],
          }),
        );
      });

      it('should construct the tree correctly (multiple properties picked)', () => {
        const { tree } = v.getPropertyTypeTreesFromConstructor(Test)[1];

        expect(tree).toEqual(
          RootNodeFixture.createRequired({
            children: [
              ClassNodeFixture.createForClass(TestEmbed, {
                picked: new Set(['embeddedProperty1', 'embeddedProperty2']),
              }),
            ],
          }),
        );

        const node = tree.children[0] as ClassNode;
        expect(node.getClassTrees()).toEqual(
          expect.arrayContaining([{ name: 'embeddedProperty2', tree: expect.anything() }]),
        );
      });

      it('should construct the tree correctly (aliased)', () => {
        const { tree } = v.getPropertyTypeTreesFromConstructor(Test)[2];

        expect(tree).toEqual(
          RootNodeFixture.createRequired({
            children: [
              ClassNodeFixture.createForClass(TestEmbed, {
                picked: new Set(['embeddedProperty1', 'embeddedProperty2']),
              }),
            ],
          }),
        );

        const node = tree.children[0] as ClassNode;
        expect(node.getClassTrees()).toEqual(
          expect.arrayContaining([
            { name: 'embeddedProperty1', tree: expect.anything() },
            { name: 'embeddedProperty2', tree: expect.anything() },
          ]),
        );
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
            expect(result.rawErrors).toEqual(
              NodeValidationErrorMatcher.singleObjectPropertyFailed(Test, 'embeddedObject', {
                previousErrors: [
                  NodeValidationErrorMatcher.objectPropertyFailed(TestEmbed, {
                    previousErrors: [
                      NodeValidationErrorMatcher.rootError(TestEmbed, 'embeddedProperty2', {
                        previousErrors: [NodeValidationErrorMatcher.numberError()],
                      }),
                      NodeValidationErrorMatcher.objectPropertyUnknown(TestEmbed, 'embeddedProperty1'),
                      NodeValidationErrorMatcher.objectPropertyUnknown(TestEmbed, 'embeddedProperty3'),
                    ],
                  }),
                ],
              }),
            );
          });
        });
      });
    });
  });
});
