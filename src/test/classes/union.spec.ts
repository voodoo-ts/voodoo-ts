import { TypeNodeData, ValidationErrorType } from '../../nodes';
import { ValidatorInstance } from '../../validator';
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
            expect(result.rawErrors).toEqual({
              success: false,
              type: 'class',
              reason: ValidationErrorType.OBJECT_PROPERTY_FAILED,
              value: {},
              context: { className: 'Test' },
              previousErrors: [
                {
                  success: false,
                  type: 'root',
                  previousErrors: [],
                  reason: ValidationErrorType.VALUE_REQUIRED,
                  context: {
                    className: 'Test',
                    propertyName: 'unionProperty',
                  },
                },
              ],
            });
          });
        });
      });

      describe('should not validate boolean', () => {
        const result = v.validate(Test, { unionProperty: false } as any);

        expectValidationError(result, (result) => {
          expect(result.rawErrors).toEqual({
            success: false,
            type: 'class',
            reason: ValidationErrorType.OBJECT_PROPERTY_FAILED,
            value: { unionProperty: false },
            context: { className: 'Test' },
            previousErrors: [
              {
                success: false,
                type: 'union',
                reason: ValidationErrorType.NO_UNION_MATCH,
                context: {
                  className: 'Test',
                  propertyName: 'unionProperty',
                },
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
            ],
          });
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

      expect(tree).toEqual({
        kind: 'root',
        optional: true,
        children: [
          {
            kind: 'union',
            children: [
              {
                children: [],
                annotations: {},
                kind: 'string',
                reason: ValidationErrorType.NOT_A_STRING,
              },
              {
                children: [],
                annotations: {},
                kind: 'number',
                reason: ValidationErrorType.NOT_A_NUMBER,
              },
            ],
            annotations: {},
          },
        ],
        annotations: {},
      });
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
          expect(result.rawErrors).toEqual({
            success: false,
            type: 'class',
            reason: ValidationErrorType.OBJECT_PROPERTY_FAILED,
            value: { unionProperty: false },
            context: { className: 'Test' },
            previousErrors: [
              {
                success: false,
                type: 'union',
                reason: ValidationErrorType.NO_UNION_MATCH,
                value: false,
                context: {
                  className: 'Test',
                  propertyName: 'unionProperty',
                },
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
            ],
          });
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
          expect(result.rawErrors).toEqual({
            success: false,
            type: 'class',
            reason: ValidationErrorType.OBJECT_PROPERTY_FAILED,
            value: { unionProperty: false },
            context: { className: 'Test' },
            previousErrors: [
              {
                success: false,
                type: 'union',
                reason: ValidationErrorType.NO_UNION_MATCH,
                value: false,
                context: {
                  className: 'Test',
                  propertyName: 'unionProperty',
                },
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
                    previousErrors: [],
                    context: { className: 'TestEmbed' },
                  },
                ],
              },
            ],
          });
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
          expect(result.rawErrors).toEqual({
            success: false,
            type: 'class',
            reason: ValidationErrorType.OBJECT_PROPERTY_FAILED,
            value: {},
            context: { className: 'Test' },
            previousErrors: [
              {
                success: false,
                type: 'root',
                reason: ValidationErrorType.VALUE_REQUIRED,
                previousErrors: [],
                context: {
                  className: 'Test',
                  propertyName: 'unionProperty',
                },
              },
            ],
          });
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
          expect(result.rawErrors).toEqual({
            success: false,
            type: 'class',
            reason: ValidationErrorType.OBJECT_PROPERTY_FAILED,
            value: { unionProperty: false },
            context: { className: 'Test' },
            previousErrors: [
              {
                success: false,
                type: 'union',
                reason: ValidationErrorType.NO_UNION_MATCH,
                value: false,
                context: { className: 'Test', propertyName: 'unionProperty' },
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
            ],
          });
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

      expect(tree).toEqual({
        kind: 'root',
        optional: true,
        children: [
          {
            kind: 'string',
            reason: ValidationErrorType.NOT_A_STRING,
            annotations: {},
            children: [],
          },
        ],
        annotations: {},
      } as TypeNodeData);
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
          expect(result.rawErrors).toEqual({
            success: false,
            type: 'class',
            reason: ValidationErrorType.OBJECT_PROPERTY_FAILED,
            value: { unionProperty: null },
            context: { className: 'Test' },
            previousErrors: [
              {
                success: false,
                type: 'string',
                reason: ValidationErrorType.NOT_A_STRING,
                value: null,
                previousErrors: [],
                context: {
                  className: 'Test',
                  propertyName: 'unionProperty',
                },
              },
            ],
          });
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
          expect(result.rawErrors).toEqual({
            success: false,
            type: 'class',
            reason: ValidationErrorType.OBJECT_PROPERTY_FAILED,
            value: { unionProperty: false },
            context: { className: 'Test' },
            previousErrors: [
              {
                success: false,
                type: 'string',
                reason: ValidationErrorType.NOT_A_STRING,
                value: false,
                previousErrors: [],
                context: { className: 'Test', propertyName: 'unionProperty' },
              },
            ],
          });
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

      expect(tree).toEqual({
        kind: 'root',
        optional: true,
        children: [
          {
            annotations: {},
            kind: 'union',
            children: [
              {
                kind: 'literal',
                reason: expect.anything(),
                expected: false,
                children: [],
                annotations: {},
              },
              {
                kind: 'literal',
                reason: expect.anything(),
                expected: true,
                children: [],
                annotations: {},
              },
            ],
          },
        ],
        annotations: {},
      });
    });
  });
});
