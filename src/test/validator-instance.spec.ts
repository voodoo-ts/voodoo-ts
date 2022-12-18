/* eslint-disable @typescript-eslint/no-unsafe-argument */

import { ValidateIf } from '../decorators';
import { ClassNotDecoratedError, ParseError } from '../errors';
import { TypeNodeData, ValidationErrorType } from '../nodes';
import { ValidatorInstance } from '../validator';
import { expectValidationError, project } from './utils';

/*

# Rules

@Validator()
class EmbeddedValidator {
  prop1!: number;
}

@Transformer()
class EmbeddedTransformer {
  prop2!: Transformed<string, number>;
}

@Transformer()
class TestTransformer {
  prop1!: EmbeddedValidator;
  prop2!: EmbeddedTransformer;
  prop3!: EmbeddedValidator | EmbeddedTransformer;
  prop4!: EmbeddedTransformer | null;
  prop5?: EmbeddedTransformer;
  
}

*/

describe('general', () => {
  it('should construct', () => {
    const instance = new ValidatorInstance({ project });
    expect(instance).toBeTruthy();
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
    const trees = v.getPropertyTypeTreesFromConstructor(Test);

    expect(trees.length).toEqual(2);
    expect(trees[0].name).toEqual('baseAttribute');
    expect(trees[1].name).toEqual('derivedAttribute');
  });

  it('should throw for unsupported syntax nodes', () => {
    const v = new ValidatorInstance({ project });

    @v.validatorDecorator()
    class Test {
      derivedAttribute!: symbol;
    }

    const classTreesWrapper = () => v.getPropertyTypeTreesFromConstructor(Test);

    expect(classTreesWrapper).toThrow(ParseError);
  });

  it.skip('should throw for unsupported type symbols', () => {
    const v = new ValidatorInstance({ project });

    @v.validatorDecorator()
    class Test {
      unknownAttribute!: Exclude<1 | 0, 0>;
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

    @v.validatorDecorator()
    class Test {
      @ValidateIf((obj: Test) => obj.otherAttribute)
      firstAttribute!: string;
      otherAttribute!: boolean;
    }

    it('should construct the tree correctly', () => {
      const { tree } = v.getPropertyTypeTreesFromConstructor(Test)[0];
      expect(tree).toEqual({
        kind: 'root',
        children: [
          {
            kind: 'string',
            reason: expect.anything(),
            children: [],
            annotations: {},
          },
        ],
        annotations: {
          validateIf: expect.any(Function),
        },
        optional: false,
      } as TypeNodeData);
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
          expect(result.rawErrors).toEqual({
            success: false,
            type: 'class',
            reason: ValidationErrorType.OBJECT_PROPERTY_FAILED,
            value: { firstAttribute: 123, otherAttribute: true },
            context: { className: 'Test' },
            previousErrors: [
              {
                success: false,
                type: 'string',
                reason: ValidationErrorType.NOT_A_STRING,
                value: 123,
                previousErrors: [],
                context: {
                  className: 'Test',
                  propertyName: 'firstAttribute',
                },
              },
            ],
          });
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

    @v.validatorDecorator()
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

      @v.validatorDecorator()
      class Test {}
      const result = v.validate(Test, {});

      expect(result.success).toEqual(true);
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
      property14!: Array<string | TestEmbed>;
      property15!: [number, string];
    }

    it('should validate', () => {
      // console.time('a');
      // for (let i = 0; i < 10000; i++) {
      const result = v.validate(Test, {
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
      // }
      // console.timeEnd('a');
    });
  });
});
