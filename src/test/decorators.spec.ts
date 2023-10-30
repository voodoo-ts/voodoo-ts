/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/no-shadow */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { NodeValidationErrorFixture, RootNodeFixture, StringNodeFixture } from './fixtures';
import { project } from './utils';
import {
  getAnnotations,
  IsEmail,
  Length,
  LengthValidationError,
  NumberListValidationError,
  StringValidationError,
  Validate,
  validateIntegerString,
  validateLength,
  validateNumberList,
  validateNumberString,
  validateRange,
  validateUrl,
} from '../decorators';
import { formatErrors } from '../error-formatter';
import { INodeValidationResult, IPropertyValidatorCallbackArguments, groupValidatorFunctions } from '../nodes';
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

      @Validate(callback, { name: '@Test', context: { hello: 'world' } })
      @Validate(callback)
      otherProperty!: string;
    }

    it('should store the metadata correctly', () => {
      const annotations = getAnnotations(Test.prototype, 'testProperty');

      expect(annotations).toEqual([
        {
          type: 'root',
          name: 'validationFunctions',
          value: [{ callback }],
        },
      ]);
    });

    it('should store the metadata correctly', () => {
      const annotations = getAnnotations(Test.prototype, 'otherProperty');

      expect(annotations).toEqual([
        {
          type: 'root',
          name: 'validationFunctions',
          value: [{ callback }, { callback, meta: { name: '@Test', context: { hello: 'world' } } }],
        },
      ]);
    });

    it('should construct the correct tree', () => {
      const trees = v.getPropertyTypeTreesFromConstructor(Test);

      expect(trees.length).toEqual(2);
      expect(trees[0].tree).toEqual(
        RootNodeFixture.createRequired({
          annotations: { hasInitializer: false, validationFunctions: [{ callback }] },
          children: [StringNodeFixture.create({})],
        }),
      );
      expect(trees[1].tree).toEqual(
        RootNodeFixture.createRequired({
          annotations: {
            hasInitializer: false,
            validationFunctions: [{ callback }, { callback, meta: { name: '@Test', context: { hello: 'world' } } }],
          },
          children: [StringNodeFixture.create({})],
        }),
      );
    });

    it('should validate a valid string', () => {
      const result = v.validate(Test, { testProperty: 'TEST', otherProperty: 'TEST' });
      expect(result.success).toBeTrue();
      expect(callback).toHaveBeenCalledTimes(3);
    });

    it('should not call the validator if type is invalid', () => {
      const result = v.validate(Test, { testProperty: null } as any);
      expect(result.success).toBeFalse();
      expect(callback).not.toBeCalled();
    });

    it('should not validate a string that fails the constraint', () => {
      const result = v.validate(Test, { testProperty: 'NOT_TEST', otherProperty: 'NOT_TEST' });
      expect(result.success).toBeFalse();
      expect(callback).toHaveBeenCalledTimes(3);
    });
  });

  describe('groupValidatorFunctions()', () => {
    const v = new ValidatorInstance({ project });

    @v.transformerDecorator()
    class Test {
      @Length(2, 5)
      test!: string;

      @IsEmail()
      email!: string;
    }

    it('should return metadata for @Length correctly', () => {
      const { tree } = v.getPropertyTypeTreesFromConstructor(Test)[0];
      expect(tree.annotations.validationFunctions).not.toBeUndefined();
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const validators = groupValidatorFunctions(tree.annotations.validationFunctions!);
      expect(validators).toEqual({
        ['@Length']: { min: 2, max: 5 },
      });
    });

    it('should return metadata for @IsEmail correctly', () => {
      const { tree } = v.getPropertyTypeTreesFromConstructor(Test)[1];
      expect(tree.children[0].annotations.validationFunctions).not.toBeUndefined();
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const validators = groupValidatorFunctions(tree.children[0].annotations.validationFunctions!);
      expect(validators).toEqual({
        ['@IsEmail']: {},
      });
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
          expect(mockFail).toHaveBeenCalledWith(str, { reason: StringValidationError.INVALID_INTEGER_STRING });
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
          expect(mockFail).toHaveBeenCalledWith(str, { reason: StringValidationError.INVALID_INTEGER_STRING });
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
        expect(mockFail).toHaveBeenCalledWith(str, { reason: StringValidationError.INVALID_NUMBER_STRING });
      });
    });

    describe('validateNumberList()', () => {
      const node = StringNodeFixture.create({
        annotations: {
          validationFunctions: [{ callback: validateNumberList as any }],
        },
      });

      const expectedError = NodeValidationErrorFixture.stringError({
        value: '1,a,3',
        annotations: { validationFunctions: [{ callback: validateNumberList as any }] },
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
                    reason: StringValidationError.INVALID_INTEGER_STRING,
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
            code: NumberListValidationError.INVALID_NUMBER_LIST_ITEM,
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

    describe('validateUrl()', () => {
      describe('validateUrl(allowedProtocols=[https])', () => {
        it.each([['https://foo.bar/']])('should validate %s', (x) => {
          const result = validateUrl(mockCallbackArgs(x), ['https']);
          expect(result).toEqual(sentinel);
          expect(mockSuccess).toHaveBeenCalled();
        });
        it.each([['ftp://foo.bar/'], ['9001']])('should not validate %s', (x) => {
          const result = validateUrl(mockCallbackArgs(x), ['https']);
          expect(result).toEqual(sentinel);
          expect(mockFail).toHaveBeenCalled();
        });
      });
      describe('validateUrl()', () => {
        it.each([['https://foo.bar/'], ['ftp://foo.bar/']])('should validate %s', (x) => {
          const result = validateUrl(mockCallbackArgs(x));
          expect(result).toEqual(sentinel);
          expect(mockSuccess).toHaveBeenCalled();
        });
        it.each([['9001']])('should not validate %s', (x) => {
          const result = validateUrl(mockCallbackArgs(x));
          expect(result).toEqual(sentinel);
          expect(mockFail).toHaveBeenCalled();
        });
      });
    });
  });
});
