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
