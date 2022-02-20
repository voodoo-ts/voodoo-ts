import { ValidatorInstance } from '../../validator';
import { expectValidationError, project } from '../utils';

describe('optional', () => {
  const v = new ValidatorInstance({ project });

  @v.validatorDecorator()
  class Test {
    stringProperty?: string;
  }

  it('should construct the correct tree', () => {
    const { tree } = v.getPropertyTypeTreesFromConstructor(Test)[0];

    expect(tree).toEqual({
      kind: 'root',
      children: [
        {
          kind: 'string',
          children: [],
          reason: expect.anything(),
        },
      ],
      optional: true,
    });
  });

  it('should validate optional string with valid string', () => {
    const result = v.validate(Test, { stringProperty: 'This is a string.' });

    expect(result.success).toEqual(true);
  });

  it('should not fail optional string if undefined', () => {
    const result = v.validate(Test, {} as any);
    expect(result.success).toEqual(true);
  });

  it('should fail optional string for invalid strings', () => {
    const result = v.validate(Test, { stringProperty: 123 } as any);

    expectValidationError(result, (result) => {
      expect(result.rawErrors).toEqual({
        stringProperty: {
          success: false,
          type: 'string',
          value: 123,
          previousErrors: [],
          reason: 'NOT_A_STRING',
        },
      });
    });
  });

  it('should fail optional string for null', () => {
    const result = v.validate(Test, { stringProperty: null } as any);

    expectValidationError(result, (result) => {
      expect(result.rawErrors).toEqual({
        stringProperty: {
          success: false,
          type: 'string',
          value: null,
          previousErrors: [],
          reason: 'NOT_A_STRING',
        },
      });
    });
  });
});
