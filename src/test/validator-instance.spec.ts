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

  describe('strings', () => {
    it('should validate valid string', () => {
      const v = new ValidatorInstance({ project });

      @v.validatorDecorator()
      class Test {
        stringProperty!: string;
      }
      const result = v.validate(Test, { stringProperty: 'This is a string.' });

      expect(result.success).toEqual(true);
    });

    it('should fail for invalid strings', () => {
      const v = new ValidatorInstance({ project });

      @v.validatorDecorator()
      class Test {
        stringProperty!: string;
      }
      const result = v.validate(Test, { stringProperty: 123 } as any);

      expect(result.success).toEqual(false);
      if (!result.success) {
        // Needed for type narrowing
        expect(result.errors.stringProperty).toBeTruthy();
      }
    });
  });

  describe('booleans', () => {
    const v = new ValidatorInstance({ project });

    @v.validatorDecorator()
    class Test {
      booleanProperty!: boolean;
    }

    it('should validate valid boolean', () => {
      const result = v.validate(Test, { booleanProperty: true });

      expect(result.success).toEqual(true);
    });

    it('should fail for invalid booleans', () => {
      const result = v.validate(Test, { booleanProperty: 123 } as any);

      expect(result.success).toEqual(false);
      if (!result.success) {
        // Needed for type narrowing
        expect(result.errors.booleanProperty).toBeTruthy();
      }
    });
  });

  describe('enums', () => {
    const v = new ValidatorInstance({ project });

    enum TestEnum {
      YES = 'yes',
      NO = 'no',
    }
    @v.validatorDecorator()
    class Test {
      enumProperty!: TestEnum;
    }

    it('should validate valid enum', () => {
      const result = v.validate(Test, { enumProperty: TestEnum.YES });

      expect(result.success).toEqual(true);
    });

    it('should fail for invalid enums', () => {
      const result = v.validate(Test, { enumProperty: 123 } as any);

      expect(result.success).toEqual(false);
      if (!result.success) {
        // Needed for type narrowing
        expect(result.errors.enumProperty).toBeTruthy();
      }
    });
  });

  describe('arrays', () => {
    const v = new ValidatorInstance({ project });

    @v.validatorDecorator()
    class Test {
      arrayProperty!: number[];
    }

    it('should validate valid number arrays', () => {
      const result = v.validate(Test, { arrayProperty: [1, 2, 3] });

      expect(result.success).toEqual(true);
    });

    it('should validate empty number arrays', () => {
      const result = v.validate(Test, { arrayProperty: [] });

      expect(result.success).toEqual(true);
    });

    it('should fail for invalid array elements', () => {
      const result = v.validate(Test, { arrayProperty: [1, 'Two'] } as any);

      expect(result.success).toEqual(false);
      if (!result.success) {
        // Needed for type narrowing
        expect(result.errors.arrayProperty).toBeTruthy();
      }
    });

    it('should fail for invalid arrays', () => {
      const result = v.validate(Test, { arrayProperty: 123 } as any);

      expect(result.success).toEqual(false);
      if (!result.success) {
        // Needed for type narrowing
        expect(result.errors.arrayProperty).toBeTruthy();
      }
    });
  });

  describe('optional', () => {
    const v = new ValidatorInstance({ project });

    @v.validatorDecorator()
    class Test {
      stringProperty?: string;
    }

    it('should validate optional string with valid string', () => {
      const result = v.validate(Test, { stringProperty: 'This is a string.' });
      const t = new Test();
      expect(result.success).toEqual(true);
    });

    it('should fail optional string for invalid strings', () => {
      const result = v.validate(Test, { stringProperty: 123 } as any);

      expect(result.success).toEqual(false);
      if (!result.success) {
        // Needed for type narrowing
        expect(result.errors.stringProperty).toBeTruthy();
      }
    });

    it('should not fail optional string if undefined', () => {
      const result = v.validate(Test, {} as any);

      expect(result.success).toEqual(true);
    });

    it('should fail optional string for null', () => {
      const result = v.validate(Test, { stringProperty: null } as any);

      expect(result.success).toEqual(false);
      if (!result.success) {
        // Needed for type narrowing
        expect(result.errors.stringProperty).toBeTruthy();
      }
    });
  });

  describe('nested', () => {
    describe('simple', () => {
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

    describe('cycle', () => {
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

      it('should not validate invalid input', () => {
        const result = v.validate(Test, {
          name: 'root',
          children: [
            { name: 'Child1', children: [] },
            { name: 'Child2', children: [{ name: 123 as unknown as string, children: [1337] as any }] },
            { name: 'Child3', children: [] },
          ],
        });
        // expect(result.success).toEqual(true);
        if (!result.success) {
          console.log(result.errors);
          v.getValidationErrors(result.errors);
        }
      });
    });

    describe('Omit<T, U>', () => {
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
});
