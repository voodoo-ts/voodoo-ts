/* istanbul ignore file */

import 'jest-extended';

import ErrorStackParser from 'error-stack-parser';
import { Project } from 'ts-morph';

import { INodeValidationError } from '../nodes';
import { TransformerInstance } from '../transformer';
import { IValidationError, IValidationResult, ValidatorInstance } from '../validator';

export const project = new Project({
  tsConfigFilePath: 'tsconfig.json',
});

export function expectValidationError(
  result: IValidationResult<unknown>,
  cb: (result: IValidationError) => unknown,
): void {
  expect(result.success).toEqual(false);
  if (!result.success) {
    cb(result);
  }
}

export function genValidationErrorTest(result: IValidationResult<unknown>): void {
  console.log(`
  it('should not validate', () => {
    expect(result.success).toEqual(false);
  });
  it('should construct the correct error', () => {
    expectValidationError(result, (result) => {
      expect(result.rawErrors).toEqual(${!result.success ? JSON.stringify(result.rawErrors) : '!'});
    });
  });
`);
}

export function getLineNumber(): number {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return ErrorStackParser.parse(new Error())[1].lineNumber! + 1;
}

export const PARSERS = [
  { parserName: 'validator-parser', parserClass: ValidatorInstance },
  { parserName: 'transformer-parser', parserClass: TransformerInstance },
];

// eslint-disable-next-line @typescript-eslint/ban-types
export function* iterParsers(): Generator<[string, TransformerInstance | ValidatorInstance, Function]> {
  for (const { parserName, parserClass } of PARSERS) {
    const instance = new parserClass({ project });
    const decorator =
      // eslint-disable-next-line @typescript-eslint/unbound-method
      instance instanceof ValidatorInstance ? instance.validatorDecorator : instance.transformerDecorator;
    yield [parserName, instance, decorator.bind(instance)];
  }
}

export function debug(obj: unknown): void {
  console.dir(obj, { depth: null, colors: true });
}

export function formatNodeValidationError(result: INodeValidationError, level: number = 0): string {
  let out = '';
  out += ' '.repeat(level);
  out += `${result.type} | reason: ${result.reason} | context: ${JSON.stringify(result.context)}\n`;

  for (const e of result.previousErrors) {
    out += formatNodeValidationError(e, level + 1);
  }
  return out;
}
