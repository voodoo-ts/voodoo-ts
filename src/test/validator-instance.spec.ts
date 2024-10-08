/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-shadow */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

import { expectAnyFunction, NodeValidationErrorMatcher, RootNodeFixture, StringNodeFixture } from './fixtures';
import { expectValidationError, project } from './utils';
import { ValidateIf } from '../decorators';
import { ClassNotDecoratedError, ParseError } from '../errors';
import { ClassNode, IAnnotationMap } from '../nodes';
import { TransformerInstance } from '../transformer';
import { ValidatorInstance } from '../validator';

describe('general', () => {
  it('should construct', () => {
    const instance = new ValidatorInstance({ project });
    expect(instance).toBeTruthy();
  });

  it('should add inherited properties', () => {
    const v = new ValidatorInstance({ project });

    @v.transformerDecorator()
    class TestBase {
      baseAttribute!: string;
    }

    @v.transformerDecorator()
    class TestDervied extends TestBase {
      derivedAttribute!: string;
    }

    @v.transformerDecorator()
    class Test extends TestDervied {}
    const trees = v.getPropertyTypeTreesFromConstructor(Test);

    expect(trees.length).toEqual(2);
    expect(trees[0].name).toEqual('baseAttribute');
    expect(trees[1].name).toEqual('derivedAttribute');
  });

  it('should not do anything for getters, methods and static variables', () => {
    const v = new ValidatorInstance({ project });

    @v.transformerDecorator()
    class Test {
      static foo = 'bar';

      get foo() {
        return 'bar';
      }

      test() {
        return 'foo';
      }
    }

    expect(v.getPropertyTypeTreesFromConstructor(Test).length).toEqual(0);
  });

  it('should support computed properties from string literals', () => {
    const v = new ValidatorInstance({ project });

    @v.transformerDecorator()
    class Test {
      ['🦙']!: string;
      ['""']!: string;
      // prettier-ignore
      ['\'']!: string;
      ['A']!: string;
      [' ']!: string;
    }

    const names = v.getPropertyTypeTreesFromConstructor(Test).map(({ name }) => name);

    expect(names).toEqual(['🦙', '""', "'", 'A', ' ']);
  });

  it('should capture property comments', () => {
    const v = new ValidatorInstance({ project });

    @v.transformerDecorator()
    class Test {
      /**
       * Test foo
       *
       * @description Some description
       * @example "some example"
       */
      property!: string;

      // Test
      property2!: string;
    }

    const { tree } = v.getPropertyTypeTreesFromConstructor(Test)[0];
    expect(tree.annotations.comment).toEqual({
      description: expect.stringMatching('Test foo'),
      tags: [
        { tagName: 'description', text: 'Some description' },
        { tagName: 'example', text: '"some example"' },
      ],
    });
  });

  it('should capture class comments', () => {
    const v = new ValidatorInstance({ project });

    /**
     * Test foo
     *
     * Second paragraph
     *
     * @description Some description
     */
    @v.transformerDecorator()
    class Test {
      property!: string;
    }

    const cls = v.getClassNode(Test);

    expect(cls.annotations.comment).toEqual({
      description: 'Test foo\n\nSecond paragraph',
      tags: [{ tagName: 'description', text: 'Some description' }],
    });
  });

  it('should throw for computed properties not from string literals', () => {
    const v = new ValidatorInstance({ project });

    const propertyName = '🦙';
    @v.transformerDecorator()
    class Test {
      [propertyName]!: string;
    }

    const classTreesWrapper = () => v.getPropertyTypeTreesFromConstructor(Test);

    expect(classTreesWrapper).toThrow(ParseError);
  });

  it('should throw for unsupported syntax nodes', () => {
    const v = new ValidatorInstance({ project });

    @v.transformerDecorator()
    class Test {
      derivedAttribute!: symbol;
    }

    const classTreesWrapper = () => v.getPropertyTypeTreesFromConstructor(Test);

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
    const validateIfFunction = (obj: Test) => obj.otherAttribute;
    @v.transformerDecorator()
    class Test {
      @ValidateIf(validateIfFunction)
      firstAttribute!: string;
      otherAttribute!: boolean;
    }

    it('should construct the tree correctly', () => {
      const { tree } = v.getPropertyTypeTreesFromConstructor(Test)[0];
      expect(tree).toEqual(
        RootNodeFixture.createRequired({
          children: [StringNodeFixture.create()],
          annotations: {
            validateIf: expectAnyFunction(),
            hasInitializer: false,
          },
        }),
      );
    });

    it('should validate with valid string and otherAttribute = true', () => {
      const result = v.validate(Test, {
        firstAttribute: 'string',
        otherAttribute: true,
      });

      expect(result.success).toEqual(true);
    });

    describe('should not validate with invalid string and otherAttribute = true', () => {
      const result = v.validate(Test, {
        firstAttribute: 123,
        otherAttribute: true,
      } as any);

      it('should not validate', () => {
        expect(result.success).toEqual(false);
      });

      it('should construct the correct error', () => {
        expectValidationError(result, (result) => {
          expect(result.rawErrors).toEqual(
            NodeValidationErrorMatcher.objectPropertyFailed(Test, {
              previousErrors: [
                NodeValidationErrorMatcher.rootError(Test, 'firstAttribute', {
                  annotations: {
                    validateIf: validateIfFunction as IAnnotationMap['validateIf'],
                    hasInitializer: false,
                  },
                  previousErrors: [NodeValidationErrorMatcher.stringError()],
                }),
              ],
            }),
          );
        });
      });
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

    @v.transformerDecorator()
    class Test {
      attribute!: string;
    }
    it('should not allow unknown attributes by default', () => {
      const result = v.validate(Test, { attribute: '123', notTheAttribute: 'blorb' });

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

      @v.transformerDecorator()
      class Test {}
      const result = v.validate(Test, {});

      expect(result.success).toEqual(true);
    });

    it('should cache class nodes', () => {
      const v = new ValidatorInstance({ project });

      @v.transformerDecorator()
      class Test {}

      const validatorMeta = v.getClassMetadata(Test);
      const classDeclaration = v.classDiscovery.getClass(
        Test.name,
        validatorMeta.filename,
        validatorMeta.line,
        validatorMeta.column,
      );

      expect(v.parser.classNodeCache.size).toEqual(0);
      const node = v.parser.getCachedClassNode(classDeclaration);
      expect(node).toBeInstanceOf(ClassNode);
      expect(v.parser.classNodeCache.size).toEqual(1);
      const cachedNode = v.parser.getCachedClassNode(classDeclaration);
      expect(cachedNode).toBeInstanceOf(ClassNode);
      expect(Object.is(node, cachedNode)).toBeTrue();
    });
  });

  describe('complex', () => {
    const v = new TransformerInstance({ project });

    enum TestEnum {
      YES = 'YES',
      NO = 'NO',
    }

    @v.transformerDecorator()
    class TestEmbed {
      embeddedNumber!: number;
    }

    @v.transformerDecorator()
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
      property14!: Array<string | TestEmbed>;
      property15!: [number, string];
    }

    it('should validate', async () => {
      console.time();
      for (let i = 0; i < 100_000; i++) {
        const result = await v.transform(Test, {
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
          property14: ['1', { embeddedNumber: 1 }, '2', { embeddedNumber: 2 }],
          property15: [123, 'string'],
        });
        if (!result.success) {
          throw new Error('');
        }
      }
      console.timeEnd();
    });
  });
});
