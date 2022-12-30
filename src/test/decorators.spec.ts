/* eslint-disable @typescript-eslint/no-shadow */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import {
  ArrayLength,
  createValidationDecorator,
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
import { DecoratorNode, INodeValidationError, IValidationContext, StringNode, ValidationErrorType } from '../nodes';
import { ValidatorInstance } from '../validator';
import {
  ArrayNodeFixture,
  DecoratorNodeFixture,
  NodeValidationErrorMatcher,
  NumberNodeFixture,
  RootNodeFixture,
  StringNodeFixture,
} from './fixtures';
import { expectValidationError, project } from './utils';

describe.skip('decorators', () => {
  it('should create decorators', () => {
    const decorator = createValidationDecorator({
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
      expect(decorators.length).toEqual(1);
    });

    it('should construct the correct tree', () => {
      const trees = v.getPropertyTypeTreesFromConstructor(Test);

      expect(trees.length).toEqual(1);
      expect(trees[0].tree).toEqual(
        RootNodeFixture.createRequired({
          children: [new StringNode(), DecoratorNodeFixture.create('Validate', 'root')],
        }),
      );
    });

    describe('should not validate an invalid string', () => {
      const result = v.validate(Test, { testProperty: 'NOT_TEST' });

      it('should have the correct result', () => {
        expect(result.success).toEqual(false);
      });

      it('should throw the correct error', () => {
        expectValidationError(result, (result) => {
          expect(result.rawErrors).toEqual(
            NodeValidationErrorMatcher.singleObjectPropertyFailed(Test.name, 'testProperty', {
              previousErrors: [
                {
                  success: false,
                  type: 'decorator',
                  value: 'NOT_TEST',
                  reason: ValidationErrorType.CUSTOM,
                  previousErrors: [],
                  context: {
                    decorator: { name: 'Validate', type: 'root' },
                    className: 'Test',
                    propertyName: 'testProperty',
                  },
                  annotations: {},
                },
              ],
            }),
          );
        });
      });
    });

    it('should validate a valid string', () => {
      const result = v.validate(Test, { testProperty: 'TEST_1' });

      expect(result.success).toEqual(true);
    });

    describe('should not validate an invalid type', () => {
      const result = v.validate(Test, { testProperty: 123 as any });

      it('should not validate', () => {
        expect(result.success).toEqual(false);
      });

      it('should construct the correct error', () => {
        expectValidationError(result, (result) => {
          expect(result.rawErrors).toEqual({
            success: false,
            type: 'class',
            reason: ValidationErrorType.OBJECT_PROPERTY_FAILED,
            value: { testProperty: 123 },
            context: { className: 'Test' },
            previousErrors: [
              {
                success: false,
                type: 'string',
                reason: ValidationErrorType.NOT_A_STRING,
                value: 123,
                previousErrors: [],
                context: { className: 'Test', propertyName: 'testProperty' },
              },
            ],
          });
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
      expect(decorators.length).toEqual(1);
    });

    it('should add a decorator node to the tree', () => {
      const trees = v.getPropertyTypeTreesFromConstructor(Test);

      expect(trees.length).toEqual(1);
      expect(trees[0].tree).toEqual(
        RootNodeFixture.createRequired({
          children: [
            StringNodeFixture.create({
              children: [DecoratorNodeFixture.create('Length', 'string')],
            }),
          ],
        }),
      );
    });

    describe('should not validate below minimum length', () => {
      const result = v.validate(Test, { testProperty: '' });

      it('should not validate', () => {
        expect(result.success).toEqual(false);
      });

      it('should construct the correct error', () => {
        expectValidationError(result, (result) => {
          expect(result.rawErrors).toEqual({
            success: false,
            type: 'class',
            reason: ValidationErrorType.OBJECT_PROPERTY_FAILED,
            value: { testProperty: '' },
            context: { className: 'Test' },
            previousErrors: [
              {
                success: false,
                type: 'string',
                reason: ValidationErrorType.DECORATORS_FAILED,
                value: '',
                context: { className: 'Test', propertyName: 'testProperty' },
                previousErrors: [
                  {
                    success: false,
                    type: 'decorator',
                    reason: LengthValidationError.LENGTH_FAILED,
                    value: '',
                    previousErrors: [],
                    context: {
                      min: 1,
                      length: 0,
                      decorator: { name: 'Length', type: 'string' },
                    },
                  },
                ],
              },
            ],
          });
        });
      });
    });

    it('should have an inclusive minimum length', () => {
      const result = v.validate(Test, { testProperty: '1' });

      expect(result.success).toEqual(true);
    });

    describe('should not validate an invalid type', () => {
      const result = v.validate(Test, { testProperty: 123 as any });

      it('should not validate', () => {
        expect(result.success).toEqual(false);
      });
      it('should construct the correct error', () => {
        expectValidationError(result, (result) => {
          expect(result.rawErrors).toEqual({
            success: false,
            type: 'class',
            reason: ValidationErrorType.OBJECT_PROPERTY_FAILED,
            value: { testProperty: 123 },
            context: { className: 'Test' },
            previousErrors: [
              {
                success: false,
                type: 'string',
                value: 123,
                previousErrors: [],
                reason: ValidationErrorType.NOT_A_STRING,
                context: { className: 'Test', propertyName: 'testProperty' },
              },
            ],
          });
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
      expect(decorators.length).toEqual(1);
    });

    it('should construct the correct tree', () => {
      const trees = v.getPropertyTypeTreesFromConstructor(Test);

      expect(trees.length).toEqual(1);

      expect(trees[0].tree).toEqual(
        RootNodeFixture.createRequired({
          children: [
            StringNodeFixture.create({
              children: [DecoratorNodeFixture.create('Length', 'string')],
            }),
          ],
        }),
      );
    });

    describe('should not validate below minimum length', () => {
      const result = v.validate(Test, { testProperty: '' });

      it('should not validate', () => {
        expect(result.success).toEqual(false);
      });

      it('should construct the correct error', () => {
        expectValidationError(result, (result) => {
          expect(result.rawErrors).toEqual({
            success: false,
            type: 'class',
            reason: ValidationErrorType.OBJECT_PROPERTY_FAILED,
            value: { testProperty: '' },
            context: { className: 'Test' },
            previousErrors: [
              {
                success: false,
                type: 'string',
                reason: ValidationErrorType.DECORATORS_FAILED,
                value: '',
                context: { className: 'Test', propertyName: 'testProperty' },
                previousErrors: [
                  {
                    success: false,
                    type: 'decorator',
                    reason: LengthValidationError.LENGTH_FAILED,
                    value: '',
                    previousErrors: [],
                    context: { min: 1, max: 2, length: 0, decorator: { name: 'Length', type: 'string' } },
                  },
                ],
              },
            ],
          });
        });
      });
    });

    describe('should not validate above maximum length', () => {
      const result = v.validate(Test, { testProperty: '123' });

      it('should not validate', () => {
        expect(result.success).toEqual(false);
      });
      it('should construct the correct error', () => {
        expectValidationError(result, (result) => {
          expect(result.rawErrors).toEqual({
            success: false,
            type: 'class',
            reason: ValidationErrorType.OBJECT_PROPERTY_FAILED,
            value: { testProperty: '123' },
            context: { className: 'Test' },
            previousErrors: [
              {
                success: false,
                type: 'string',
                reason: ValidationErrorType.DECORATORS_FAILED,
                value: '123',
                context: { className: 'Test', propertyName: 'testProperty' },
                previousErrors: [
                  {
                    success: false,
                    type: 'decorator',
                    reason: LengthValidationError.LENGTH_FAILED,
                    value: '123',
                    previousErrors: [],
                    context: {
                      min: 1,
                      max: 2,
                      length: 3,
                      decorator: { name: 'Length', type: 'string' },
                    },
                  },
                ],
              },
            ],
          });
        });
      });
    });

    it('should have an inclusive minimum length', () => {
      const result = v.validate(Test, { testProperty: '1' });

      expect(result.success).toEqual(true);
    });

    it('should have an inclusive maximum length', () => {
      const result = v.validate(Test, { testProperty: '12' });

      expect(result.success).toEqual(true);
    });

    describe('should not validate an invalid type', () => {
      const result = v.validate(Test, { testProperty: 123 as any });

      it('should not validate', () => {
        expect(result.success).toEqual(false);
      });

      it('should construct the correct error', () => {
        expectValidationError(result, (result) => {
          expect(result.rawErrors).toEqual({
            success: false,
            type: 'class',
            reason: ValidationErrorType.OBJECT_PROPERTY_FAILED,
            value: { testProperty: 123 },
            context: { className: 'Test' },
            previousErrors: [
              {
                success: false,
                type: 'string',
                value: 123,
                previousErrors: [],
                reason: ValidationErrorType.NOT_A_STRING,
                context: { className: 'Test', propertyName: 'testProperty' },
              },
            ],
          });
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
      expect(decorators.length).toEqual(1);
    });

    it('should construct the correct tree', () => {
      const trees = v.getPropertyTypeTreesFromConstructor(Test);

      expect(trees.length).toEqual(1);
      expect(trees[0].tree).toEqual(
        RootNodeFixture.createRequired({
          children: [
            ArrayNodeFixture.create({
              children: [StringNodeFixture.create(), DecoratorNodeFixture.create('Length', 'array')],
            }),
          ],
        }),
      );
    });

    describe('should not validate below minimum length', () => {
      const result = v.validate(Test, { testProperty: [] });

      it('should not validate', () => {
        expect(result.success).toEqual(false);
      });

      it('should construct the correct error', () => {
        expectValidationError(result, (result) => {
          expect(result.rawErrors).toEqual({
            success: false,
            type: 'class',
            reason: ValidationErrorType.OBJECT_PROPERTY_FAILED,
            value: { testProperty: [] },
            context: { className: 'Test' },
            previousErrors: [
              {
                success: false,
                type: 'array',
                reason: ValidationErrorType.DECORATORS_FAILED,
                value: [],
                context: { className: 'Test', propertyName: 'testProperty' },
                previousErrors: [
                  {
                    success: false,
                    type: 'decorator',
                    reason: LengthValidationError.LENGTH_FAILED,
                    value: [],
                    previousErrors: [],
                    context: {
                      min: 1,
                      length: 0,
                      decorator: { name: 'Length', type: 'array' },
                    },
                  },
                ],
              },
            ],
          });
        });
      });
    });

    it('should have an inclusive minimum length', () => {
      const result = v.validate(Test, { testProperty: ['1'] });

      expect(result.success).toEqual(true);
    });

    describe('should not validate an invalid type', () => {
      const result = v.validate(Test, { testProperty: 123 as any });

      it('should not validate', () => {
        expect(result.success).toEqual(false);
      });

      it('should construct the correct error', () => {
        expectValidationError(result, (result) => {
          expect(result.rawErrors).toEqual({
            success: false,
            type: 'class',
            reason: ValidationErrorType.OBJECT_PROPERTY_FAILED,
            value: { testProperty: 123 },
            context: { className: 'Test' },
            previousErrors: [
              {
                success: false,
                type: 'array',
                reason: ValidationErrorType.NOT_AN_ARRAY,
                value: 123,
                previousErrors: [],
                context: { className: 'Test', propertyName: 'testProperty' },
              },
            ],
          });
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
      expect(decorators.length).toEqual(1);
    });

    it('should add a decorator node to the tree', () => {
      const trees = v.getPropertyTypeTreesFromConstructor(Test);

      expect(trees.length).toEqual(1);
      expect(trees[0].tree).toEqual(
        RootNodeFixture.createRequired({
          children: [
            ArrayNodeFixture.create({
              children: [StringNodeFixture.create(), DecoratorNodeFixture.create('Length', 'array')],
            }),
          ],
        }),
      );
    });

    describe('should not validate a too short array', () => {
      const result = v.validate(Test, { testProperty: [] });

      it('should not validate', () => {
        expect(result.success).toEqual(false);
      });
      it('should construct the correct error', () => {
        expectValidationError(result, (result) => {
          expect(result.rawErrors).toEqual({
            success: false,
            type: 'class',
            reason: ValidationErrorType.OBJECT_PROPERTY_FAILED,
            value: { testProperty: [] },
            context: { className: 'Test' },
            previousErrors: [
              {
                success: false,
                type: 'array',
                reason: ValidationErrorType.DECORATORS_FAILED,
                value: [],
                context: { className: 'Test', propertyName: 'testProperty' },
                previousErrors: [
                  {
                    success: false,
                    type: 'decorator',
                    reason: LengthValidationError.LENGTH_FAILED,
                    value: [],
                    previousErrors: [],
                    context: {
                      min: 1,
                      max: 2,
                      length: 0,
                      decorator: { name: 'Length', type: 'array' },
                    },
                  },
                ],
              },
            ],
          });
        });
      });
    });

    describe('should not validate a too long array', () => {
      const result = v.validate(Test, { testProperty: ['1', '2', '3'] });

      it('should not validate', () => {
        expect(result.success).toEqual(false);
      });
      it('should construct the correct error', () => {
        expectValidationError(result, (result) => {
          expect(result.rawErrors).toEqual({
            success: false,
            type: 'class',
            reason: ValidationErrorType.OBJECT_PROPERTY_FAILED,
            value: { testProperty: ['1', '2', '3'] },
            context: { className: 'Test' },
            previousErrors: [
              {
                success: false,
                type: 'array',
                reason: ValidationErrorType.DECORATORS_FAILED,
                value: ['1', '2', '3'],
                context: { className: 'Test', propertyName: 'testProperty' },
                previousErrors: [
                  {
                    success: false,
                    type: 'decorator',
                    reason: LengthValidationError.LENGTH_FAILED,
                    value: ['1', '2', '3'],
                    previousErrors: [],
                    context: {
                      min: 1,
                      max: 2,
                      length: 3,
                      decorator: { name: 'Length', type: 'array' },
                    },
                  },
                ],
              },
            ],
          });
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

    describe('should not validate an invalid type', () => {
      const result = v.validate(Test, { testProperty: 123 as any });

      it('should not validate', () => {
        expect(result.success).toEqual(false);
      });

      it('should construct the correct error', () => {
        expectValidationError(result, (result) => {
          expect(result.rawErrors).toEqual({
            success: false,
            type: 'class',
            reason: ValidationErrorType.OBJECT_PROPERTY_FAILED,
            value: { testProperty: 123 },
            context: { className: 'Test' },
            previousErrors: [
              {
                success: false,
                type: 'array',
                reason: ValidationErrorType.NOT_AN_ARRAY,
                value: 123,
                previousErrors: [],
                context: { className: 'Test', propertyName: 'testProperty' },
              },
            ],
          });
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
      const trees = v.getPropertyTypeTreesFromConstructor(Test);
      const { name, tree } = trees[0];

      expect(name).toEqual('testProperty');
      expect(trees[0].tree).toEqual(
        RootNodeFixture.createRequired({
          children: [
            NumberNodeFixture.create({
              children: [DecoratorNodeFixture.create('Range', 'number')],
            }),
          ],
        }),
      );
    });

    it('should call the decorator', () => {
      const trees = v.getPropertyTypeTreesFromConstructor(Test);
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

    describe('should not validate below range', () => {
      const result = v.validate(Test, { testProperty: 4 });

      it('should not validate', () => {
        expect(result.success).toEqual(false);
      });

      it('should construct the correct error', () => {
        expectValidationError(result, (result) => {
          expect(result.rawErrors).toEqual({
            success: false,
            type: 'class',
            reason: ValidationErrorType.OBJECT_PROPERTY_FAILED,
            value: { testProperty: 4 },
            context: { className: 'Test' },
            previousErrors: [
              {
                success: false,
                type: 'number',
                reason: ValidationErrorType.DECORATORS_FAILED,
                value: 4,
                context: { className: 'Test', propertyName: 'testProperty' },
                previousErrors: [
                  {
                    success: false,
                    type: 'decorator',
                    reason: NumberValidationError.OUT_OF_RANGE,
                    value: 4,
                    previousErrors: [],
                    context: { decorator: { name: 'Range', type: 'number' } },
                  },
                ],
              },
            ],
          });
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

    describe('should not validate below range', () => {
      const result = v.validate(Test, { testProperty: 4 });

      it('should not validate', () => {
        expect(result.success).toEqual(false);
      });

      it('should construct the correct error', () => {
        expectValidationError(result, (result) => {
          expect(result.rawErrors).toEqual({
            success: false,
            type: 'class',
            reason: ValidationErrorType.OBJECT_PROPERTY_FAILED,
            value: { testProperty: 4 },
            context: { className: 'Test' },
            previousErrors: [
              {
                success: false,
                type: 'number',
                reason: ValidationErrorType.DECORATORS_FAILED,
                context: { className: 'Test', propertyName: 'testProperty' },
                value: 4,
                previousErrors: [
                  {
                    success: false,
                    type: 'decorator',
                    reason: NumberValidationError.OUT_OF_RANGE,
                    value: 4,
                    previousErrors: [],
                    context: { decorator: { name: 'Range', type: 'number' } },
                  },
                ],
              },
            ],
          });
        });
      });
    });

    describe('should not validate above range', () => {
      const result = v.validate(Test, { testProperty: 11 });

      it('should not validate', () => {
        expect(result.success).toEqual(false);
      });
      it('should construct the correct error', () => {
        expectValidationError(result, (result) => {
          expect(result.rawErrors).toEqual({
            success: false,
            type: 'class',
            reason: ValidationErrorType.OBJECT_PROPERTY_FAILED,
            value: { testProperty: 11 },
            context: { className: 'Test' },
            previousErrors: [
              {
                success: false,
                type: 'number',
                value: 11,
                reason: ValidationErrorType.DECORATORS_FAILED,
                context: { className: 'Test', propertyName: 'testProperty' },
                previousErrors: [
                  {
                    success: false,
                    type: 'decorator',
                    reason: NumberValidationError.OUT_OF_RANGE,
                    value: 11,
                    previousErrors: [],
                    context: { decorator: { name: 'Range', type: 'number' } },
                  },
                ],
              },
            ],
          });
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
                annotations: {},
                validationFunc: expect.any(Function),
              },
            ],
            annotations: {},
          },
        ],
        annotations: {},
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

    describe('should not validate invalid number strings', () => {
      const result = v.validate(Test, { testProperty: 'TEST' });

      it('should not validate', () => {
        expect(result.success).toEqual(false);
      });

      it('should construct the correct error', () => {
        expectValidationError(result, (result) => {
          expect(result.rawErrors).toEqual({
            success: false,
            type: 'class',
            reason: ValidationErrorType.OBJECT_PROPERTY_FAILED,
            value: { testProperty: 'TEST' },
            context: { className: 'Test' },
            previousErrors: [
              {
                success: false,
                type: 'string',
                reason: ValidationErrorType.DECORATORS_FAILED,
                value: 'TEST',
                context: { className: 'Test', propertyName: 'testProperty' },
                previousErrors: [
                  {
                    success: false,
                    type: 'decorator',
                    reason: StringValidationError.NOT_A_NUMBER_STRING,
                    value: 'TEST',
                    previousErrors: [],
                    context: { decorator: { name: 'IsNumber', type: 'string' } },
                  },
                ],
              },
            ],
          });
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
                annotations: {},
                validationFunc: expect.any(Function),
              },
            ],
            annotations: {},
          },
        ],
        annotations: {},
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

    describe('should not validate invalid number strings', () => {
      const result = v.validate(Test, { testProperty: 'TEST' });

      it('should not validate', () => {
        expect(result.success).toEqual(false);
      });

      it('should construct the correct error', () => {
        expectValidationError(result, (result) => {
          expect(result.rawErrors).toEqual({
            success: false,
            type: 'class',
            reason: ValidationErrorType.OBJECT_PROPERTY_FAILED,
            value: { testProperty: 'TEST' },
            context: { className: 'Test' },
            previousErrors: [
              {
                success: false,
                type: 'string',
                reason: ValidationErrorType.DECORATORS_FAILED,
                value: 'TEST',
                context: { className: 'Test', propertyName: 'testProperty' },
                previousErrors: [
                  {
                    success: false,
                    type: 'decorator',
                    reason: StringValidationError.NOT_A_NUMBER_STRING,
                    value: 'TEST',
                    previousErrors: [],
                    context: {
                      decorator: { name: 'IsNumber', type: 'string' },
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

  describe('is number list - @IsNumberList()', () => {
    const v = new ValidatorInstance({ project });

    @v.validatorDecorator()
    class Test {
      @IsNumberList()
      testProperty!: string;
    }

    it('should construct the correct tree', () => {
      const { tree } = v.getPropertyTypeTreesFromConstructor(Test)[0];

      expect(tree).toEqual(
        RootNodeFixture.createRequired({
          children: [
            StringNodeFixture.create({
              children: [DecoratorNodeFixture.create('IsNumberList', 'string')],
            }),
          ],
        }),
      );
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

    describe('should not validate list with invalid numbers', () => {
      const result = v.validate(Test, { testProperty: '1,X' });

      it('should not validate', () => {
        expect(result.success).toEqual(false);
      });

      it('should construct the correct error', () => {
        expectValidationError(result, (result) => {
          expect(result.rawErrors).toEqual({
            success: false,
            reason: ValidationErrorType.OBJECT_PROPERTY_FAILED,
            type: 'class',
            value: { testProperty: '1,X' },
            context: { className: 'Test' },
            previousErrors: [
              {
                success: false,
                type: 'string',
                reason: ValidationErrorType.DECORATORS_FAILED,
                value: '1,X',
                context: { className: 'Test', propertyName: 'testProperty' },
                previousErrors: [
                  {
                    success: false,
                    type: 'decorator',
                    reason: StringValidationError.NOT_A_NUMBER_LIST,
                    context: {
                      element: 1,
                      decorator: { name: 'IsNumberList', type: 'string' },
                    },
                    value: '1,X',
                    previousErrors: [],
                  },
                ],
              },
            ],
          });
        });
      });
    });

    describe('should not validate list with trailing comma', () => {
      const result = v.validate(Test, { testProperty: '1,2,' });

      it('should not validate', () => {
        expect(result.success).toEqual(false);
      });

      it('should construct the correct error', () => {
        expectValidationError(result, (result) => {
          expect(result.rawErrors).toEqual({
            success: false,
            type: 'class',
            reason: ValidationErrorType.OBJECT_PROPERTY_FAILED,
            value: { testProperty: '1,2,' },
            context: { className: 'Test' },
            previousErrors: [
              {
                success: false,
                type: 'string',
                reason: ValidationErrorType.DECORATORS_FAILED,
                value: '1,2,',
                context: { className: 'Test', propertyName: 'testProperty' },
                previousErrors: [
                  {
                    success: false,
                    type: 'decorator',
                    reason: StringValidationError.NOT_A_NUMBER_LIST,
                    value: '1,2,',
                    previousErrors: [],
                    context: { element: 2, decorator: { name: 'IsNumberList', type: 'string' } },
                  },
                ],
              },
            ],
          });
        });
      });
    });
  });
});
