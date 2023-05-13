import {
  IsEmail,
  IsFQDN,
  IsISO8601,
  IsInteger,
  IsNumber,
  IsNumberList,
  Length,
  LengthValidationError,
  NumberListValidationError,
  NumberValidationError,
  Range,
  Regexp,
  StringValidationError,
} from '../../decorators';
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
          ['$.test']: {
            message: `Value "test" can't be parsed as integer`,
            code: StringValidationError.INVALID_INTEGER_STRING,
            context: {},
          },
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
          ['$.test']: {
            message: `Value "test" can't be parsed as float`,
            code: StringValidationError.INVALID_NUMBER_STRING,
            context: {},
          },
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
            ['$.test']: {
              message: `Value 9001 is out of range (2, 5)`,
              code: NumberValidationError.OUT_OF_RANGE,
              context: { min: 2, max: 5 },
            },
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
              code: NumberValidationError.OUT_OF_RANGE,
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
        ['$.test']: {
          message: `Item at index 0 in number list is not a valid integer`,
          code: NumberListValidationError.INVALID_NUMBER_LIST_ITEM,
          context: { i: 0 },
        },
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
            code: LengthValidationError.LENGTH_FAILED,
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
            code: LengthValidationError.LENGTH_FAILED,
            context: { min: 2, length: 1 },
          },
        });
      });
    });
  });
});

describe('@IsEmail()', () => {
  const t = new TransformerInstance({ project });

  @t.transformerDecorator()
  class Test {
    @IsEmail()
    test!: string;
  }

  it('should validate "mail@example.com"', async () => {
    const result = await t.transform(Test, { test: 'mail@example.com' });
    expect(result.success).toBeTrue();
  });

  it('should not validate "mail@"', async () => {
    const result = await t.transform(Test, { test: 'mail@' });
    expect(result.success).toBeFalse();
  });

  it('should format errors correctly', async () => {
    const result = await t.transform(Test, { test: 'mail@' });
    expectValidationError(result, ({ errors }) => {
      expect(errors).toEqual({
        ['$.test']: {
          message: `Value "mail@" is not an ISO 8601 string`,
          code: StringValidationError.INVALID_EMAIL,
          context: {},
        },
      });
    });
  });
});

describe('@IsISO8601()', () => {
  const t = new TransformerInstance({ project });

  @t.transformerDecorator()
  class Test {
    @IsISO8601()
    test!: string;
  }

  it('should validate "2023-05-05T22:46:37.142Z"', async () => {
    const result = await t.transform(Test, { test: '2023-05-05T22:46:37.142Z' });
    expect(result.success).toBeTrue();
  });

  it('should not validate "mail@"', async () => {
    const result = await t.transform(Test, { test: 'mail@' });
    expect(result.success).toBeFalse();
  });

  it('should format errors correctly', async () => {
    const result = await t.transform(Test, { test: 'mail@' });
    expectValidationError(result, ({ errors }) => {
      expect(errors).toEqual({
        ['$.test']: {
          message: `Value "mail@" is not an ISO 8601 string`,
          code: StringValidationError.INVALID_ISO_8601_STRING,
          context: {},
        },
      });
    });
  });
});

describe('@IsFQDN()', () => {
  const t = new TransformerInstance({ project });

  @t.transformerDecorator()
  class Test {
    @IsFQDN()
    test!: string;
  }

  it('should validate "www.example.com"', async () => {
    const result = await t.transform(Test, { test: 'www.example.com' });
    expect(result.success).toBeTrue();
  });

  it('should not validate "mail@"', async () => {
    const result = await t.transform(Test, { test: 'mail@' });
    expect(result.success).toBeFalse();
  });

  it('should format errors correctly', async () => {
    const result = await t.transform(Test, { test: 'mail@' });
    expectValidationError(result, ({ errors }) => {
      expect(errors).toEqual({
        ['$.test']: {
          message: `Value "mail@" is not a valid FQDN`,
          code: StringValidationError.INVALID_FQDN,
          context: {},
        },
      });
    });
  });
});

describe('@Regexp()', () => {
  const t = new TransformerInstance({ project });

  @t.transformerDecorator()
  class Test {
    @Regexp(/^[a-z][0-9]$/)
    test!: string;
  }

  it('should validate "a1"', async () => {
    const result = await t.transform(Test, { test: 'a1' });
    expect(result.success).toBeTrue();
  });

  it('should not validate "aa"', async () => {
    const result = await t.transform(Test, { test: 'aa' });
    expect(result.success).toBeFalse();
  });

  it('should format errors correctly', async () => {
    const result = await t.transform(Test, { test: 'aa' });
    expectValidationError(result, ({ errors }) => {
      expect(errors).toEqual({
        ['$.test']: {
          code: StringValidationError.NO_REGEX_MATCH,
          context: {
            pattern: /^[a-z][0-9]$/,
          },
          message: 'Value "aa" does not match regex /^[a-z][0-9]$/',
        },
      });
    });
  });
});
