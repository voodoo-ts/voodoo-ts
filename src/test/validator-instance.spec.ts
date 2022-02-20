/* eslint-disable @typescript-eslint/no-unsafe-argument */

import { ClassNotDecoratedError, ParseError } from '../errors';
import { IClassMeta } from '../source-code-location-decorator';
import { ValidatorInstance, validatorMetadataKey, ValidateIf } from '../validator';
import { project } from './utils';

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

  it('should throw for unsupported type symbols', () => {
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
