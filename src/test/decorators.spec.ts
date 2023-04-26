/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/no-shadow */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { NodeValidationErrorFixture, RootNodeFixture, StringNodeFixture } from './fixtures';
import { project } from './utils';
import {
  getAnnotations,
  LengthValidationError,
  NumberListValidationError,
  StringValidationError,
  Validate,
  validateIntegerString,
  validateLength,
  validateNumberList,
  validateNumberString,
  validateRange,
} from '../decorators';
import { formatErrors } from '../error-formatter';
import { INodeValidationResult, IPropertyValidatorCallbackArguments } from '../nodes';
import { ValidatorInstance } from '../validator';

describe('decorators', () => {
  describe('generic validator - @Validate()', () => {
    beforeEach(() => {
      callback.mockClear();
    });

    const v = new ValidatorInstance({ project });

    const callbackFunc: (args: IPropertyValidatorCallbackArguments) => INodeValidationResult = ({
      value,
      success,
      fail,
    }) => {
      return value === 'TEST' ? success() : fail({});
    };
    const callback = jest.fn(callbackFunc);

    @v.transformerDecorator()
    class Test {
      @Validate(callback)
      testProperty!: string;
    }

    it('should store the metadata correctly', () => {
      const annotations = getAnnotations(Test.prototype, 'testProperty');

      expect(annotations).toEqual([
        {
          type: 'root',
          name: 'validationFunctions',
          value: [callback],
        },
      ]);
    });

    it('should construct the correct tree', () => {
      const trees = v.getPropertyTypeTreesFromConstructor(Test);

      expect(trees.length).toEqual(1);
      expect(trees[0].tree).toEqual(
        RootNodeFixture.createRequired({
          annotations: { validationFunctions: [callback] },
          children: [StringNodeFixture.create({})],
        }),
      );
    });

    it('should validate a valid string', () => {
      const result = v.validate(Test, { testProperty: 'TEST' });
      expect(result.success).toBeTrue();
      expect(callback).toHaveBeenCalledOnce();
    });

    it('should not call the validator if type is invalid', () => {
      const result = v.validate(Test, { testProperty: null } as any);
      expect(result.success).toBeFalse();
      expect(callback).not.toBeCalled();
    });

    it('should not validate a string that fails the constraint', () => {
      const result = v.validate(Test, { testProperty: 'NOT_TEST' });
      expect(result.success).toBeFalse();
      expect(callback).toHaveBeenCalledOnce();
    });
  });

  describe('helpers', () => {
    const sentinel = {};
    const mockSuccess = jest.fn(() => sentinel as any);
    const mockFail = jest.fn(() => sentinel as any);
    const mockCallbackArgs = <R>(value: R) => ({
      value,
      values: {},
      success: mockSuccess,
      fail: mockFail,
    });
    beforeEach(() => {
      mockSuccess.mockClear();
      mockFail.mockClear();
    });

    describe('validateIntegerString()', () => {
      describe('base 10', () => {
        it.each([['0'], ['100'], ['+100'], ['-100']])('should validate "%s"', (str) => {
          const result = validateIntegerString(mockCallbackArgs(str), 10);
          expect(result).toEqual(sentinel);
          expect(mockSuccess).toHaveBeenCalled();
        });

        it.each([['f'], ['12f'], ['f12'], ['+-100'], ['-+100'], ['']])('should not validate "%s"', (str) => {
          const result = validateIntegerString(mockCallbackArgs(str), 10);
          expect(result).toEqual(sentinel);
          expect(mockFail).toHaveBeenCalledWith(str, { reason: StringValidationError.NOT_A_INTEGER_STRING });
        });
      });

      describe('base 16', () => {
        it.each([['0'], ['100'], ['0xff'], ['ff']])('should validate "%s"', (str) => {
          const result = validateIntegerString(mockCallbackArgs(str), 16);
          expect(result).toEqual(sentinel);
          expect(mockSuccess).toHaveBeenCalled();
        });

        it.each([['0xx'], ['xx'], ['-100'], ['+-100'], ['-+100'], ['']])('should not validate "%s"', (str) => {
          const result = validateIntegerString(mockCallbackArgs(str), 16);
          expect(result).toEqual(sentinel);
          expect(mockFail).toHaveBeenCalledWith(str, { reason: StringValidationError.NOT_A_INTEGER_STRING });
        });
      });
    });

    describe('validateNumberString()', () => {
      it.each([['3.141592'], ['1'], ['-1'], ['-0'], ['1e6']])('should validate %s', (str) => {
        const result = validateNumberString(mockCallbackArgs(str));
        expect(result).toEqual(sentinel);
        expect(mockSuccess).toHaveBeenCalled();
      });
      it.each([[''], ['+-1'], ['a'], ['1a2b3c']])('should not validate %s', (str) => {
        const result = validateNumberString(mockCallbackArgs(str));
        expect(result).toEqual(sentinel);
        expect(mockFail).toHaveBeenCalledWith(str, { reason: StringValidationError.NOT_A_NUMBER_STRING });
      });
    });

    describe('validateNumberList()', () => {
      const node = StringNodeFixture.create({
        annotations: {
          validationFunctions: [validateNumberList as any],
        },
      });

      const expectedError = NodeValidationErrorFixture.stringError({
        value: '1,a,3',
        annotations: { validationFunctions: [validateNumberList as any] },
        previousErrors: [
          NodeValidationErrorFixture.constraintError({
            value: '1,a,3',
            reason: NumberListValidationError.INVALID_NUMBER_LIST,
            previousErrors: [
              NodeValidationErrorFixture.constraintError({
                value: 'a',
                reason: NumberListValidationError.INVALID_NUMBER_LIST_ITEM,
                context: { i: 1 },
                previousErrors: [
                  NodeValidationErrorFixture.constraintError({
                    value: 'a',
                    reason: StringValidationError.NOT_A_INTEGER_STRING,
                  }),
                ],
              }),
            ],
          }),
        ],
      });

      it('should validate 1,2,3', () => {
        const result = node.validate('1,2,3', { values: {}, options: { allowUnknownFields: true } });

        expect(result.success).toBeTrue();
      });

      it('should not validate 1,a,3', () => {
        const result = node.validate('1,a,3', { values: {}, options: { allowUnknownFields: true } });

        expect(result.success).toBeFalse();
        expect(result).toEqual(expectedError);
      });

      it('should not validate empty string', () => {
        const result = node.validate('', { values: {}, options: { allowUnknownFields: true } });

        expect(result.success).toBeFalse();
      });

      it('should format the error correctly', () => {
        const rawErrors = NodeValidationErrorFixture.singleObjectPropertyFailed('Test', 'test', {
          value: '1,a,3',
          previousErrors: [expectedError],
        });

        const errors = formatErrors(rawErrors);

        expect(errors).toEqual({
          ['$.test']: {
            message: 'Item at index 1 in number list is not a valid integer',
            context: { i: 1 },
          },
        });
      });
    });

    describe('validateLength()', () => {
      describe('validateLength(min=2)', () => {
        it.each([['12'], ['123']])('should validate "%s"', (str) => {
          const result = validateLength(mockCallbackArgs(str), 2);
          expect(result).toEqual(sentinel);
          expect(mockSuccess).toHaveBeenCalled();
        });

        it.each([[''], ['1']])('should not validate "%s"', (str) => {
          const result = validateLength(mockCallbackArgs(str), 2);
          expect(result).toEqual(sentinel);
          expect(mockFail).toHaveBeenCalledWith(str, {
            reason: LengthValidationError.LENGTH_FAILED,
            context: { length: str.length, min: 2 },
          });
        });
      });

      describe('validateLength(min=2, max=3)', () => {
        it.each([['12'], ['123']])('should validate "%s"', (str) => {
          const result = validateLength(mockCallbackArgs(str), 2, 3);
          expect(result).toEqual(sentinel);
          expect(mockSuccess).toHaveBeenCalled();
        });

        it.each([[''], ['1'], ['1234']])('should not validate "%s"', (str) => {
          const result = validateLength(mockCallbackArgs(str), 2, 3);
          expect(result).toEqual(sentinel);
          expect(mockFail).toHaveBeenCalledWith(str, {
            reason: LengthValidationError.LENGTH_FAILED,
            context: { length: str.length, min: 2, max: 3 },
          });
        });
      });
    });

    describe('validateRange()', () => {
      describe('validateRange(min=2)', () => {
        it.each([[2], [3], [9001]])('should validate %s', (x) => {
          const result = validateRange(mockCallbackArgs(x), 2);
          expect(result).toEqual(sentinel);
          expect(mockSuccess).toHaveBeenCalled();
        });
        it.each([[0], [1]])('should not validate %s', (x) => {
          const result = validateRange(mockCallbackArgs(x), 2);
          expect(result).toEqual(sentinel);
          expect(mockFail).toHaveBeenCalled();
        });
      });
      describe('validateRange(min=2, max=3)', () => {
        it.each([[2], [3]])('should validate %s', (x) => {
          const result = validateRange(mockCallbackArgs(x), 2, 3);
          expect(result).toEqual(sentinel);
          expect(mockSuccess).toHaveBeenCalled();
        });
        it.each([[0], [1], [4], [9001]])('should not validate %s', (x) => {
          const result = validateRange(mockCallbackArgs(x), 2, 3);
          expect(result).toEqual(sentinel);
          expect(mockFail).toHaveBeenCalled();
        });
      });
    });
  });
});
