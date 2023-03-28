import { ArrayNode, INodeValidationResult, TypeNode } from '../../nodes';
import {
  NodeValidationErrorMatcher,
  expectNodeValidationSuccess,
  mockValidate,
  mockValidationNode,
  NodeResultFixture,
} from '../fixtures';

// Import this named export into your test file:

function validateWithArrayFixture(value: unknown): INodeValidationResult {
  const opts = { values: {}, options: { allowUnknownFields: true } };
  const arrayNode = new ArrayNode();

  arrayNode.children.push(new mockValidationNode() as TypeNode);

  return arrayNode.validate(value, opts);
}

describe('ArrayNode', () => {
  beforeEach(() => {
    mockValidate.mockReset();
  });

  it('should validate empty array', () => {
    const result = validateWithArrayFixture([]);

    expect(mockValidate).toBeCalledTimes(0);
    expect(result).toEqual(expect.objectContaining(expectNodeValidationSuccess.arraySuccess()));
  });
  it('should validate array with valid value', () => {
    mockValidate.mockReturnValueOnce(NodeResultFixture.success());

    const result = validateWithArrayFixture([true]);

    expect(mockValidate).toHaveBeenCalledTimes(1);
    expect(mockValidate).toHaveBeenCalledWith(true, expect.anything());
    expect(result).toEqual(
      expectNodeValidationSuccess.arraySuccess({
        previousMatches: [
          expectNodeValidationSuccess.mockSuccess({
            context: { array: { i: 0 } },
          }),
        ],
      }),
    );
  });
  it('should not validate array with invalid value', () => {
    mockValidate.mockReturnValueOnce(NodeResultFixture.mockError('not_a_bool'));

    const result = validateWithArrayFixture(['not_a_bool']);

    expect(mockValidate).toHaveBeenCalledTimes(1);
    expect(mockValidate).toHaveBeenCalledWith('not_a_bool', expect.anything());
    expect(result).toEqual(
      NodeValidationErrorMatcher.arrayError({
        previousErrors: [
          NodeValidationErrorMatcher.arrayItemError({
            context: { element: 0 },
            previousErrors: [NodeValidationErrorMatcher.booleanError()],
          }),
        ],
      }),
    );
  });
});
