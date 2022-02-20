/* istanbul ignore file */

import { Project } from 'ts-morph';

import { IValidationError, IValidationResult } from '../validator';

export const project = new Project({
  tsConfigFilePath: 'tsconfig.json',
});

export function expectValidationError(
  result: IValidationResult<unknown>,
  cb: (result: IValidationError<unknown>) => unknown,
): void {
  expect(result.success).toEqual(false);
  if (!result.success) {
    cb(result);
  }
}

export function genValidationErrorTest(result: IValidationResult<unknown>): void {
  console.log(`
  expectValidationError(result, (result) => {
    expect(result.rawErrors).toEqual(${!result.success ? JSON.stringify(result.rawErrors) : '!'});
  });
`);
}
