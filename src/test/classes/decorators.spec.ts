import { IsInteger, IsNumber, IsNumberList, Length, Range } from '../../decorators';
import { TransformerInstance } from '../../transformer';
import { expectValidationError, project } from '../utils';

describe('Decorators', () => {
  describe('@IsInteger()', () => {
    const t = new TransformerInstance({ project });

    @t.transformerDecorator()
    class Test {
      @IsInteger()
      test!: string;
    }

    it('should validate "123"', async () => {
      const result = await t.transform(Test, { test: '123' });
      expect(result.success).toBeTrue();
    });

    it('should not validate "test"', async () => {
      const result = await t.transform(Test, { test: 'test' });
      expect(result.success).toBeFalse();
    });

    it('should format errors correctly', async () => {
      const result = await t.transform(Test, { test: 'test' });
      expectValidationError(result, ({ errors }) => {
        expect(errors).toEqual({
          ['$.test']: { message: `Value "test" can't be parsed as integer`, context: {} },
        });
      });
    });
  });

  describe('@IsNumber()', () => {
    const t = new TransformerInstance({ project });

    @t.transformerDecorator()
    class Test {
      @IsNumber()
      test!: string;
    }

    it('should validate "123"', async () => {
      const result = await t.transform(Test, { test: '123' });
      expect(result.success).toBeTrue();
    });

    it('should not validate "test"', async () => {
      const result = await t.transform(Test, { test: 'test' });
      expect(result.success).toBeFalse();
    });

    it('should format errors correctly', async () => {
      const result = await t.transform(Test, { test: 'test' });
      expectValidationError(result, ({ errors }) => {
        expect(errors).toEqual({
          ['$.test']: { message: `Value "test" can't be parsed as float`, context: {} },
        });
      });
    });
  });

  describe('@Range()', () => {
    const t = new TransformerInstance({ project });

    @t.transformerDecorator()
    class TestWithMinMax {
      @Range(2, 5)
      test!: number;
    }

    @t.transformerDecorator()
    class TestWithMin {
      @Range(10)
      test!: number;
    }

    describe('@Range(2, 5)', () => {
      it('should validate 3', async () => {
        const result = await t.transform(TestWithMinMax, { test: 3 });
        expect(result.success).toBeTrue();
      });

      it('should not validate 9001', async () => {
        const result = await t.transform(TestWithMinMax, { test: 9001 });
        expect(result.success).toBeFalse();
      });

      it('should format errors correctly', async () => {
        const result = await t.transform(TestWithMinMax, { test: 9001 });
        expectValidationError(result, ({ errors }) => {
          expect(errors).toEqual({
            ['$.test']: { message: `Value 9001 is out of range (2, 5)`, context: { min: 2, max: 5 } },
          });
        });
      });
    });

    describe('@Range(10)', () => {
      it('should format errors correctly', async () => {
        const result = await t.transform(TestWithMin, { test: 1 });

        expectValidationError(result, ({ errors }) => {
          expect(errors).toEqual({
            ['$.test']: {
              message: `Value 1 is out of range (10, MAX_SAFE_INTEGER)`,
              context: { min: 10, max: undefined },
            },
          });
        });
      });
    });
  });
});

describe('@IsNumberList()', () => {
  const t = new TransformerInstance({ project });

  @t.transformerDecorator()
  class Test {
    @IsNumberList()
    test!: string;
  }

  it('should validate "1,2"', async () => {
    const result = await t.transform(Test, { test: '1,2' });
    expect(result.success).toBeTrue();
  });

  it('should not validate "test"', async () => {
    const result = await t.transform(Test, { test: 'test' });
    expect(result.success).toBeFalse();
  });

  it('should format errors correctly', async () => {
    const result = await t.transform(Test, { test: 'test' });
    expectValidationError(result, ({ errors }) => {
      expect(errors).toEqual({
        ['$.test']: { message: `Item at index 0 in number list is not a valid integer`, context: { i: 0 } },
      });
    });
  });
});

describe('@Length()', () => {
  const t = new TransformerInstance({ project });

  @t.transformerDecorator()
  class TestWithMinMax {
    @Length(2, 5)
    test!: string;
  }

  @t.transformerDecorator()
  class TestWithMin {
    @Length(2)
    test!: string;
  }

  describe('@Length(2, 5)', () => {
    it('should validate "123"', async () => {
      const result = await t.transform(TestWithMinMax, { test: '122' });
      expect(result.success).toBeTrue();
    });

    it('should not validate "123456"', async () => {
      const result = await t.transform(TestWithMinMax, { test: '123456' });
      expect(result.success).toBeFalse();
    });

    it('should format errors correctly', async () => {
      const result = await t.transform(TestWithMinMax, { test: '123456' });
      expectValidationError(result, ({ errors }) => {
        expect(errors).toEqual({
          ['$.test']: {
            message: `Length of '123456' must be at least 2 and at most 5`,
            context: { min: 2, max: 5, length: 6 },
          },
        });
      });
    });
  });

  describe('@Length(2)', () => {
    it('should format errors correctly', async () => {
      const result = await t.transform(TestWithMin, { test: '1' });
      expectValidationError(result, ({ errors }) => {
        expect(errors).toEqual({
          ['$.test']: {
            message: `Length of '1' must be at least 2 and at most MAX_SAFE_INTEGER`,
            context: { min: 2, length: 1 },
          },
        });
      });
    });
  });
});
