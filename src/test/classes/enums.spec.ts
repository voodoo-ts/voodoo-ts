/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { ValidatorInstance } from '../../validator';
import { NodeValidationErrorMatcher } from '../fixtures';
import { expectValidationError, project } from '../utils';

describe('enums', () => {
  const v = new ValidatorInstance({ project });

  enum TestEnum {
    YES = 'yes',
    NO = 'no',
  }
  @v.transformerDecorator()
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
        expect(result.rawErrors).toEqual(
          NodeValidationErrorMatcher.objectPropertyFailedForClass(Test, 'enumProperty', {
            previousErrors: [
              NodeValidationErrorMatcher.enumError({
                context: {
                  enumName: 'TestEnum',
                  allowedValues: ['yes', 'no'],
                },
              }),
            ],
          }),
        );
      });
    });
  });
});
