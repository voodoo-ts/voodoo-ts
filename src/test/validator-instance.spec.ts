/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Project } from 'ts-morph';

import { IValidatorClassMeta, ValidatorInstance, validatorMetadataKey } from '../v';

const project = new Project({
  tsConfigFilePath: 'tsconfig.json',
  // Optionally specify compiler options, tsconfig.json, in-memory file system, and more here.
  // If you initialize with a tsconfig.json, then it will automatically populate the project
  // with the associated source files.
  // Read more: https://ts-morph.com/setup/
});

describe('plumbing', () => {
  it('should construct', () => {
    const instance = new ValidatorInstance({ project });
    expect(instance).toBeTruthy();
  });

  it('should be able to set metadata on classes', () => {
    const v = new ValidatorInstance({ project });

    @v.validatorDecorator()
    class Test {}
    const validatorMeta = Reflect.getMetadata(validatorMetadataKey, Test) as IValidatorClassMeta;

    expect(validatorMeta.filename).toMatch('validator-instance.spec');
    expect(typeof validatorMeta.line).toEqual('number');
  });

  it('should be able to discover test classes', () => {
    const v = new ValidatorInstance({ project });

    @v.validatorDecorator()
    class Test {}
    const validatorMeta = Reflect.getMetadata(validatorMetadataKey, Test) as IValidatorClassMeta;
    const classDeclaration = v.getClass(validatorMeta.filename, Test.name, validatorMeta.line);

    expect(classDeclaration).toBeTruthy();
  });
});

describe('validator', () => {
  describe('general', () => {
    it('should work for empty classes', () => {
      const v = new ValidatorInstance({ project });

      @v.validatorDecorator()
      class Test {}
      const result = v.validate(Test, {});

      expect(result.success).toEqual(true);
    });
  });
  describe('numbers', () => {
    it('should validate valid numbers', () => {
      const v = new ValidatorInstance({ project });

      @v.validatorDecorator()
      class Test {
        numberProperty!: number;
      }
      const result = v.validate(Test, { numberProperty: 123 });

      expect(result.success).toEqual(true);
    });

    it('should fail for invalid numbers', () => {
      const v = new ValidatorInstance({ project });

      @v.validatorDecorator()
      class Test {
        numberProperty!: number;
      }
      const result = v.validate(Test, { numberProperty: '123' } as any);

      expect(result.success).toEqual(false);
      if (!result.success) {
        // Needed for type narrowing
        expect(result.errors.numberProperty).toBeTruthy();
      }
    });
  });

  describe('nested', () => {
    const v = new ValidatorInstance({ project });

    @v.validatorDecorator()
    class TestEmbed {
      embeddedProperty!: number;
    }

    @v.validatorDecorator()
    class Test {
      embeddedObject!: TestEmbed;
    }

    it('should validate', () => {
      const result = v.validate(Test, { embeddedObject: { embeddedProperty: 123 } });
      expect(result.success).toEqual(true);
    });
  });

  describe('nested - cycle', () => {
    const v = new ValidatorInstance({ project });

    @v.validatorDecorator()
    class Test {
      name!: string;
      children!: Test[];
    }

    it('should validate', () => {
      const result = v.validate(Test, {
        name: 'root',
        children: [
          { name: 'Child1', children: [] },
          { name: 'Child2', children: [{ name: 'Child2-1' as string, children: [] }] },
          { name: 'Child3', children: [] },
        ],
      });
      expect(result.success).toEqual(true);
    });
  });

  describe('nested - Omit<T>', () => {
    const v = new ValidatorInstance({ project });

    type SkippedKeys = 'embeddedProperty1' | 'embeddedProperty2';

    @v.validatorDecorator()
    class TestEmbed {
      embeddedProperty1!: number;
      embeddedProperty2!: number;
      embeddedProperty3?: number;
    }

    @v.validatorDecorator()
    class Test {
      embeddedObject!: Omit<TestEmbed, 'embeddedProperty2'>;
      embeddedObjectMultikey!: Omit<TestEmbed, 'embeddedProperty1' | 'embeddedProperty2'>;
      embeddedObjectMultikeyAlias!: Omit<TestEmbed, SkippedKeys>;
    }

    it('should validate', () => {
      const result = v.validate(Test, {
        embeddedObject: { embeddedProperty1: 123 },
        embeddedObjectMultikey: {},
        embeddedObjectMultikeyAlias: {},
      });

      // console.time();
      // for (let i = 0; i < 1000; i++) {
      //   v.validate(Test, {
      //     embeddedObject: { embeddedProperty1: 123 },
      //     embeddedObjectMultikey: {},
      //     embeddedObjectMultikeyAlias: {},
      //   });
      // }
      // console.timeEnd();

      expect(result.success).toEqual(true);
    });
  });
});
