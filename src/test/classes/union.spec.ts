import { ValidationErrorType } from '../../nodes';
import { IValidatorClassMeta, ValidatorInstance, validatorMetadataKey } from '../../validator';
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

    it('should not validate undefined', () => {
      const result = v.validate(Test, {});

      expectValidationError(result, (result) => {
        expect(result.rawErrors).toEqual({
          unionProperty: {
            success: false,
            type: 'root',
            reason: ValidationErrorType.VALUE_REQUIRED,
            previousErrors: [],
          },
        });
      });
    });

    it('should not validate boolean', () => {
      const result = v.validate(Test, { unionProperty: false } as any);

      expect(result.success).toEqual(false);
      if (!result.success) {
        // Needed for type narrowing
        // expect(result.errors.unionProperty).toBeInstanceOf(Array);
        // expect(result.errors.unionProperty.length).toBeGreaterThan(0);
        // expect(result.errors.unionProperty[0].context?.unionErrors).toBeInstanceOf(Array);

        // const unionPropertyErrors = result.errors.unionProperty[0].context?.unionErrors as IErrorMessage[];
        // expect(unionPropertyErrors.length).toBeGreaterThan(0);
        // expect(unionPropertyErrors).toEqual(['string', 'number']);
        expectValidationError(result, (result) => {
          expect(result.rawErrors).toEqual({
            unionProperty: {
              success: false,
              type: 'union',
              reason: ValidationErrorType.NO_UNION_MATCH,
              value: false,
              context: {},
              previousErrors: [
                {
                  success: false,
                  type: 'string',
                  reason: ValidationErrorType.NOT_A_STRING,
                  value: false,
                  previousErrors: [],
                },
                {
                  success: false,
                  type: 'number',
                  reason: ValidationErrorType.NOT_A_NUMBER,
                  value: false,
                  previousErrors: [],
                },
              ],
            },
          });
        });
      }
    });
  });
  describe('optional ->  (string | number)?', () => {
    const v = new ValidatorInstance({ project });

    @v.validatorDecorator()
    class Test {
      unionProperty?: string | number;
    }

    it('should remove undefined from the root property', () => {
      const validatorMeta = Reflect.getMetadata(validatorMetadataKey, Test) as IValidatorClassMeta;
      const classDeclaration = v.classDiscovery.getClass(Test.name, validatorMeta.filename, validatorMeta.line);
      const trees = v.getPropertyTypeTrees(Test, classDeclaration);
      const tree = trees[0].tree;

      expect(tree).toEqual({
        kind: 'root',
        optional: true,
        children: [
          {
            kind: 'union',
            children: [
              {
                children: [],
                kind: 'string',
                reason: ValidationErrorType.NOT_A_STRING,
              },
              {
                children: [],
                kind: 'number',
                reason: ValidationErrorType.NOT_A_NUMBER,
              },
            ],
          },
        ],
      });

      /*
        Expected:
          RootNode 
          - UnionNode 
            - StringNode
            - NumberNode
       */
      // expect(trees[0].tree.kind).toEqual('root');
      // expect(trees[0].tree.children.length).toEqual(1);
      // expect(trees[0].tree.children[0].kind).toEqual('union');
      // expect(trees[0].tree.children[0].children.length).toEqual(2);
      // expect(trees[0].tree.children[0].children.map((c) => c.kind)).toEqual(['string', 'number']);
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

    it('should not validate boolean', () => {
      const result = v.validate(Test, { unionProperty: false } as any);

      expectValidationError(result, (result) => {
        expect(result.rawErrors).toEqual({
          unionProperty: {
            success: false,
            type: 'union',
            reason: ValidationErrorType.NO_UNION_MATCH,
            context: {},
            value: false,
            previousErrors: [
              {
                success: false,
                type: 'string',
                reason: ValidationErrorType.NOT_A_STRING,
                value: false,
                previousErrors: [],
              },
              {
                success: false,
                type: 'number',
                reason: ValidationErrorType.NOT_A_NUMBER,
                value: false,
                previousErrors: [],
              },
            ],
          },
        });
      });

      // expect(result.success).toEqual(false);
      // if (!result.success) {
      //   // Needed for type narrowing
      //   expect(result.errors.unionProperty).toBeInstanceOf(Array);
      //   expect(result.errors.unionProperty.length).toBeGreaterThan(0);
      //   expect(result.errors.unionProperty[0].context?.unionErrors).toBeInstanceOf(Array);
      //   const unionPropertyError = result.errors.unionProperty[0].context?.unionErrors as unknown[];
      //   expect(unionPropertyError.length).toBeGreaterThan(0);
      // }
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

    it('should not validate boolean', () => {
      const result = v.validate(Test, { unionProperty: false } as any);

      expectValidationError(result, (result) => {
        expect(result.rawErrors).toEqual({
          unionProperty: {
            success: false,
            type: 'union',
            reason: ValidationErrorType.NO_UNION_MATCH,
            context: {},
            value: false,
            previousErrors: [
              {
                success: false,
                type: 'string',
                reason: ValidationErrorType.NOT_A_STRING,
                value: false,
                previousErrors: [],
              },
              {
                success: false,
                type: 'number',
                reason: ValidationErrorType.NOT_A_NUMBER,
                value: false,
                previousErrors: [],
              },
              {
                success: false,
                type: 'class',
                reason: ValidationErrorType.NOT_AN_OBJECT,
                value: false,
                context: { name: 'TestEmbed' },
                previousErrors: [],
              },
            ],
          },
        });
      });
      // expect(result.success).toEqual(false);
      // if (!result.success) {
      //   // Needed for type narrowing
      //   expect(result.errors.unionProperty).toBeInstanceOf(Array);
      //   expect(result.errors.unionProperty.length).toBeGreaterThan(0);
      //   expect(result.errors.unionProperty[0].context?.unionErrors).toBeInstanceOf(Array);
      //   const unionPropertyError = result.errors.unionProperty[0].context?.unionErrors as unknown[];
      //   expect(unionPropertyError.length).toBeGreaterThan(0);
      // }
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

    it('should not validate undefined', () => {
      const result = v.validate(Test, {});

      expectValidationError(result, (result) => {
        expect(result.rawErrors).toEqual({
          unionProperty: {
            success: false,
            type: 'root',
            reason: ValidationErrorType.VALUE_REQUIRED,
            previousErrors: [],
          },
        });
      });

      // expect(result.success).toEqual(false);
      // if (!result.success) {
      //   expect(result.errors.unionProperty).toBeInstanceOf(Array);
      //   expect(result.errors.unionProperty.length).toEqual(1);
      //   expect(result.errors.unionProperty[0].reason).toEqual(ValidationErrorType.VALUE_REQUIRED);
      // }
    });

    it('should not validate boolean', () => {
      const result = v.validate(Test, { unionProperty: false } as any);

      expectValidationError(result, (result) => {
        expect(result.rawErrors).toEqual({
          unionProperty: {
            success: false,
            type: 'union',
            reason: ValidationErrorType.NO_UNION_MATCH,
            value: false,
            context: {},
            previousErrors: [
              {
                success: false,
                type: 'null',
                reason: ValidationErrorType.NOT_NULL,
                value: false,
                previousErrors: [],
              },
              {
                success: false,
                type: 'string',
                reason: ValidationErrorType.NOT_A_STRING,
                value: false,
                previousErrors: [],
              },
            ],
          },
        });
      });

      // expect(result.success).toEqual(false);
      // if (!result.success) {
      //   // Needed for type narrowing
      //   expect(result.errors.unionProperty).toBeInstanceOf(Array);
      //   expect(result.errors.unionProperty.length).toBeGreaterThan(0);
      //   expect(result.errors.unionProperty[0].context?.unionErrors).toBeInstanceOf(Array);

      //   const unionPropertyErrors = result.errors.unionProperty[0].context?.unionErrors as IErrorMessage[];
      //   expect(unionPropertyErrors.length).toBeGreaterThan(0);
      //   expect(unionPropertyErrors).toEqual(['null', 'string']);
      // }
    });
  });

  describe('undefined -> (string | undefined)', () => {
    const v = new ValidatorInstance({ project });

    @v.validatorDecorator()
    class Test {
      unionProperty!: string | undefined;
    }

    it('should construct the tree correctly', () => {
      const validatorMeta = Reflect.getMetadata(validatorMetadataKey, Test) as IValidatorClassMeta;
      const classDeclaration = v.classDiscovery.getClass(Test.name, validatorMeta.filename, validatorMeta.line);
      const trees = v.getPropertyTypeTrees(Test, classDeclaration);
      const unionPropertyTree = trees[0].tree;

      expect(unionPropertyTree).toEqual({
        kind: 'root',
        optional: true,
        children: [
          {
            children: [],
            reason: ValidationErrorType.NOT_A_STRING,
            kind: 'string',
          },
        ],
      });
    });

    it('should validate string', () => {
      const result = v.validate(Test, { unionProperty: 'one' });

      expect(result.success).toEqual(true);
    });

    it('should validate undefined', () => {
      const result = v.validate(Test, {} as any);

      expect(result.success).toEqual(true);
    });

    it('should not validate null', () => {
      const result = v.validate(Test, { unionProperty: null } as any);

      expectValidationError(result, (result) => {
        expect(result.rawErrors).toEqual({
          unionProperty: {
            success: false,
            type: 'string',
            reason: ValidationErrorType.NOT_A_STRING,
            value: null,
            previousErrors: [],
          },
        });
      });

      // expect(result.success).toEqual(false);
    });

    it('should not validate boolean', () => {
      const result = v.validate(Test, { unionProperty: false } as any);

      expectValidationError(result, (result) => {
        expect(result.rawErrors).toEqual({
          unionProperty: {
            success: false,
            type: 'string',
            reason: ValidationErrorType.NOT_A_STRING,
            value: false,
            previousErrors: [],
          },
        });
      });

      // expect(result.success).toEqual(false);
      // if (!result.success) {
      //   // Needed for type narrowing
      //   expect(result.errors.unionProperty).toBeInstanceOf(Array);
      //   expect(result.errors.unionProperty.length).toBeGreaterThan(0);
      //   expect(result.errors.unionProperty[0].reason).toEqual(ValidationErrorType.NOT_A_STRING);
      // }
    });
  });
});
