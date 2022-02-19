/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Project } from 'ts-morph';

import {
  ArrayLength,
  createValidationDecorator,
  DecoratorFactory,
  getDecorators,
  IsInteger,
  IsNumber,
  IsNumberList,
  LengthValidationError,
  NumberValidationError,
  Range,
  StringLength,
  StringValidationError,
  Validate,
} from '../decorators';
import { DecoratorNode, IValidationContext, ValidationErrorType } from '../nodes';
import { IValidatorClassMeta, ValidatorInstance, validatorMetadataKey } from '../validator';
import { expectValidationError } from './utils';

const project = new Project({
  tsConfigFilePath: 'tsconfig.json',
});

describe('decorators', () => {
  it('should create decorators', () => {
    const decorator = createValidationDecorator<DecoratorFactory>({
      name: 'Test',
      type: 'root',
      validate(testOption: string) {
        return function (value: any, context: IValidationContext) {
          return this.success();
        };
      },
    });

    expect(decorator).toBeInstanceOf(Function);
  });

  describe('generic validator - @Validate()', () => {
    const v = new ValidatorInstance({ project });

    @v.validatorDecorator()
    class Test {
      @Validate((node, value: string) => node.wrapBoolean(value, value.startsWith('TEST_')))
      testProperty!: string;
    }

    it('should decorate', () => {
      const decorators = getDecorators(Test.prototype, 'testProperty');
      expect(decorators).toBeInstanceOf(Array);
      expect(decorators!.length).toEqual(1);
    });

    it('should construct the correct tree', () => {
      const validatorMeta = Reflect.getMetadata(validatorMetadataKey, Test) as IValidatorClassMeta;
      const classDeclaration = v.classDiscovery.getClass(Test.name, validatorMeta.filename, validatorMeta.line);
      const classTrees = v.getPropertyTypeTrees(Test, classDeclaration);

      expect(classTrees.length).toEqual(1);
      expect(classTrees[0].tree).toEqual({
        kind: 'root',
        optional: false,
        children: [
          { kind: 'string', children: [], reason: expect.anything() },
          { kind: 'decorator', type: 'root', name: 'Validate', children: [], validationFunc: expect.any(Function) },
        ],
      });
    });

    it('should not validate an invalid string', () => {
      const result = v.validate(Test, { testProperty: 'NOT_TEST' });

      expectValidationError(result, (result) => {
        expect(result.rawErrors).toEqual({
          testProperty: {
            success: false,
            type: 'decorator',
            value: 'NOT_TEST',
            context: { decorator: { name: 'Validate', type: 'root' } },
            previousErrors: [],
          },
        });
      });
    });

    it('should validate a valid string', () => {
      const result = v.validate(Test, { testProperty: 'TEST_1' });

      expect(result.success).toEqual(true);
    });

    it('should not validate an invalid type', () => {
      const result = v.validate(Test, { testProperty: 123 as any });

      expectValidationError(result, (result) => {
        expect(result.rawErrors).toEqual({
          testProperty: {
            success: false,
            type: 'string',
            reason: ValidationErrorType.NOT_A_STRING,
            value: 123,
            previousErrors: [],
          },
        });
      });
    });
  });

  describe('string length - @StringLength(1)', () => {
    const v = new ValidatorInstance({ project });

    @v.validatorDecorator()
    class Test {
      @StringLength(1)
      testProperty!: string;
    }

    it('should decorate', () => {
      const decorators = getDecorators(Test.prototype, 'testProperty');
      expect(decorators).toBeInstanceOf(Array);
      expect(decorators!.length).toEqual(1);
    });

    it('should add a decorator node to the tree', () => {
      const validatorMeta = Reflect.getMetadata(validatorMetadataKey, Test) as IValidatorClassMeta;
      const classDeclaration = v.classDiscovery.getClass(Test.name, validatorMeta.filename, validatorMeta.line);
      const classTrees = v.getPropertyTypeTrees(Test, classDeclaration);

      expect(classTrees.length).toEqual(1);
      expect(classTrees[0].tree).toEqual({
        children: [
          {
            kind: 'string',
            children: [
              {
                kind: 'decorator',
                name: 'Length',
                type: 'string',
                children: [],
                validationFunc: expect.any(Function),
              },
            ],
            reason: expect.anything(),
          },
        ],
        kind: 'root',
        optional: false,
      });
    });

    it('should not validate a too short string', () => {
      const result = v.validate(Test, { testProperty: '' });

      expectValidationError(result, (result) => {
        expect(result.rawErrors).toEqual({
          testProperty: {
            success: false,
            type: 'decorator',
            reason: LengthValidationError.LENGTH_FAILED,
            value: '',
            previousErrors: [],
            context: {
              decorator: {
                name: 'Length',
                type: 'string',
              },
              min: 1,
            },
          },
        });
      });
    });

    it('should validate a valid string (l = min)', () => {
      const result = v.validate(Test, { testProperty: '1' });

      expect(result.success).toEqual(true);
    });

    it('should validate a valid string (l = min + 1)', () => {
      const result = v.validate(Test, { testProperty: '12' });

      expect(result.success).toEqual(true);
    });

    it('should validate a valid string (l = min + 2)', () => {
      const result = v.validate(Test, { testProperty: '123' });

      expect(result.success).toEqual(true);
    });

    it('should not validate an invalid type', () => {
      const result = v.validate(Test, { testProperty: 123 as any });

      expectValidationError(result, (result) => {
        expect(result.rawErrors).toEqual({
          testProperty: {
            success: false,
            type: 'string',
            reason: ValidationErrorType.NOT_A_STRING,
            value: 123,
            previousErrors: [],
          },
        });
      });
    });
  });

  describe('string length - @StringLength(1, 2)', () => {
    const v = new ValidatorInstance({ project });

    @v.validatorDecorator()
    class Test {
      @StringLength(1, 2)
      testProperty!: string;
    }

    it('should decorate', () => {
      const decorators = getDecorators(Test.prototype, 'testProperty');
      expect(decorators).toBeInstanceOf(Array);
      expect(decorators!.length).toEqual(1);
    });

    it('should add a decorator node to the tree', () => {
      const validatorMeta = Reflect.getMetadata(validatorMetadataKey, Test) as IValidatorClassMeta;
      const classDeclaration = v.classDiscovery.getClass(Test.name, validatorMeta.filename, validatorMeta.line);
      const classTrees = v.getPropertyTypeTrees(Test, classDeclaration);

      expect(classTrees.length).toEqual(1);
      expect(classTrees[0].tree).toEqual({
        kind: 'root',
        children: [
          {
            kind: 'string',
            reason: expect.anything(),
            children: [
              {
                kind: 'decorator',
                name: 'Length',
                type: 'string',
                validationFunc: expect.any(Function),
                children: [],
              },
            ],
          },
        ],
        optional: false,
      });
    });

    it('should not validate a too short string', () => {
      const result = v.validate(Test, { testProperty: '' });

      expectValidationError(result, (result) => {
        expect(result.rawErrors).toEqual({
          testProperty: {
            success: false,
            type: 'decorator',
            reason: LengthValidationError.LENGTH_FAILED,
            value: '',
            previousErrors: [],
            context: {
              decorator: {
                name: 'Length',
                type: 'string',
              },
              min: 1,
              max: 2,
            },
          },
        });
      });
    });

    it('should not validate a too long string', () => {
      const result = v.validate(Test, { testProperty: '123' });

      expectValidationError(result, (result) => {
        expect(result.rawErrors).toEqual({
          testProperty: {
            success: false,
            type: 'decorator',
            reason: LengthValidationError.LENGTH_FAILED,
            value: '123',
            previousErrors: [],
            context: {
              decorator: {
                name: 'Length',
                type: 'string',
              },
              min: 1,
              max: 2,
            },
          },
        });
      });
    });

    it('should validate a valid string (l = min)', () => {
      const result = v.validate(Test, { testProperty: '1' });

      expect(result.success).toEqual(true);
    });

    it('should validate a valid string (l = max)', () => {
      const result = v.validate(Test, { testProperty: '12' });

      expect(result.success).toEqual(true);
    });

    it('should not validate an invalid type', () => {
      const result = v.validate(Test, { testProperty: 123 as any });

      expectValidationError(result, (result) => {
        expect(result.rawErrors).toEqual({
          testProperty: {
            success: false,
            type: 'string',
            reason: ValidationErrorType.NOT_A_STRING,
            value: 123,
            previousErrors: [],
          },
        });
      });
    });
  });

  describe('array length - @ArrayLength(1)', () => {
    const v = new ValidatorInstance({ project });

    @v.validatorDecorator()
    class Test {
      @ArrayLength(1)
      testProperty!: string[];
    }

    it('should decorate', () => {
      const decorators = getDecorators(Test.prototype, 'testProperty');
      expect(decorators).toBeInstanceOf(Array);
      expect(decorators!.length).toEqual(1);
    });

    it('should add a decorator node to the tree', () => {
      const validatorMeta = Reflect.getMetadata(validatorMetadataKey, Test) as IValidatorClassMeta;
      const classDeclaration = v.classDiscovery.getClass(Test.name, validatorMeta.filename, validatorMeta.line);
      const classTrees = v.getPropertyTypeTrees(Test, classDeclaration);

      expect(classTrees.length).toEqual(1);
      expect(classTrees[0].tree).toEqual({
        kind: 'root',
        optional: false,
        children: [
          {
            kind: 'array',
            children: [
              {
                kind: 'string',
                reason: expect.anything(),
                children: [],
              },
              {
                kind: 'decorator',
                name: 'Length',
                type: 'array',
                validationFunc: expect.any(Function),
                children: [],
              },
            ],
          },
        ],
      });
    });

    it('should not validate a too short array', () => {
      const result = v.validate(Test, { testProperty: [] });

      expectValidationError(result, (result) => {
        expect(result.rawErrors).toEqual({
          testProperty: {
            success: false,
            type: 'array',
            reason: ValidationErrorType.ARRAY_TYPE_FAILED,
            value: [],
            previousErrors: [
              {
                success: false,
                type: 'decorator',
                reason: LengthValidationError.LENGTH_FAILED,
                value: [],
                previousErrors: [],
                context: {
                  decorator: {
                    name: 'Length',
                    type: 'array',
                  },
                  min: 1,
                },
              },
            ],
          },
        });
      });
    });

    it('should validate a valid array (l = min)', () => {
      const result = v.validate(Test, { testProperty: ['1'] });

      expect(result.success).toEqual(true);
    });

    it('should validate a valid array (l = min + 1)', () => {
      const result = v.validate(Test, { testProperty: ['1', '2'] });

      expect(result.success).toEqual(true);
    });

    it('should validate a valid array (l = min + 2)', () => {
      const result = v.validate(Test, { testProperty: ['1', '2', '3'] });

      expect(result.success).toEqual(true);
    });

    it('should not validate an invalid type', () => {
      const result = v.validate(Test, { testProperty: 123 as any });

      expectValidationError(result, (result) => {
        expect(result.rawErrors).toEqual({
          testProperty: {
            success: false,
            type: 'array',
            reason: ValidationErrorType.NOT_AN_ARRAY,
            value: 123,
            previousErrors: [],
          },
        });
      });
    });
  });

  describe('array length - @ArrayLength(1, 2)', () => {
    const v = new ValidatorInstance({ project });

    @v.validatorDecorator()
    class Test {
      @ArrayLength(1, 2)
      testProperty!: string[];
    }

    it('should decorate', () => {
      const decorators = getDecorators(Test.prototype, 'testProperty');
      expect(decorators).toBeInstanceOf(Array);
      expect(decorators!.length).toEqual(1);
    });

    it('should add a decorator node to the tree', () => {
      const validatorMeta = Reflect.getMetadata(validatorMetadataKey, Test) as IValidatorClassMeta;
      const classDeclaration = v.classDiscovery.getClass(Test.name, validatorMeta.filename, validatorMeta.line);
      const classTrees = v.getPropertyTypeTrees(Test, classDeclaration);

      expect(classTrees.length).toEqual(1);
      expect(classTrees[0].tree).toEqual({
        kind: 'root',
        optional: false,
        children: [
          {
            kind: 'array',
            children: [
              {
                kind: 'string',
                reason: expect.anything(),
                children: [],
              },
              {
                kind: 'decorator',
                name: 'Length',
                type: 'array',
                validationFunc: expect.any(Function),
                children: [],
              },
            ],
          },
        ],
      });
    });

    it('should not validate a too short array', () => {
      const result = v.validate(Test, { testProperty: [] });

      expectValidationError(result, (result) => {
        expect(result.rawErrors).toEqual({
          testProperty: {
            success: false,
            type: 'array',
            reason: ValidationErrorType.ARRAY_TYPE_FAILED,
            value: [],
            previousErrors: [
              {
                success: false,
                type: 'decorator',
                reason: LengthValidationError.LENGTH_FAILED,
                value: [],
                previousErrors: [],
                context: {
                  decorator: {
                    name: 'Length',
                    type: 'array',
                  },
                  min: 1,
                  max: 2,
                },
              },
            ],
          },
        });
      });
    });

    it('should not validate a too long array', () => {
      const result = v.validate(Test, { testProperty: ['1', '2', '3'] });

      expectValidationError(result, (result) => {
        expect(result.rawErrors).toEqual({
          testProperty: {
            success: false,
            type: 'array',
            reason: ValidationErrorType.ARRAY_TYPE_FAILED,
            value: ['1', '2', '3'],
            previousErrors: [
              {
                success: false,
                type: 'decorator',
                reason: LengthValidationError.LENGTH_FAILED,
                value: ['1', '2', '3'],
                context: {
                  decorator: {
                    name: 'Length',
                    type: 'array',
                  },
                  min: 1,
                  max: 2,
                },
                previousErrors: [],
              },
            ],
          },
        });
      });
    });

    it('should validate a valid array (l = min)', () => {
      const result = v.validate(Test, { testProperty: ['1'] });

      expect(result.success).toEqual(true);
    });

    it('should validate a valid array (l = max)', () => {
      const result = v.validate(Test, { testProperty: ['1', '2'] });

      expect(result.success).toEqual(true);
    });

    it('should not validate an invalid type', () => {
      const result = v.validate(Test, { testProperty: 123 as any });

      expectValidationError(result, (result) => {
        expect(result.rawErrors).toEqual({
          testProperty: {
            success: false,
            type: 'array',
            reason: ValidationErrorType.NOT_AN_ARRAY,
            value: 123,
            previousErrors: [],
          },
        });
      });
    });
  });

  describe('range - @Range(5)', () => {
    const v = new ValidatorInstance({ project });

    @v.validatorDecorator()
    class Test {
      @Range(5)
      testProperty!: number;
    }

    it('should construct the correct tree', () => {
      const validatorMeta = Reflect.getMetadata(validatorMetadataKey, Test) as IValidatorClassMeta;
      const classDeclaration = v.classDiscovery.getClass(Test.name, validatorMeta.filename, validatorMeta.line);
      const trees = v.getPropertyTypeTrees(Test, classDeclaration);
      const { name, tree } = trees[0];

      expect(name).toEqual('testProperty');
      expect(tree).toEqual({
        kind: 'root',
        optional: false,
        children: [
          {
            kind: 'number',
            reason: expect.anything(),
            children: [
              {
                kind: 'decorator',
                name: 'Range',
                type: 'number',
                children: [],
                validationFunc: expect.any(Function),
              },
            ],
          },
        ],
      });
    });

    it('should call the decorator', () => {
      const validatorMeta = Reflect.getMetadata(validatorMetadataKey, Test) as IValidatorClassMeta;
      const classDeclaration = v.classDiscovery.getClass(Test.name, validatorMeta.filename, validatorMeta.line);
      const trees = v.getPropertyTypeTrees(Test, classDeclaration);
      const { name, tree } = trees[0];
      const decoratorSpy = jest.spyOn(tree.children[0].children[0] as DecoratorNode, 'validationFunc');
      v.validate(Test, { testProperty: 5 });

      expect(name).toEqual('testProperty');
      expect(decoratorSpy).toHaveBeenCalled();
    });

    it('should have an inclusive lower boundary', () => {
      const result = v.validate(Test, { testProperty: 5 });

      expect(result.success).toEqual(true);
    });

    it('should not validate below range', () => {
      const result = v.validate(Test, { testProperty: 4 });

      expectValidationError(result, (result) => {
        expect(result.rawErrors).toEqual({
          testProperty: {
            success: false,
            type: 'decorator',
            reason: NumberValidationError.OUT_OF_RANGE,
            value: 4,
            context: {
              decorator: {
                name: 'Range',
                type: 'number',
              },
            },
            previousErrors: [],
          },
        });
      });
    });
  });

  describe('range - @Range(5, 10)', () => {
    const v = new ValidatorInstance({ project });

    @v.validatorDecorator()
    class Test {
      @Range(5, 10)
      testProperty!: number;
    }

    it('should have an inclusive lower boundary', () => {
      const result = v.validate(Test, { testProperty: 5 });

      expect(result.success).toEqual(true);
    });

    it('should have an inclusive upper boundary', () => {
      const result = v.validate(Test, { testProperty: 10 });

      expect(result.success).toEqual(true);
    });

    it('should not validate below range', () => {
      const result = v.validate(Test, { testProperty: 4 });

      expectValidationError(result, (result) => {
        expect(result.rawErrors).toEqual({
          testProperty: {
            success: false,
            type: 'decorator',
            reason: NumberValidationError.OUT_OF_RANGE,
            value: 4,
            context: {
              decorator: {
                name: 'Range',
                type: 'number',
              },
            },
            previousErrors: [],
          },
        });
      });
    });

    it('should not validate above range', () => {
      const result = v.validate(Test, { testProperty: 11 });

      expectValidationError(result, (result) => {
        expect(result.rawErrors).toEqual({
          testProperty: {
            success: false,
            type: 'decorator',
            reason: NumberValidationError.OUT_OF_RANGE,
            value: 11,
            context: {
              decorator: {
                name: 'Range',
                type: 'number',
              },
            },
            previousErrors: [],
          },
        });
      });
    });
  });

  describe('is number - @IsNumber()', () => {
    const v = new ValidatorInstance({ project });

    @v.validatorDecorator()
    class Test {
      @IsNumber()
      testProperty!: string;
    }

    it('should construct the correct tree', () => {
      const { tree } = v.getPropertyTypeTreesFromConstructor(Test)[0];

      expect(tree).toEqual({
        kind: 'root',
        optional: false,
        children: [
          {
            kind: 'string',
            reason: expect.anything(),
            children: [
              {
                kind: 'decorator',
                name: 'IsNumber',
                type: 'string',
                children: [],
                validationFunc: expect.any(Function),
              },
            ],
          },
        ],
      });
    });

    it('should call the decorator', () => {
      const { name, tree } = v.getPropertyTypeTreesFromConstructor(Test)[0];
      const decoratorSpy = jest.spyOn(tree.children[0].children[0] as DecoratorNode, 'validationFunc');

      v.validate(Test, { testProperty: '123' });

      expect(name).toEqual('testProperty');
      expect(decoratorSpy).toHaveBeenCalled();
    });

    it('should validate positive number strings', () => {
      const result = v.validate(Test, { testProperty: '123' });

      expect(result.success).toEqual(true);
    });

    it('should validate negative number strings', () => {
      const result = v.validate(Test, { testProperty: '-123' });

      expect(result.success).toEqual(true);
    });

    it('should validate number strings with leading zeros', () => {
      const result = v.validate(Test, { testProperty: '000123' });

      expect(result.success).toEqual(true);
    });

    it('should validate floats', () => {
      const result = v.validate(Test, { testProperty: '1.234' });

      expect(result.success).toEqual(true);
    });

    it('should not validate invalid number strings', () => {
      const result = v.validate(Test, { testProperty: 'TEST' });

      expectValidationError(result, (result) => {
        expect(result.rawErrors).toEqual({
          testProperty: {
            success: false,
            type: 'decorator',
            reason: StringValidationError.NOT_A_NUMBER_STRING,
            value: 'TEST',
            context: {
              decorator: {
                name: 'IsNumber',
                type: 'string',
              },
            },
            previousErrors: [],
          },
        });
      });
    });
  });

  describe('is integer - @IsInteger()', () => {
    const v = new ValidatorInstance({ project });

    @v.validatorDecorator()
    class Test {
      @IsInteger()
      testProperty!: string;
    }

    it('should construct the correct tree', () => {
      const { tree } = v.getPropertyTypeTreesFromConstructor(Test)[0];

      expect(tree).toEqual({
        kind: 'root',
        optional: false,
        children: [
          {
            kind: 'string',
            reason: expect.anything(),
            children: [
              {
                kind: 'decorator',
                name: 'IsNumber',
                type: 'string',
                children: [],
                validationFunc: expect.any(Function),
              },
            ],
          },
        ],
      });
    });

    it('should call the decorator', () => {
      const { name, tree } = v.getPropertyTypeTreesFromConstructor(Test)[0];
      const decoratorSpy = jest.spyOn(tree.children[0].children[0] as DecoratorNode, 'validationFunc');

      v.validate(Test, { testProperty: '123' });

      expect(name).toEqual('testProperty');
      expect(decoratorSpy).toHaveBeenCalled();
    });

    it('should validate positive number strings', () => {
      const result = v.validate(Test, { testProperty: '123' });

      expect(result.success).toEqual(true);
    });

    it('should validate negative number strings', () => {
      const result = v.validate(Test, { testProperty: '-123' });

      expect(result.success).toEqual(true);
    });

    it('should validate number strings with leading zeros', () => {
      const result = v.validate(Test, { testProperty: '000123' });

      expect(result.success).toEqual(true);
    });

    it('should validate hexdecimal string', () => {
      const result = v.validate(Test, { testProperty: '0xFF' });

      expect(result.success).toEqual(true);
    });

    it('should not validate invalid number strings', () => {
      const result = v.validate(Test, { testProperty: 'TEST' });

      expectValidationError(result, (result) => {
        expect(result.rawErrors).toEqual({
          testProperty: {
            success: false,
            type: 'decorator',
            reason: StringValidationError.NOT_A_NUMBER_STRING,
            value: 'TEST',
            context: {
              decorator: {
                name: 'IsNumber',
                type: 'string',
              },
            },
            previousErrors: [],
          },
        });
      });
    });
  });

  describe('is number list - @IsNumberList()', () => {
    const v = new ValidatorInstance({ project });

    @v.validatorDecorator()
    class Test {
      @IsNumberList()
      testProperty!: string;
    }

    it('should construct the correct tree', () => {
      const { tree } = v.getPropertyTypeTreesFromConstructor(Test)[0];

      expect(tree).toEqual({
        kind: 'root',
        optional: false,
        children: [
          {
            kind: 'string',
            reason: expect.anything(),
            children: [
              {
                kind: 'decorator',
                name: 'IsNumberList',
                type: 'string',
                children: [],
                validationFunc: expect.any(Function),
              },
            ],
          },
        ],
      });
    });

    it('should call the decorator', () => {
      const { name, tree } = v.getPropertyTypeTreesFromConstructor(Test)[0];
      const decoratorSpy = jest.spyOn(tree.children[0].children[0] as DecoratorNode, 'validationFunc');

      v.validate(Test, { testProperty: '123' });

      expect(name).toEqual('testProperty');
      expect(decoratorSpy).toHaveBeenCalled();
    });

    it('should validate single item list', () => {
      const result = v.validate(Test, { testProperty: '1' });

      expect(result.success).toEqual(true);
    });

    it('should validate two item list', () => {
      const result = v.validate(Test, { testProperty: '1,2' });

      expect(result.success).toEqual(true);
    });

    it('should not validate list with invalid numbers', () => {
      const result = v.validate(Test, { testProperty: '1,X' });

      expect(result.success).toEqual(false);

      expectValidationError(result, (result) => {
        expect(result.rawErrors).toEqual({
          testProperty: {
            success: false,
            type: 'decorator',
            reason: StringValidationError.NOT_A_NUMBER_LIST,
            value: '1,X',
            context: {
              decorator: {
                name: 'IsNumberList',
                type: 'string',
              },
              element: 1,
            },
            previousErrors: [],
          },
        });
      });
    });

    it('should not validate list with trailing comma', () => {
      const result = v.validate(Test, { testProperty: '1,2,' });

      expect(result.success).toEqual(false);

      expectValidationError(result, (result) => {
        expect(result.rawErrors).toEqual({
          testProperty: {
            success: false,
            type: 'decorator',
            reason: StringValidationError.NOT_A_NUMBER_LIST,
            value: '1,2,',
            context: {
              decorator: { name: 'IsNumberList', type: 'string' },
              element: 2,
            },
            previousErrors: [],
          },
        });
      });
    });
  });
});
