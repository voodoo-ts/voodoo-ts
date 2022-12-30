/* eslint-disable @typescript-eslint/no-shadow */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { StringNode, ValidationErrorType } from '../../nodes';
import { ValidatorInstance } from '../../validator';
import {
  NodeValidationErrorMatcher,
  LiteralNodeFixture,
  NumberNodeFixture,
  RootNodeFixture,
  StringNodeFixture,
  UnionNodeFixture,
} from '../fixtures';
import { expectValidationError, project } from '../utils';

describe('union', () => {
  describe('simple -> (string | number)', () => {
    const v = new ValidatorInstance({ project });

    @v.validatorDecorator()
    class Test {
      unionProperty!: string | number;
    }

    it('should validate string', () => {
      const result = v.validate(Test, { unionProperty: 'one' });

      expect(result.success).toEqual(true);
    });

    it('should validate number', () => {
      const result = v.validate(Test, { unionProperty: 2 });

      expect(result.success).toEqual(true);
    });

    describe('should not validate undefined', () => {
      const result = v.validate(Test, {});

      it('should not validate', () => {
        expect(result.success).toEqual(false);
      });

      describe('should construct the correct error', () => {
        it('should not validate', () => {
          expect(result.success).toEqual(false);
        });

        it('should construct the correct error', () => {
          expectValidationError(result, (result) => {
            expect(result.rawErrors).toEqual(
              NodeValidationErrorMatcher.singleObjectPropertyFailed(Test, 'unionProperty', {
                reason: ValidationErrorType.VALUE_REQUIRED,
              }),
            );
          });
        });
      });

      describe('should not validate boolean', () => {
        const result = v.validate(Test, { unionProperty: false } as any);

        expectValidationError(result, (result) => {
          expect(result.rawErrors).toEqual(
            NodeValidationErrorMatcher.singleObjectPropertyFailed(Test.name, 'unionProperty', {
              previousErrors: [
                NodeValidationErrorMatcher.unionError({
                  previousErrors: [NodeValidationErrorMatcher.stringError(), NodeValidationErrorMatcher.numberError()],
                }),
              ],
            }),
          );
        });
      });
    });
  });
  describe('optional ->  (string | number)?', () => {
    const v = new ValidatorInstance({ project });

    @v.validatorDecorator()
    class Test {
      unionProperty?: string | number;
    }

    it('should remove undefined from the root property', () => {
      const { tree } = v.getPropertyTypeTreesFromConstructor(Test)[0];

      expect(tree).toEqual(
        RootNodeFixture.createOptional({
          children: [
            UnionNodeFixture.create({
              children: [StringNodeFixture.create(), NumberNodeFixture.create()],
            }),
          ],
        }),
      );
    });

    it('should validate string', () => {
      const result = v.validate(Test, { unionProperty: 'one' });

      expect(result.success).toEqual(true);
    });

    it('should validate number', () => {
      const result = v.validate(Test, { unionProperty: 2 });

      expect(result.success).toEqual(true);
    });

    it('should validate undefined', () => {
      const result = v.validate(Test, {});

      expect(result.success).toEqual(true);
    });

    describe('should not validate boolean', () => {
      const result = v.validate(Test, { unionProperty: false } as any);

      it('should not validate', () => {
        expect(result.success).toEqual(false);
      });

      it('should construct the correct error', () => {
        expectValidationError(result, (result) => {
          expect(result.rawErrors).toEqual(
            NodeValidationErrorMatcher.singleObjectPropertyFailed(Test.name, 'unionProperty', {
              previousErrors: [
                NodeValidationErrorMatcher.unionError({
                  previousErrors: [NodeValidationErrorMatcher.stringError(), NodeValidationErrorMatcher.numberError()],
                }),
              ],
            }),
          );
        });
      });
    });
  });

  describe('with nesting -> (string | number | TestEmbed)?', () => {
    const v = new ValidatorInstance({ project });

    @v.validatorDecorator()
    class TestEmbed {
      embeddedNumber!: number;
    }

    @v.validatorDecorator()
    class Test {
      unionProperty?: string | number | TestEmbed;
    }

    it('should validate string', () => {
      const result = v.validate(Test, { unionProperty: 'one' });

      expect(result.success).toEqual(true);
    });

    it('should validate number', () => {
      const result = v.validate(Test, { unionProperty: 2 });

      expect(result.success).toEqual(true);
    });

    it('should validate undefined', () => {
      const result = v.validate(Test, {});

      expect(result.success).toEqual(true);
    });

    it('should validate embedded object', () => {
      const result = v.validate(Test, { unionProperty: { embeddedNumber: 123 } });

      expect(result.success).toEqual(true);
    });

    describe('should not validate boolean', () => {
      const result = v.validate(Test, { unionProperty: false } as any);

      it('should not validate', () => {
        expect(result.success).toEqual(false);
      });
      it('should construct the correct error', () => {
        expectValidationError(result, (result) => {
          expect(result.rawErrors).toEqual(
            NodeValidationErrorMatcher.singleObjectPropertyFailed(Test.name, 'unionProperty', {
              previousErrors: [
                NodeValidationErrorMatcher.unionError({
                  previousErrors: [
                    NodeValidationErrorMatcher.stringError(),
                    NodeValidationErrorMatcher.numberError(),
                    NodeValidationErrorMatcher.classNotAObjectError(TestEmbed.name),
                  ],
                }),
              ],
            }),
          );
        });
      });
    });
  });

  describe('null -> (string | null)', () => {
    const v = new ValidatorInstance({ project });

    @v.validatorDecorator()
    class Test {
      unionProperty!: string | null;
    }

    it('should validate string', () => {
      const result = v.validate(Test, { unionProperty: 'one' });

      expect(result.success).toEqual(true);
    });

    it('should validate null', () => {
      const result = v.validate(Test, { unionProperty: null });

      expect(result.success).toEqual(true);
    });

    describe('should not validate undefined', () => {
      const result = v.validate(Test, {});

      it('should not validate', () => {
        expect(result.success).toEqual(false);
      });

      it('should construct the correct error', () => {
        expectValidationError(result, (result) => {
          expect(result.rawErrors).toEqual(
            NodeValidationErrorMatcher.singleObjectPropertyFailed(Test, 'unionProperty', {
              reason: ValidationErrorType.VALUE_REQUIRED,
            }),
          );
        });
      });
    });

    describe('should not validate boolean', () => {
      const result = v.validate(Test, { unionProperty: false } as any);

      it('should not validate', () => {
        expect(result.success).toEqual(false);
      });
      it('should construct the correct error', () => {
        expectValidationError(result, (result) => {
          expect(result.rawErrors).toEqual(
            NodeValidationErrorMatcher.singleObjectPropertyFailed(Test.name, 'unionProperty', {
              previousErrors: [
                NodeValidationErrorMatcher.unionError({
                  previousErrors: [NodeValidationErrorMatcher.nullError(), NodeValidationErrorMatcher.stringError()],
                }),
              ],
            }),
          );
        });
      });
    });
  });

  describe('undefined -> (string | undefined)', () => {
    const v = new ValidatorInstance({ project });

    @v.validatorDecorator()
    class Test {
      unionProperty!: string | undefined;
    }

    it('should construct the tree correctly', () => {
      const { tree } = v.getPropertyTypeTreesFromConstructor(Test)[0];
      expect(tree).toEqual(
        RootNodeFixture.createOptional({
          children: [new StringNode()],
        }),
      );
    });

    it('should validate string', () => {
      const result = v.validate(Test, { unionProperty: 'one' });

      expect(result.success).toEqual(true);
    });

    it('should validate undefined', () => {
      const result = v.validate(Test, {} as any);

      expect(result.success).toEqual(true);
    });

    describe('should not validate null', () => {
      const result = v.validate(Test, { unionProperty: null } as any);

      it('should not validate', () => {
        expect(result.success).toEqual(false);
      });

      it('should construct the correct error', () => {
        expectValidationError(result, (result) => {
          expect(result.rawErrors).toEqual(
            NodeValidationErrorMatcher.singleObjectPropertyFailed(Test.name, 'unionProperty', {
              previousErrors: [NodeValidationErrorMatcher.stringError()],
            }),
          );
        });
      });
    });

    describe('should not validate boolean', () => {
      const result = v.validate(Test, { unionProperty: false } as any);

      it('should not validate', () => {
        expect(result.success).toEqual(false);
      });

      it('should construct the correct error', () => {
        expectValidationError(result, (result) => {
          expect(result.rawErrors).toEqual(
            NodeValidationErrorMatcher.singleObjectPropertyFailed(Test.name, 'unionProperty', {
              previousErrors: [NodeValidationErrorMatcher.stringError()],
            }),
          );
        });
      });
    });
  });

  describe('optional boolean -> boolean | undefined', () => {
    const v = new ValidatorInstance({ project });

    @v.validatorDecorator()
    class Test {
      unionProperty?: boolean | undefined;
    }

    it('should construct the correct tree', () => {
      const { tree } = v.getPropertyTypeTreesFromConstructor(Test)[0];

      expect(tree).toEqual(
        RootNodeFixture.createOptional({
          children: [
            UnionNodeFixture.create({ children: [LiteralNodeFixture.create(false), LiteralNodeFixture.create(true)] }),
          ],
        }),
      );
    });
  });
});
