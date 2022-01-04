/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Project } from 'ts-morph';
import { ParseError } from '../errors';
import { ValidationErrorType } from '../nodes';

import { IErrorMessage, IValidatorClassMeta, ValidatorInstance, validatorMetadataKey } from '../validator';

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

  it('should be able to discover test classes with multiple decorators', () => {
    const v = new ValidatorInstance({ project });
    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
    const decorator = () =>
      Reflect.metadata('foo', {
        foo: 123,
      });

    @decorator()
    @v.validatorDecorator()
    @decorator()
    class Test {}
    const validatorMeta = Reflect.getMetadata(validatorMetadataKey, Test) as IValidatorClassMeta;
    const classDeclaration = v.getClass(validatorMeta.filename, Test.name, validatorMeta.line);

    expect(classDeclaration).toBeTruthy();
  });

  it('should be able to discover test classes with multiple multiline decorators', () => {
    const v = new ValidatorInstance({ project });
    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
    const decorator = (...args: unknown[]) =>
      Reflect.metadata('foo', {
        foo: 123,
      });

    @decorator({
      some: 'property',
      another: 123,
    })
    @v.validatorDecorator({
      options: {
        some: 'property',
      },
    } as any)
    @decorator({
      test: 123,
    })
    class Test {}
    const validatorMeta = Reflect.getMetadata(validatorMetadataKey, Test) as IValidatorClassMeta;
    const classDeclaration = v.getClass(validatorMeta.filename, Test.name, validatorMeta.line);

    expect(classDeclaration).toBeTruthy();
  });

  it('should add inherited properties', () => {
    const v = new ValidatorInstance({ project });

    class TestBase {
      baseAttribute!: string;
    }

    class TestDervied extends TestBase {
      derivedAttribute!: string;
    }

    @v.validatorDecorator()
    class Test extends TestDervied {}
    const validatorMeta = Reflect.getMetadata(validatorMetadataKey, Test) as IValidatorClassMeta;
    const classDeclaration = v.getClass(validatorMeta.filename, Test.name, validatorMeta.line);
    const classTrees = v.getPropertyTypeTrees(classDeclaration);

    expect(classTrees.length).toEqual(2);
    expect(classTrees[0].name).toEqual('derivedAttribute');
    expect(classTrees[1].name).toEqual('baseAttribute');
  });

  it('should throw for unsupported syntax nodes', () => {
    const v = new ValidatorInstance({ project });

    @v.validatorDecorator()
    class Test {
      derivedAttribute!: {};
    }

    const validatorMeta = Reflect.getMetadata(validatorMetadataKey, Test) as IValidatorClassMeta;
    const classDeclaration = v.getClass(validatorMeta.filename, Test.name, validatorMeta.line);
    const classTreesWrapper = () => v.getPropertyTypeTrees(classDeclaration);

    expect(classTreesWrapper).toThrow(ParseError);
  });

  it('should throw for unsupported type symbols', () => {
    const v = new ValidatorInstance({ project });

    @v.validatorDecorator()
    class Test {
      derivedAttribute!: Record<string, number>;
    }

    const validatorMeta = Reflect.getMetadata(validatorMetadataKey, Test) as IValidatorClassMeta;
    const classDeclaration = v.getClass(validatorMeta.filename, Test.name, validatorMeta.line);
    const classTreesWrapper = () => v.getPropertyTypeTrees(classDeclaration);

    expect(classTreesWrapper).toThrow(ParseError);
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

    it('should format invalid enum errors correctly', () => {
      const result = v.validate(Test, { enumProperty: 123 } as any);

      expect(result.success).toEqual(false);
      if (!result.success) {
        // Needed for type narrowing
        expect(result.errors.enumProperty).toBeTruthy();

        // console.log(result.errors.enumProperty);
        // const r = v.transformValidationErrors(result.errors);
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

      expect(result.success).toEqual(true);
    });

    it('should fail optional string for invalid strings', () => {
      const result = v.validate(Test, { stringProperty: 123 } as any);

      expect(result.success).toEqual(false);
      if (!result.success) {
        // Needed for type narrowing
        expect(result.errors.stringProperty).toBeTruthy();
        console.log(JSON.stringify(result.errors.stringProperty, null, 2));
      }
    });

    it('should not fail optional string if undefined', () => {
      const result = v.validate(Test, {} as any);

      // debugger;

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
        expect(result.success).toEqual(false);
        if (!result.success) {
          console.log(result.errors);
          // v.transformValidationErrors(result.errors);
        }
      });
    });

    describe('Omit<T, U>', () => {
      describe('basic', () => {
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

          expect(result.success).toEqual(true);
        });
      });

      describe('with unsupported type', () => {
        const v = new ValidatorInstance({ project });

        @v.validatorDecorator()
        class Test {
          embeddedObject!: Omit<Record<string, string>, 'embeddedProperty2'>;
        }

        it('should throw ParseError()', () => {
          const result = () =>
            v.validate(Test, {
              embeddedObject: { embeddedProperty1: '123' },
            });

          expect(result).toThrow(ParseError);
        });
      });
    });
  });

  describe('union', () => {
    describe('simple', () => {
      const v = new ValidatorInstance({ project });

      @v.validatorDecorator()
      class Test {
        unionProperty!: string | number;
      }

      it('union (string | number) should validate string', () => {
        const result = v.validate(Test, { unionProperty: 'one' });

        expect(result.success).toEqual(true);
      });

      it('union (string | number) should validate number', () => {
        const result = v.validate(Test, { unionProperty: 2 });

        expect(result.success).toEqual(true);
      });

      it('union (string | number) should not validate undefined', () => {
        const result = v.validate(Test, {});

        expect(result.success).toEqual(false);
        if (!result.success) {
          expect(result.errors.unionProperty).toBeInstanceOf(Array);
          expect(result.errors.unionProperty.length).toEqual(1);
          expect(result.errors.unionProperty[0].reason).toEqual(ValidationErrorType.VALUE_REQUIRED);
        }
      });

      it('union (string | number) should not validate boolean', () => {
        const result = v.validate(Test, { unionProperty: false } as any);

        expect(result.success).toEqual(false);
        if (!result.success) {
          // Needed for type narrowing
          expect(result.errors.unionProperty).toBeInstanceOf(Array);
          expect(result.errors.unionProperty.length).toBeGreaterThan(0);
          expect(result.errors.unionProperty[0].context?.unionErrors).toBeInstanceOf(Array);

          const unionPropertyErrors = result.errors.unionProperty[0].context?.unionErrors as IErrorMessage[];
          expect(unionPropertyErrors.length).toBeGreaterThan(0);
          expect(unionPropertyErrors).toEqual(['string', 'number']);
        }
      });
    });
    describe('optional', () => {
      const v = new ValidatorInstance({ project });

      @v.validatorDecorator()
      class Test {
        unionProperty?: string | number;
      }

      it('should remove undefined from the root property', () => {
        const validatorMeta = Reflect.getMetadata(validatorMetadataKey, Test) as IValidatorClassMeta;
        const classDeclaration = v.getClass(validatorMeta.filename, Test.name, validatorMeta.line);
        const trees = v.getPropertyTypeTrees(classDeclaration);

        /*
          Expected:
            RootNode 
            - UnionNode 
              - StringNode
              - NumberNode
         */
        expect(trees[0].tree.kind).toEqual('root');
        expect(trees[0].tree.children.length).toEqual(1);
        expect(trees[0].tree.children[0].kind).toEqual('union');
        expect(trees[0].tree.children[0].children.length).toEqual(2);
        expect(trees[0].tree.children[0].children.map((c) => c.kind)).toEqual(['string', 'number']);
      });

      it('union (string | number)? should validate string', () => {
        const result = v.validate(Test, { unionProperty: 'one' });

        expect(result.success).toEqual(true);
      });

      it('union (string | number)? should validate number', () => {
        const result = v.validate(Test, { unionProperty: 2 });

        expect(result.success).toEqual(true);
      });

      it('union (string | number)? should validate undefined', () => {
        const result = v.validate(Test, {});

        expect(result.success).toEqual(true);
      });

      it('union (string | number) should not validate boolean', () => {
        const result = v.validate(Test, { unionProperty: false } as any);

        expect(result.success).toEqual(false);
        if (!result.success) {
          // Needed for type narrowing
          expect(result.errors.unionProperty).toBeInstanceOf(Array);
          expect(result.errors.unionProperty.length).toBeGreaterThan(0);
          expect(result.errors.unionProperty[0].context?.unionErrors).toBeInstanceOf(Array);
          const unionPropertyError = result.errors.unionProperty[0].context?.unionErrors as unknown[];
          expect(unionPropertyError.length).toBeGreaterThan(0);
        }
      });
    });

    describe('with nesting', () => {
      const v = new ValidatorInstance({ project });

      @v.validatorDecorator()
      class TestEmbed {
        embeddedNumber!: number;
      }

      @v.validatorDecorator()
      class Test {
        unionProperty?: string | number | TestEmbed;
      }

      it('union (string | number)? should validate string', () => {
        const result = v.validate(Test, { unionProperty: 'one' });

        expect(result.success).toEqual(true);
      });

      it('union (string | number)? should validate number', () => {
        const result = v.validate(Test, { unionProperty: 2 });

        expect(result.success).toEqual(true);
      });

      it('union (string | number)? should validate undefined', () => {
        const result = v.validate(Test, {});

        expect(result.success).toEqual(true);
      });

      it('union (string | number)? should validate embedded object', () => {
        const result = v.validate(Test, { unionProperty: { embeddedNumber: 123 } });

        expect(result.success).toEqual(true);
      });

      it('union (string | number)? should not validate boolean', () => {
        const result = v.validate(Test, { unionProperty: false } as any);

        expect(result.success).toEqual(false);
        if (!result.success) {
          // Needed for type narrowing
          expect(result.errors.unionProperty).toBeInstanceOf(Array);
          expect(result.errors.unionProperty.length).toBeGreaterThan(0);
          expect(result.errors.unionProperty[0].context?.unionErrors).toBeInstanceOf(Array);
          const unionPropertyError = result.errors.unionProperty[0].context?.unionErrors as unknown[];
          expect(unionPropertyError.length).toBeGreaterThan(0);
        }
      });
    });
  });

  describe('complex', () => {
    const v = new ValidatorInstance({ project });

    enum TestEnum {
      YES = 'YES',
      NO = 'NO',
    }

    @v.validatorDecorator()
    class TestEmbed {
      embeddedNumber!: number;
    }

    @v.validatorDecorator()
    class Test {
      property0!: string;
      property1!: TestEmbed;
      property2!: number;
      property3!: boolean;
      property4!: TestEnum;
      property5!: TestEnum[];
      property6!: string;
      property7!: string;
      property8!: string;
      property9!: string;
      property10!: string;
      property11!: string;
      property12!: string;
      property13!: string;
      property14!: string;
    }

    it('should validate', () => {
      v.validate(Test, {
        property0: 'property0',
        property1: { embeddedNumber: 9001 },
        property2: 123,
        property3: true,
        property4: TestEnum.YES,
        property5: [TestEnum.YES],
        property6: 'property6',
        property7: 'property7',
        property8: 'property8',
        property9: 'property9',
        property10: 'property10',
        property11: 'property11',
        property12: 'property12',
        property13: 'property13',
        property14: 'property14',
      });
    });
  });
});
