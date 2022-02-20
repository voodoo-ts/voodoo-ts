import { ValidationErrorType } from '../../nodes';
import { ValidatorInstance } from '../../validator';
import { expectValidationError, project } from '../utils';

describe('records', () => {
  const v = new ValidatorInstance({ project });

  @v.validatorDecorator()
  class Test {
    recordProperty!: Record<string, number>;
  }

  it('should construct the correct tree', () => {
    const { tree } = v.getPropertyTypeTreesFromConstructor(Test)[0];

    expect(tree).toEqual({
      kind: 'root',
      optional: false,
      children: [
        {
          kind: 'record',
          children: [
            { kind: 'string', reason: expect.anything(), children: [] },
            { kind: 'number', reason: expect.anything(), children: [] },
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

    expectValidationError(result, (result) => {
      expect(result.rawErrors).toEqual({
        recordProperty: {
          success: false,
          type: 'record',
          reason: ValidationErrorType.NOT_AN_OBJECT,
          value: false,
          previousErrors: [],
        },
      });
    });
  });

  it('should not validate record with invalid value type', () => {
    const result = v.validate(Test, { recordProperty: { one: 'one', two: 2 } as any });

    expectValidationError(result, (result) => {
      expect(result.rawErrors).toEqual({
        recordProperty: {
          success: false,
          type: 'record',
          value: { one: 'one', two: 2 },
          previousErrors: [
            {
              success: false,
              type: 'number',
              previousErrors: [],
              value: 'one',
              reason: ValidationErrorType.NOT_A_NUMBER,
            },
          ],
          context: { valueInvalid: true, key: 'one' },
        },
      });
    });
  });
});
