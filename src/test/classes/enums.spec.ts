import { ValidationErrorType } from '../../nodes';
import { ValidatorInstance } from '../../validator';
import { expectValidationError, project } from '../utils';

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

  describe('should not validate values with different type from enum', () => {
    const result = v.validate(Test, { enumProperty: 123 } as any);

    it('should not validate', () => {
      expect(result.success).toEqual(false);
    });

    it('should construct the correct error', () => {
      expectValidationError(result, (result) => {
        expect(result.rawErrors).toEqual({
          success: false,
          type: 'class',
          reason: ValidationErrorType.OBJECT_PROPERTY_FAILED,
          value: { enumProperty: 123 },
          previousErrors: [
            {
              success: false,
              type: 'enum',
              reason: ValidationErrorType.NOT_AN_ENUM,
              value: 123,
              previousErrors: [],
              context: {
                className: 'Test',
                propertyName: 'enumProperty',
                enumName: 'TestEnum',
                allowedValues: ['yes', 'no'],
              },
            },
          ],
          context: { className: 'Test' },
        });
      });
    });
  });
});
