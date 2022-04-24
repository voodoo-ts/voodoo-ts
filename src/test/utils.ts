/* istanbul ignore file */

import ErrorStackParser from 'error-stack-parser';
import { Project } from 'ts-morph';

import { IValidationError, IValidationResult } from '../validator';

export const project = new Project({
  tsConfigFilePath: 'tsconfig.json',
});

export function expectValidationError(
  result: IValidationResult<unknown>,
  cb: (result: IValidationError<unknown>) => unknown,
): void {
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
  return ErrorStackParser.parse(new Error())[1].lineNumber! + 1;
}
