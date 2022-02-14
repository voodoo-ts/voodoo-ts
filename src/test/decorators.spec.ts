/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Project } from 'ts-morph';

import { createValidationDecorator, DecoratorFactory, getDecorators, StringLength, Validate } from '../decorators';
import { IErrorMessage } from '../error-formatter';
import { ParseError } from '../errors';
import { ClassNode, DecoratorNode, IValidationContext, ValidationErrorType } from '../nodes';
import { isParseError } from '../parser';
import { IValidatorClassMeta, ValidatorInstance, validatorMetadataKey } from '../validator';

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

    it('should add a decorator node to the tree', () => {
      const validatorMeta = Reflect.getMetadata(validatorMetadataKey, Test) as IValidatorClassMeta;
      const classDeclaration = v.classDiscovery.getClass(Test.name, validatorMeta.filename, validatorMeta.line);
      const classTrees = v.getPropertyTypeTrees(Test, classDeclaration);

      expect(classTrees.length).toEqual(1);
      expect(classTrees[0].tree).toEqual({
        children: [
          { kind: 'string', children: [], reason: 'NOT_A_STRING' },
          { kind: 'decorator', children: [], validationFunc: expect.any(Function) },
        ],
        kind: 'root',
        optional: false,
      });
    });

    it('should not validate an invalid string', () => {
      const result = v.validate(Test, { testProperty: 'NOT_TEST' });

      expect(result.success).toEqual(false);
    });

    it('should validate a valid string', () => {
      const result = v.validate(Test, { testProperty: 'TEST_1' });

      expect(result.success).toEqual(true);
    });

    it('should not validate an invalid type', () => {
      const result = v.validate(Test, { testProperty: 123 as any });

      expect(result.success).toEqual(false);
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
            children: [{ kind: 'decorator', children: [], validationFunc: expect.any(Function) }],
            reason: 'NOT_A_STRING',
          },
        ],
        kind: 'root',
        optional: false,
      });
    });

    it('should not validate a too short string', () => {
      const result = v.validate(Test, { testProperty: '' });

      expect(result.success).toEqual(false);
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

      expect(result.success).toEqual(false);
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
            children: [{ kind: 'decorator', children: [], validationFunc: expect.any(Function) }],
            reason: 'NOT_A_STRING',
          },
        ],
        optional: false,
      });
    });

    it('should not validate a too short string', () => {
      const result = v.validate(Test, { testProperty: '' });

      expect(result.success).toEqual(false);
    });

    it('should not validate a too long string', () => {
      const result = v.validate(Test, { testProperty: '123' });

      expect(result.success).toEqual(false);
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

      expect(result.success).toEqual(false);
    });
  });
});
