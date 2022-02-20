/* istanbul ignore file */
import ErrorStackParser from 'error-stack-parser';

function getLineNumber(): number {
  return ErrorStackParser.parse(new Error())[1].lineNumber! + 1;
}

// eslint-disable-next-line @typescript-eslint/naming-convention, @typescript-eslint/no-empty-function
const Decorator =
  (...args: any[]) =>
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
