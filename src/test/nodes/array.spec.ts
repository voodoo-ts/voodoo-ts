import { ArrayNode, INodeValidationResult, TypeNode } from '../../nodes';
import {
  NodeValidationErrorMatcher,
  expectNodeValidationSuccess,
  mockValidate,
  mockValidationNode,
  NodeResultFixture,
} from '../fixtures';

const VALIDATION_OPTIONS = { values: {}, options: { allowUnknownFields: true } };

function getArrayNodeFixture(): ArrayNode {
  const arrayNode = new ArrayNode();

  arrayNode.children.push(new mockValidationNode() as TypeNode);

  return arrayNode;
}

function validateWithArrayFixture(value: unknown): INodeValidationResult {
  const arrayNode = getArrayNodeFixture();
  return arrayNode.validate(value, VALIDATION_OPTIONS);
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
    expect(mockValidate).toHaveBeenCalledWith(true, VALIDATION_OPTIONS);
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

  it('should validate array with valid value and successful decorator', () => {
    mockValidate.mockReturnValueOnce(NodeResultFixture.success());

    const arrayNode = getArrayNodeFixture();
    const fn = jest.fn(() => NodeResultFixture.success());

    arrayNode.annotations.validationFunctions = [{ callback: fn }];

    const result = arrayNode.validate([true], VALIDATION_OPTIONS);

    expect(result).toEqual(
      expectNodeValidationSuccess.arraySuccess({
        previousMatches: [
          expectNodeValidationSuccess.mockSuccess({
            context: { array: { i: 0 } },
          }),
        ],
      }),
    );
    expect(fn).toHaveBeenCalledOnce();
  });

  it('should not validate array if decorator fails', () => {
    mockValidate.mockReturnValueOnce(NodeResultFixture.success());

    const arrayNode = getArrayNodeFixture();
    const fn = jest.fn(({ fail }) => fail());

    arrayNode.annotations.validationFunctions = [{ callback: fn }];

    const result = arrayNode.validate([true], VALIDATION_OPTIONS);

    expect(result.success).toBeFalse();
  });
});
