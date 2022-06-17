/* eslint-disable @typescript-eslint/no-explicit-any */
import { ValidationErrorType } from '../../nodes';
import { ValidatorInstance } from '../../validator';
import { expectValidationError, project } from '../utils';

describe('any', () => {
  const v = new ValidatorInstance({ project });

  @v.validatorDecorator()
  class Test {
    property!: any;
  }

  @v.validatorDecorator()
  class TestOptional {
    property?: any;
  }

  @v.validatorDecorator()
  class TestUnknown {
    property!: unknown;
  }

  it('should construct the correct tree for any', () => {
    const { tree } = v.getPropertyTypeTreesFromConstructor(Test)[0];
    expect(tree).toEqual({
      kind: 'root',
      optional: false,
      children: [
        {
          children: [],
          annotations: {},
          kind: 'any',
          reason: expect.any(String),
        },
      ],
      annotations: {},
    });
  });

  it('should construct the correct tree for unknown', () => {
    const { tree } = v.getPropertyTypeTreesFromConstructor(TestUnknown)[0];
    expect(tree).toEqual({
      kind: 'root',
      optional: false,
      children: [
        {
          children: [],
          annotations: {},
          kind: 'any',
          reason: expect.any(String),
        },
      ],
      annotations: {},
    });
  });

  it('should validate anything', () => {
    const result = v.validate(Test, { property: 123 });
    expect(result.success).toEqual(true);
  });

  it('should validate undefined if optional', () => {
    const result = v.validate(TestOptional, {});
    expect(result.success).toEqual(true);
  });

  describe('should not validate', () => {
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
          context: { className: 'Test' },
          value: {},
          previousErrors: [
            {
              success: false,
              type: 'root',
              previousErrors: [],
              reason: ValidationErrorType.VALUE_REQUIRED,
              context: {
                className: 'Test',
                propertyName: 'property',
              },
            },
          ],
        });
      });
    });
  });
});
