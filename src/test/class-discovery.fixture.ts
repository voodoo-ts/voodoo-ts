/* istanbul ignore file */
import { getLineNumber } from './utils';

// eslint-disable-next-line @typescript-eslint/naming-convention
const Decorator =
  (...args: any[]) =>
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  (target: object) => {};

export const LINE_NUMBER_UNDECORATED_CLASS = getLineNumber();
export class UndecoratedClass {}

export const LINE_NUMBER_DECORATED_CLASS = getLineNumber();
@Decorator()
export class DecoratedClass {}

export const LINE_NUMBER_MULTI_DECORATOR_CLASS = getLineNumber();
@Decorator()
@Decorator()
@Decorator()
export class MultiDecoratorClass {}

export const LINE_NUMBER_MULTILINE_MULTIDECORATOR_CLASS = getLineNumber();
@Decorator({
  some: 'property',
  another: 123,
})
@Decorator({
  options: {
    some: 'property',
  },
})
@Decorator({
  test: 123,
})
export class MultiLineMultiDecoratorClass {}
