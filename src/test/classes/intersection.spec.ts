/* eslint-disable @typescript-eslint/no-explicit-any */
import { TypeNodeData, ValidationErrorType } from '../../nodes';
import { ValidatorInstance } from '../../validator';
import { expectValidationError, genValidationErrorTest, project } from '../utils';

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
  }

  it('should construct the correct tree', () => {
    const { tree } = v.getPropertyTypeTreesFromConstructor(Test)[0];
    expect(tree).toEqual({
      kind: 'root',
      optional: false,
      children: [
        {
          kind: 'intersection',
          meta: { references: expect.anything() },
          name: '{ foo: number; } & { bar: string; } & Generic<number>',
          getAllowedFields: expect.any(Function),
          children: [
            {
              kind: 'class',
              name: expect.any(String),
              children: [],
              annotations: {},
              meta: {
                reference: expect.any(String),
                from: 'object',
              },
              getClassTrees: expect.any(Function),
            },
            {
              kind: 'class',
              name: expect.any(String),
              children: [],
              annotations: {},
              meta: {
                reference: expect.any(String),
                from: 'object',
              },
              getClassTrees: expect.any(Function),
            },
            {
              kind: 'class',
              name: 'Generic',
              children: [],
              annotations: {},
              meta: {
                reference: expect.any(String),
                from: 'class',
              },
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
      property: { foo: 123, bar: 'bar', property: 123 },
    });

    expect(result.success).toEqual(true);
  });

  describe('should not validate', () => {
    const result = v.validate(Test, {
      property: { foo: 123, bar: 'bar', property: 'invalid' } as any,
    });

    genValidationErrorTest(result);

    it('should not validate', () => {
      expect(result.success).toEqual(false);
    });

    it('should construct the correct error', () => {
      expectValidationError(result, (result) => {
        expect(result.rawErrors).toEqual({
          success: false,
          type: 'class',
          value: { property: { foo: 123, bar: 'bar', property: 'invalid' } },
          previousErrors: [
            {
              success: false,
              type: 'intersection',
              value: { foo: 123, bar: 'bar', property: 'invalid' },
              previousErrors: [
                {
                  success: false,
                  type: 'class',
                  value: { foo: 123, bar: 'bar', property: 'invalid' },
                  previousErrors: [
                    {
                      success: false,
                      type: 'number',
                      value: 'invalid',
                      previousErrors: [],
                      reason: 'NOT_A_NUMBER',
                      context: { className: 'Generic', propertyName: 'property' },
                    },
                  ],
                  reason: 'OBJECT_PROPERTY_FAILED',
                  context: { className: 'Generic' },
                },
              ],
              reason: 'OBJECT_PROPERTY_FAILED',
              context: { className: 'Test', propertyName: 'property' },
            },
          ],
          reason: 'OBJECT_PROPERTY_FAILED',
          context: { className: 'Test' },
        });
      });
    });
  });

  describe('should not validate with unknown properties', () => {
    const result = v.validate(Test, {
      property: { foo: 123, bar: 'bar', property: 123, unknownProperty: 'UNKNOWN' } as any,
    });
    genValidationErrorTest(result);
    it('should not validate', () => {
      expect(result.success).toEqual(false);
    });
    it('should construct the correct error', () => {
      expectValidationError(result, (result) => {
        expect(result.rawErrors).toEqual({
          success: false,
          type: 'class',
          reason: ValidationErrorType.OBJECT_PROPERTY_FAILED,
          context: { className: 'Test' },
          value: expect.anything(),
          previousErrors: [
            {
              success: false,
              type: 'intersection',
              reason: ValidationErrorType.OBJECT_PROPERTY_FAILED,
              context: { className: 'Test', propertyName: 'property' },
              value: expect.anything(),
              previousErrors: [
                {
                  success: false,
                  type: 'intersection',
                  reason: ValidationErrorType.UNKNOWN_FIELD,
                  value: 'UNKNOWN',
                  previousErrors: [],
                  context: {
                    className: '{ foo: number; } & { bar: string; } & Generic<number>',
                    propertyName: 'unknownProperty',
                  },
                },
              ],
            },
          ],
        });
      });
    });
  });
});
