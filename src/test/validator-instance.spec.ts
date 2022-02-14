/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Project } from 'ts-morph';

import { IErrorMessage } from '../error-formatter';
import { ClassNotDecoratedError, ParseError } from '../errors';
import { ClassNode, ValidationErrorType } from '../nodes';
import { isParseError } from '../parser';
import { IValidatorClassMeta, ValidatorInstance, validatorMetadataKey, ValidateIf } from '../validator';

const project = new Project({
  tsConfigFilePath: 'tsconfig.json',
});

describe('general', () => {
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
    const classDeclaration = v.classDiscovery.getClass(Test.name, validatorMeta.filename, validatorMeta.line);

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
    const classDeclaration = v.classDiscovery.getClass(Test.name, validatorMeta.filename, validatorMeta.line);

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
    const classDeclaration = v.classDiscovery.getClass(Test.name, validatorMeta.filename, validatorMeta.line);

    expect(classDeclaration).toBeTruthy();
  });

  it('should add inherited properties', () => {
    const v = new ValidatorInstance({ project });

    @v.validatorDecorator()
    class TestBase {
      baseAttribute!: string;
    }

    @v.validatorDecorator()
    class TestDervied extends TestBase {
      derivedAttribute!: string;
    }

    @v.validatorDecorator()
    class Test extends TestDervied {}
    const validatorMeta = Reflect.getMetadata(validatorMetadataKey, Test) as IValidatorClassMeta;
    const classDeclaration = v.classDiscovery.getClass(Test.name, validatorMeta.filename, validatorMeta.line);
    const classTrees = v.getPropertyTypeTrees(Test, classDeclaration);

    expect(classTrees.length).toEqual(2);
    expect(classTrees[0].name).toEqual('baseAttribute');
    expect(classTrees[1].name).toEqual('derivedAttribute');
  });

  it('should throw for unsupported syntax nodes', () => {
    const v = new ValidatorInstance({ project });

    @v.validatorDecorator()
    class Test {
      derivedAttribute!: symbol;
    }

    const validatorMeta = Reflect.getMetadata(validatorMetadataKey, Test) as IValidatorClassMeta;
    const classDeclaration = v.classDiscovery.getClass(Test.name, validatorMeta.filename, validatorMeta.line);
    const classTreesWrapper = () => v.getPropertyTypeTrees(Test, classDeclaration);

    expect(classTreesWrapper).toThrow(ParseError);
  });

  it('should throw for unsupported type symbols', () => {
    const v = new ValidatorInstance({ project });

    @v.validatorDecorator()
    class Test {
      unknownAttribute!: Pick<{ a: number }, 'a'>;
    }

    const validatorMeta = Reflect.getMetadata(validatorMetadataKey, Test) as IValidatorClassMeta;
    const classDeclaration = v.classDiscovery.getClass(Test.name, validatorMeta.filename, validatorMeta.line);
    const classTreesWrapper = () => v.getPropertyTypeTrees(Test, classDeclaration);

    expect(classTreesWrapper).toThrow(ParseError);
  });

  it('should throw if class is not decorated (v.getClassMetadata)', () => {
    const v = new ValidatorInstance({ project });

    class Test {
      attribute!: string;
    }

    const result = () => v.getClassMetadata(Test);

    expect(result).toThrow(ClassNotDecoratedError);
  });

  it('should throw if class is not decorated (v.validate)', () => {
    const v = new ValidatorInstance({ project });

    class Test {
      attribute!: string;
    }

    const result = () => v.validate(Test, { attribute: 'blorb' });

    expect(result).toThrow(ClassNotDecoratedError);
  });

  describe('@ValidateIf', () => {
    const v = new ValidatorInstance({ project });

    @v.validatorDecorator()
    class Test {
      @ValidateIf((obj: Test) => obj.otherAttribute)
      firstAttribute!: string;
      otherAttribute!: boolean;
    }

    it('should validate with valid string and otherAttribute = true', () => {
      const result = v.validate(Test, {
        firstAttribute: 'string',
        otherAttribute: true,
      });

      expect(result.success).toEqual(true);
    });

    it('should not validate with invalid string and otherAttribute = true', () => {
      const result = v.validate(Test, {
        firstAttribute: 123,
        otherAttribute: true,
      } as any);

      expect(result.success).toEqual(false);
    });

    it('should validate with invalid string and otherAttribute = false', () => {
      const result = v.validate(Test, {
        firstAttribute: 123,
        otherAttribute: false,
      } as any);

      expect(result.success).toEqual(true);
    });
  });

  describe('unknown attributes', () => {
    const v = new ValidatorInstance({ project });

    @v.validatorDecorator()
    class Test {
      attribute!: string;
    }
    it('should not allow unknown attributes by default', () => {
      const result = v.validate(Test, { notTheAttribute: 'blorb' });

      expect(result.success).toEqual(false);
    });

    it('should allow unknown attributes if allowUnknownFields is set', () => {
      const result = v.validate(Test, { attribute: 'Test', notTheAttribute: 'blorb' }, { allowUnknownFields: true });

      expect(result.success).toEqual(true);
    });
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

  describe('tuple', () => {
    const v = new ValidatorInstance({ project });

    @v.validatorDecorator()
    class Test {
      tupleProperty!: [number, string, boolean];
    }

    it('should construct the correct tree', () => {
      const validatorMeta = Reflect.getMetadata(validatorMetadataKey, Test) as IValidatorClassMeta;
      const classDeclaration = v.classDiscovery.getClass(Test.name, validatorMeta.filename, validatorMeta.line);
      const trees = v.getPropertyTypeTrees(Test, classDeclaration);
      const tupleTree = trees[0];

      expect(tupleTree.tree).toEqual({
        kind: 'root',
        children: [
          {
            kind: 'tuple',
            children: [
              { kind: 'number', reason: 'NOT_A_NUMBER', children: [] },
              { kind: 'string', reason: 'NOT_A_STRING', children: [] },
              { kind: 'boolean', reason: 'NOT_A_BOOLEAN', children: [] },
            ],
          },
        ],
        optional: false,
      });
    });

    it('should validate valid tuples', () => {
      const result = v.validate(Test, { tupleProperty: [1, 'two', false] });

      expect(result.success).toEqual(true);
    });

    it('should not validate empty tuples', () => {
      const result = v.validate(Test, { tupleProperty: [] as any });

      expect(result.success).toEqual(false);
    });

    it('should fail for invalid tuple elements', () => {
      const result = v.validate(Test, { tupleProperty: [1, 'two', 'three'] } as any);

      expect(result.success).toEqual(false);
      if (!result.success) {
        // Needed for type narrowing
        expect(result.errors.tupleProperty).toBeTruthy();
      }
    });

    it('should fail for invalid types', () => {
      const result = v.validate(Test, { tupleProperty: 123 } as any);

      expect(result.success).toEqual(false);
      if (!result.success) {
        // Needed for type narrowing
        expect(result.errors.tupleProperty).toBeTruthy();
      }
    });

    it('should fail if property is undefined', () => {
      const result = v.validate(Test, {} as any);

      expect(result.success).toEqual(false);
      if (!result.success) {
        // Needed for type narrowing
        expect(result.errors.tupleProperty).toBeTruthy();
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

        it('should construct the tree correctly', () => {
          const { filename, line } = v.getClassMetadata(Test);
          const cls = v.classDiscovery.getClass('Test', filename, line);
          const trees = v.getPropertyTypeTrees(Test, cls);

          expect(trees[0].tree.children[0].kind).toEqual('class');
          expect((trees[0].tree.children[0] as ClassNode).getClassTrees().map((t) => t.name)).toEqual([
            'embeddedProperty1',
            'embeddedProperty3',
          ]);
        });

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
          try {
            v.validate(Test, {
              embeddedObject: { embeddedProperty1: '123' },
            });
          } catch (error) {
            expect(error).toBeInstanceOf(ParseError);
            if (isParseError(error)) {
              expect(error.context.class).toBeTruthy();
              expect(error.context.asText).toBeTruthy();
            }
          }
        });
      });
    });
  });

  describe('union', () => {
    describe('simple -> (string | number)', () => {
      const v = new ValidatorInstance({ project });

      @v.validatorDecorator()
      class Test {
        unionProperty!: string | number;
      }

      it('should validate string', () => {
        const result = v.validate(Test, { unionProperty: 'one' });

        expect(result.success).toEqual(true);
      });

      it('should validate number', () => {
        const result = v.validate(Test, { unionProperty: 2 });

        expect(result.success).toEqual(true);
      });

      it('should not validate undefined', () => {
        const result = v.validate(Test, {});

        expect(result.success).toEqual(false);
        if (!result.success) {
          expect(result.errors.unionProperty).toBeInstanceOf(Array);
          expect(result.errors.unionProperty.length).toEqual(1);
          expect(result.errors.unionProperty[0].reason).toEqual(ValidationErrorType.VALUE_REQUIRED);
        }
      });

      it('should not validate boolean', () => {
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
    describe('optional ->  (string | number)?', () => {
      const v = new ValidatorInstance({ project });

      @v.validatorDecorator()
      class Test {
        unionProperty?: string | number;
      }

      it('should remove undefined from the root property', () => {
        const validatorMeta = Reflect.getMetadata(validatorMetadataKey, Test) as IValidatorClassMeta;
        const classDeclaration = v.classDiscovery.getClass(Test.name, validatorMeta.filename, validatorMeta.line);
        const trees = v.getPropertyTypeTrees(Test, classDeclaration);

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

      it('should validate string', () => {
        const result = v.validate(Test, { unionProperty: 'one' });

        expect(result.success).toEqual(true);
      });

      it('should validate number', () => {
        const result = v.validate(Test, { unionProperty: 2 });

        expect(result.success).toEqual(true);
      });

      it('should validate undefined', () => {
        const result = v.validate(Test, {});

        expect(result.success).toEqual(true);
      });

      it('should not validate boolean', () => {
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

    describe('with nesting -> (string | number | TestEmbed)?', () => {
      const v = new ValidatorInstance({ project });

      @v.validatorDecorator()
      class TestEmbed {
        embeddedNumber!: number;
      }

      @v.validatorDecorator()
      class Test {
        unionProperty?: string | number | TestEmbed;
      }

      it('should validate string', () => {
        const result = v.validate(Test, { unionProperty: 'one' });

        expect(result.success).toEqual(true);
      });

      it('should validate number', () => {
        const result = v.validate(Test, { unionProperty: 2 });

        expect(result.success).toEqual(true);
      });

      it('should validate undefined', () => {
        const result = v.validate(Test, {});

        expect(result.success).toEqual(true);
      });

      it('should validate embedded object', () => {
        const result = v.validate(Test, { unionProperty: { embeddedNumber: 123 } });

        expect(result.success).toEqual(true);
      });

      it('should not validate boolean', () => {
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

    describe('null -> (string | null)', () => {
      const v = new ValidatorInstance({ project });

      @v.validatorDecorator()
      class Test {
        unionProperty!: string | null;
      }

      it('should validate string', () => {
        const result = v.validate(Test, { unionProperty: 'one' });

        expect(result.success).toEqual(true);
      });

      it('should validate null', () => {
        const result = v.validate(Test, { unionProperty: null });

        expect(result.success).toEqual(true);
      });

      it('should not validate undefined', () => {
        const result = v.validate(Test, {});

        expect(result.success).toEqual(false);
        if (!result.success) {
          expect(result.errors.unionProperty).toBeInstanceOf(Array);
          expect(result.errors.unionProperty.length).toEqual(1);
          expect(result.errors.unionProperty[0].reason).toEqual(ValidationErrorType.VALUE_REQUIRED);
        }
      });

      it('should not validate boolean', () => {
        const result = v.validate(Test, { unionProperty: false } as any);

        expect(result.success).toEqual(false);
        if (!result.success) {
          // Needed for type narrowing
          expect(result.errors.unionProperty).toBeInstanceOf(Array);
          expect(result.errors.unionProperty.length).toBeGreaterThan(0);
          expect(result.errors.unionProperty[0].context?.unionErrors).toBeInstanceOf(Array);

          const unionPropertyErrors = result.errors.unionProperty[0].context?.unionErrors as IErrorMessage[];
          expect(unionPropertyErrors.length).toBeGreaterThan(0);
          expect(unionPropertyErrors).toEqual(['null', 'string']);
        }
      });
    });

    describe('undefined -> (string | undefined)', () => {
      const v = new ValidatorInstance({ project });

      @v.validatorDecorator()
      class Test {
        unionProperty!: string | undefined;
      }

      it('should construct the tree correctly', () => {
        const validatorMeta = Reflect.getMetadata(validatorMetadataKey, Test) as IValidatorClassMeta;
        const classDeclaration = v.classDiscovery.getClass(Test.name, validatorMeta.filename, validatorMeta.line);
        const trees = v.getPropertyTypeTrees(Test, classDeclaration);
        const unionPropertyTree = trees[0].tree;

        expect(unionPropertyTree).toEqual({
          children: [{ children: [], kind: 'string', reason: 'NOT_A_STRING' }],
          kind: 'root',
          optional: true,
        });
        console.log(unionPropertyTree);
      });

      it('should validate string', () => {
        const result = v.validate(Test, { unionProperty: 'one' });

        expect(result.success).toEqual(true);
      });

      it('should not validate null', () => {
        const result = v.validate(Test, { unionProperty: null } as any);

        expect(result.success).toEqual(false);
      });

      it('should validate undefined', () => {
        const result = v.validate(Test, {} as any);

        expect(result.success).toEqual(true);
      });

      it('should not validate boolean', () => {
        const result = v.validate(Test, { unionProperty: false } as any);

        expect(result.success).toEqual(false);
        if (!result.success) {
          // Needed for type narrowing
          expect(result.errors.unionProperty).toBeInstanceOf(Array);
          expect(result.errors.unionProperty.length).toBeGreaterThan(0);
          expect(result.errors.unionProperty[0].reason).toEqual(ValidationErrorType.NOT_A_STRING);
        }
      });
    });
  });

  describe('interface', () => {
    const v = new ValidatorInstance({ project });

    interface ITest {
      test: number;
    }

    interface ITest2 extends ITest {
      stringProperty: string;
    }
    @v.validatorDecorator()
    class Test {
      embedded!: ITest;
      embedded1!: ITest;
      embedded2!: ITest2;
      embedded3!: {
        inlineNumberProperty: number;
      };
    }

    it('should validate', () => {
      const result = v.validate(Test, {
        embedded: { test: 1 },
        embedded1: { test: 2 },
        embedded2: { test: 3, stringProperty: 'test' },
        embedded3: { inlineNumberProperty: 234 },
      });
      console.log(result);
      console.log(v.parser.classTreeCache.map.values());
      expect(result.success).toEqual(true);
    });
  });

  describe('records', () => {
    const v = new ValidatorInstance({ project });

    @v.validatorDecorator()
    class Test {
      recordProperty!: Record<string, number>;
    }

    it('should construct the correct tree', () => {
      const validatorMeta = Reflect.getMetadata(validatorMetadataKey, Test) as IValidatorClassMeta;
      const classDeclaration = v.classDiscovery.getClass(Test.name, validatorMeta.filename, validatorMeta.line);
      const trees = v.getPropertyTypeTrees(Test, classDeclaration);
      const tupleTree = trees[0];

      expect(tupleTree.tree).toEqual({
        kind: 'root',
        optional: false,
        children: [
          {
            kind: 'record',
            children: [
              { kind: 'string', reason: 'NOT_A_STRING', children: [] },
              { kind: 'number', reason: 'NOT_A_NUMBER', children: [] },
            ],
          },
        ],
      });
    });

    it('should validate a record', () => {
      const result = v.validate(Test, { recordProperty: { one: 1, two: 2 } });

      expect(result.success).toEqual(true);
    });

    it('should validate an empty record', () => {
      const result = v.validate(Test, { recordProperty: {} });

      expect(result.success).toEqual(true);
    });

    it('should not validate an invalid type', () => {
      const result = v.validate(Test, { recordProperty: false as any });

      expect(result.success).toEqual(false);
    });

    it('should not validate record with invalid value type', () => {
      const result = v.validate(Test, { recordProperty: { one: 'one', two: 2 } as any });

      expect(result.success).toEqual(false);
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
      property15!: [number, string];
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
