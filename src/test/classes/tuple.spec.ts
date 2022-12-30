/* eslint-disable @typescript-eslint/no-shadow */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { BooleanNode, NumberNode, StringNode, ValidationErrorType } from '../../nodes';
import { ValidatorInstance } from '../../validator';
import { NodeValidationErrorMatcher, RootNodeFixture, TupleNodeFixture } from '../fixtures';
import { expectValidationError, project } from '../utils';

describe('tuple', () => {
  const v = new ValidatorInstance({ project });

  @v.validatorDecorator()
  class Test {
    tupleProperty!: [number, string, boolean];
  }

  it('should construct the correct tree', () => {
    const { tree } = v.getPropertyTypeTreesFromConstructor(Test)[0];
    expect(tree).toEqual(
      RootNodeFixture.createRequired({
        children: [
          TupleNodeFixture.create({
            children: [new NumberNode(), new StringNode(), new BooleanNode()],
          }),
        ],
      }),
    );
  });

  it('should validate valid tuples', () => {
    const result = v.validate(Test, { tupleProperty: [1, 'two', false] });

    expect(result.success).toEqual(true);
  });

  describe('should not validate empty tuples', () => {
    const result = v.validate(Test, { tupleProperty: [] as any });

    it('should not validate', () => {
      expect(result.success).toEqual(false);
    });
    it('should construct the correct error', () => {
      expectValidationError(result, (result) => {
        expect(result.rawErrors).toEqual(
          NodeValidationErrorMatcher.singleObjectPropertyFailed(Test, 'tupleProperty', {
            previousErrors: [
              NodeValidationErrorMatcher.tupleError({
                reason: ValidationErrorType.NO_LENGTH_MATCH,
              }),
            ],
          }),
        );
      });
    });
  });

  describe('should fail for invalid tuple elements', () => {
    const result = v.validate(Test, { tupleProperty: [1, 'two', 'three'] } as any);

    it('should not validate', () => {
      expect(result.success).toEqual(false);
    });

    it('should construct the correct error', () => {
      expectValidationError(result, (result) => {
        expect(result.rawErrors).toEqual(
          NodeValidationErrorMatcher.singleObjectPropertyFailed(Test, 'tupleProperty', {
            previousErrors: [
              NodeValidationErrorMatcher.tupleError({
                previousErrors: [
                  NodeValidationErrorMatcher.tupleItemError({
                    context: { element: 2 },
                    previousErrors: [NodeValidationErrorMatcher.booleanError()],
                  }),
                ],
              }),
            ],
          }),
        );
      });
    });
  });

  describe('should fail for invalid types', () => {
    const result = v.validate(Test, { tupleProperty: 123 } as any);

    it('should not validate', () => {
      expect(result.success).toEqual(false);
    });

    it('should construct the correct error', () => {
      expectValidationError(result, (result) => {
        expect(result.rawErrors).toEqual(
          NodeValidationErrorMatcher.singleObjectPropertyFailed(Test, 'tupleProperty', {
            previousErrors: [
              NodeValidationErrorMatcher.tupleError({
                reason: ValidationErrorType.NOT_AN_ARRAY,
              }),
            ],
          }),
        );
      });
    });
  });

  describe('should fail if property is undefined', () => {
    const result = v.validate(Test, {} as any);

    it('should not validate', () => {
      expect(result.success).toEqual(false);
    });

    it('should construct the correct error', () => {
      expectValidationError(result, (result) => {
        expect(result.rawErrors).toEqual(
          NodeValidationErrorMatcher.singleObjectPropertyFailed(Test, 'tupleProperty', {
            reason: ValidationErrorType.VALUE_REQUIRED,
          }),
        );
      });
    });
  });
});
