import 'reflect-metadata';

import {
  IAnnotationMap,
  IConstraintNodeValidationError,
  INodeValidationResult,
  IPropertyValidatorCallbackArguments,
  TypeNode,
  ValidationErrorType,
} from './nodes';
import { enumerate } from './utils';

export const typeDecoratorMetadataKey = Symbol('typeDecoratorMetadataKey');
export const annotationDecoratorMetadataKey = Symbol('annotationDecoratorMetadataKey');

// eslint-disable-next-line @typescript-eslint/ban-types
export type PropertyDecorator = ((target: object, propertyKey: string) => void) & { meta: IAnnotationDecoratorOptions };

export interface IDecoratorOptions {
  decoratorType: 'validator' | 'annotation';
  type: TypeNode['kind'];
}

export interface IAnnotationDecoratorOptions extends IDecoratorOptions {
  name: keyof IAnnotationMap;
  transformParameters?: (args: unknown[], previous: unknown) => unknown;
}

export interface IDecoratorMeta {
  type: TypeNode['kind'];
  name: string;
}

export interface IAnnotationDecoratorMeta extends IDecoratorMeta {
  decoratorType: 'annotation';
  value: unknown;
}

export type TDecoratorMeta = IAnnotationDecoratorMeta;

declare module './nodes' {
  // Extends the IAnnoationMap from ./nodes.ts
  // eslint-disable-next-line no-shadow
  export interface IAnnotationMap {
    validateIf?: (value: unknown, values: unknown) => boolean;
  }
}

export enum LengthValidationError {
  LENGTH_FAILED = 'LENGTH_FAILED',
}

export enum StringValidationError {
  NOT_A_NUMBER_STRING = 'NOT_A_NUMBER_STRING',
  NOT_A_INTEGER_STRING = 'NOT_A_INTEGER_STRING',
}

export enum NumberValidationError {
  OUT_OF_RANGE = 'OUT_OF_RANGE',
}

export enum NumberListValidationError {
  INVALID_NUMBER_LIST = 'INVALID_NUMBER_LIST',
  INVALID_NUMBER_LIST_ITEM = 'INVALID_NUMBER_LIST_ELEMENT',
}

export function defaultTransform(args: unknown[]): unknown {
  return args[0];
}

export function stackingTransform(args: unknown[], previous: unknown): unknown[] {
  if (!Array.isArray(previous)) {
    return args;
  } else {
    return [...previous, args[0]];
  }
}

export function createAnnotationDecorator<U extends unknown[] = unknown[]>(
  decoratorOptions: Omit<IAnnotationDecoratorOptions, 'decoratorType'>,
): (...options: U) => PropertyDecorator & { meta: IAnnotationDecoratorOptions } {
  return (...args: U) => {
    const meta: IAnnotationDecoratorOptions = {
      decoratorType: 'annotation',
      name: decoratorOptions.name,
      type: decoratorOptions.type,
    };
    const fn = (target: object, propertyKey: string): void => {
      const { name, type } = decoratorOptions;
      const annotations = getAnnotations(target, propertyKey) ?? [];
      const existingAnnotationValue = annotations.find((d) => d.type === type && d.name === name)?.value;
      const transformParameters = decoratorOptions.transformParameters ?? defaultTransform;
      const value = transformParameters(args, existingAnnotationValue);
      annotations.push({ decoratorType: 'annotation', name, type, value });

      Reflect.defineMetadata(annotationDecoratorMetadataKey, annotations, target, propertyKey);
    };

    return Object.assign(fn, { meta });
  };
}

export function getAnnotations(target: object, propertyKey: string): IAnnotationDecoratorMeta[] {
  return (Reflect.getMetadata(annotationDecoratorMetadataKey, target, propertyKey) ?? []) as IAnnotationDecoratorMeta[];
}

