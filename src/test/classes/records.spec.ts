/* eslint-disable @typescript-eslint/no-shadow */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NumberNode, StringNode, ValidationErrorType } from '../../nodes';
import { ValidatorInstance } from '../../validator';
import { NodeValidationErrorMatcher, RecordNodeFixture, RootNodeFixture } from '../fixtures';
import { expectValidationError, project } from '../utils';

describe('records', () => {
  const v = new ValidatorInstance({ project });

  @v.validatorDecorator()
  class Test {
    recordProperty!: Record<string, number>;
  }

  it('should construct the correct tree', () => {
    const { tree } = v.getPropertyTypeTreesFromConstructor(Test)[0];

    expect(tree).toEqual(
      RootNodeFixture.createRequired({
        children: [
          RecordNodeFixture.create({
            children: [new StringNode(), new NumberNode()],
          }),
        ],
      }),
    );
  });

  it('should validate a record', () => {
    const result = v.validate(Test, { recordProperty: { one: 1, two: 2 } });

    expect(result.success).toEqual(true);
  });

  it('should validate an empty record', () => {
    const result = v.validate(Test, { recordProperty: {} });

    expect(result.success).toEqual(true);
  });

  describe('should not validate an invalid type', () => {
    const result = v.validate(Test, { recordProperty: false as any });

    it('should not validate', () => {
      expect(result.success).toEqual(false);
    });

    it('should construct the correct error', () => {
      expectValidationError(result, (result) => {
        expect(result.rawErrors).toEqual(
          NodeValidationErrorMatcher.singleObjectPropertyFailed(Test.name, 'recordProperty', {
            previousErrors: [NodeValidationErrorMatcher.recordError({ reason: ValidationErrorType.NOT_AN_OBJECT })],
          }),
        );
      });
    });
  });

  describe('should not validate record with invalid value type', () => {
    const result = v.validate(Test, { recordProperty: { one: 'one', two: 2 } as any });

    it('should not validate', () => {
      expect(result.success).toEqual(false);
    });

    it('should construct the correct error', () => {
      expectValidationError(result, (result) => {
        expect(result.rawErrors).toEqual(
          NodeValidationErrorMatcher.singleObjectPropertyFailed(Test.name, 'recordProperty', {
            previousErrors: [
              NodeValidationErrorMatcher.recordError({
                reason: ValidationErrorType.RECORD_PROPERTY_FAILED,
                context: {
                  key: 'one',
                  valueInvalid: true,
                },
                previousErrors: [NodeValidationErrorMatcher.numberError()],
              }),
            ],
          }),
        );
      });
    });

    it('should format the error correctly', () => {
      expectValidationError(result, ({ errors }) => {
        expect(errors).toEqual({
          ['$.recordProperty.one']: {
            message: "Value 'one' (type: string) is not a valid number",
            context: {},
          },
        });
      });
    });
  });
});