export type PropertyDecoratorMap<T extends IDecoratorMeta> = Map<TypeNode['kind'], T[]>;
export type DecoratorMap<T extends IDecoratorMeta> = Map<string, PropertyDecoratorMap<T>>;
export function groupDecorators<T extends IDecoratorMeta>(decorators: T[]): PropertyDecoratorMap<T> {
  const map: PropertyDecoratorMap<T> = new Map();
  for (const decorator of decorators) {
    const decoratorList = map.get(decorator.type) ?? [];
    decoratorList.push(decorator);
    map.set(decorator.type, decoratorList);
  }
  return map;
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export const Validate = createAnnotationDecorator<
  [func: (args: IPropertyValidatorCallbackArguments) => INodeValidationResult]
>({
  name: 'validationFunctions',
  type: 'root',
  transformParameters: stackingTransform,
});

// eslint-disable-next-line @typescript-eslint/naming-convention
export const ValidateString = createAnnotationDecorator<
  [func: (args: IPropertyValidatorCallbackArguments<string>) => INodeValidationResult]
>({
  name: 'validationFunctions',
  type: 'string',
  transformParameters: stackingTransform,
});

// eslint-disable-next-line @typescript-eslint/naming-convention
export const ValidateNumber = createAnnotationDecorator<
  [func: (args: IPropertyValidatorCallbackArguments) => INodeValidationResult]
>({
  name: 'validationFunctions',
  type: 'number',
  transformParameters: stackingTransform,
});

// eslint-disable-next-line @typescript-eslint/naming-convention
export const ValidateArray = createAnnotationDecorator<
  [func: (args: IPropertyValidatorCallbackArguments) => INodeValidationResult]
>({
  name: 'validationFunctions',
  type: 'array',
  transformParameters: stackingTransform,
});

export function validateLength(
  { value, success, fail }: IPropertyValidatorCallbackArguments<string | unknown[]>,
  min: number,
  max?: number,
): INodeValidationResult {
  const length = value.length;
  if (length < min) {
    return fail(value, {
      reason: LengthValidationError.LENGTH_FAILED,
      context: { min, max, length },
    });
  }
  if (max !== undefined && length > max) {
    return fail(value, {
      reason: LengthValidationError.LENGTH_FAILED,
      context: { min, max, length },
    });
  }
  return success();
}

// eslint-disable-next-line @typescript-eslint/naming-convention, @typescript-eslint/explicit-function-return-type
export const Length = (min: number, max?: number) =>
  Validate((args) => validateLength(args as IPropertyValidatorCallbackArguments<string | unknown[]>, min, max));

// eslint-disable-next-line @typescript-eslint/naming-convention, @typescript-eslint/explicit-function-return-type
export const StringLength = (min: number, max?: number) =>
  ValidateString((args) => validateLength(args as IPropertyValidatorCallbackArguments<string | unknown[]>, min, max));

// eslint-disable-next-line @typescript-eslint/naming-convention, @typescript-eslint/explicit-function-return-type
export const ArrayLength = (min: number, max?: number) =>
  Validate((args) => validateLength(args as IPropertyValidatorCallbackArguments<string | unknown[]>, min, max));

// // eslint-disable-next-line @typescript-eslint/naming-convention
// export const StringLength = LengthFactory('string');
// // eslint-disable-next-line @typescript-eslint/naming-convention
// export const ArrayLength = LengthFactory('array');

export function validateNumberString({
  value,
  success,
  fail,
}: IPropertyValidatorCallbackArguments<string>): INodeValidationResult {
  if (value.toLowerCase().match(/[^.+0-9e-]/)) {
    return fail(value, {
      reason: StringValidationError.NOT_A_NUMBER_STRING,
    });
  }

  const n = parseFloat(value);
  if (Number.isNaN(n)) {
    return fail(value, {
      reason: StringValidationError.NOT_A_NUMBER_STRING,
    });
  }
  return success();
}

// eslint-disable-next-line @typescript-eslint/naming-convention, @typescript-eslint/explicit-function-return-type
export const IsNumber = () => ValidateString(validateNumberString);

export function validateIntegerString(
  { value, success, fail }: IPropertyValidatorCallbackArguments<string>,
  radix: 10 | 16 = 10,
): INodeValidationResult {
  let regex: RegExp;
  switch (radix) {
    case 10:
      regex = /^([+-])?([0-9])+$/;
      break;
    case 16:
      regex = /^(0x)?([a-fA-F0-9]+)$/;
      break;
  }
  const match = value.match(regex);
  if (!match) {
    return fail(value, {
      reason: StringValidationError.NOT_A_INTEGER_STRING,
    });
  }
  return success();
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export const IsInteger = (radix: 10 | 16 = 10): PropertyDecorator & { meta: IAnnotationDecoratorOptions } =>
  ValidateString((args) => validateIntegerString(args, radix));

export function validateRange(
  { value, success, fail }: IPropertyValidatorCallbackArguments<number>,
  min: number,
  max?: number,
): INodeValidationResult {
  if (value < min) {
    return fail(value, {
      reason: NumberValidationError.OUT_OF_RANGE,
      context: { min, max },
    });
  }
  if (max !== undefined && value > max) {
    return fail(value, {
      reason: NumberValidationError.OUT_OF_RANGE,
      context: { min, max },
    });
  }
  return success();
}

// eslint-disable-next-line @typescript-eslint/naming-convention, @typescript-eslint/explicit-function-return-type
export const Range = (min: number, max?: number) =>
  ValidateNumber((args) => validateRange(args as IPropertyValidatorCallbackArguments<number>, min, max));

export function validateNumberList(
  { value, values, success, fail }: IPropertyValidatorCallbackArguments<string>,
  splitter: Parameters<string['split']>[0] = /,\s*/,
  radix: 10 | 16 = 10,
): INodeValidationResult {
  const splitted = value.split(splitter);
  const previousErrors: IConstraintNodeValidationError[] = [];
  for (const [i, item] of enumerate(splitted)) {
    const result = validateIntegerString({ value: item, values, success, fail }, radix);
    if (!result.success) {
      const error = fail(item, {
        reason: NumberListValidationError.INVALID_NUMBER_LIST_ITEM,
        context: {
          i,
        },
        previousErrors: [result],
      });
      previousErrors.push(error);
    }
  }
  if (!previousErrors.length) {
    return success();
  } else {
    return fail(value, {
      reason: NumberListValidationError.INVALID_NUMBER_LIST,
      previousErrors,
    });
  }
}
// eslint-disable-next-line @typescript-eslint/naming-convention, @typescript-eslint/explicit-function-return-type
export const IsNumberList = () => ValidateString((args) => validateNumberList(args));

// eslint-disable-next-line @typescript-eslint/naming-convention, @typescript-eslint/explicit-function-return-type
export const OneOf = (allowedValues: unknown[], enumName: string = 'OneOf') => {
  const allowed = new Set<unknown>(allowedValues);
  return ValidateString((args) => {
    if (allowed.has(args.value)) {
      return args.success();
    } else {
      return args.fail(args.value, {
        reason: ValidationErrorType.NOT_AN_ENUM,
        context: {
          enumName,
          allowedValues,
        },
      });
    }
  });
};

// eslint-disable-next-line @typescript-eslint/naming-convention
export const ValidateIf = createAnnotationDecorator<
  [validateIf?: (value: never, values: Record<string, unknown>) => boolean]
>({
  name: 'validateIf' as const,
  type: 'root',
});

// eslint-disable-next-line @typescript-eslint/naming-convention
export const ErrorMessage = createAnnotationDecorator<
  [msg?: (value: never, values: Record<string, unknown>) => string]
>({
  name: 'validateIf' as const,
  type: 'root',
});
