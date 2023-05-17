import 'reflect-metadata';
import isEmail from 'validator/lib/isEmail';
import isFQDN from 'validator/lib/isFQDN';
import isISO8601 from 'validator/lib/isISO8601';
import isURL from 'validator/lib/isURL';

import {
  IAnnotationMap,
  IConstraintNodeValidationError,
  INodeValidationResult,
  IPropertyValidator,
  IPropertyValidatorCallbackArguments,
  RootNode,
  TypeNode,
  ValidationErrorType,
  walkPropertyTypeTree,
} from './nodes';
import { Constructor } from './types';
import { enumerate } from './utils';

export const annotationDecoratorMetadataKey = Symbol('annotationDecoratorMetadataKey');

export type PropertyDecorator = ((target: object, propertyKey: string) => void) & { meta: IDecoratorOptions };

export interface IDecoratorOptions {
  type: TypeNode['kind'];
  name: keyof IAnnotationMap;
  transformParameters?: (args: unknown[], previous: unknown) => unknown;
}

export interface IDecoratorMeta {
  type: TypeNode['kind'];
  name: string;
  value: unknown;
}

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
  INVALID_NUMBER_STRING = 'INVALID_NUMBER_STRING',
  INVALID_INTEGER_STRING = 'INVALID_INTEGER_STRING',
  INVALID_ISO_8601_STRING = 'INVALID_ISO_8601_STRING',
  INVALID_FQDN = 'INVALID_FQDN',
  INVALID_IP = 'INVALID_IP',
  INVALID_EMAIL = 'INVALID_EMAIL',
  INVALID_URL = 'INVALID_URL',
  NO_REGEX_MATCH = 'NO_REGEX_MATCH',
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

export function validatorTransform(args: unknown[], previous: unknown): IPropertyValidator[] {
  const [callback, meta] = args;
  const validator = {
    callback,
    meta,
  } as IPropertyValidator;
  if (!Array.isArray(previous)) {
    return [validator];
  } else {
    return [...(previous as Array<typeof validator>), validator];
  }
}

export function createAnnotationDecorator<U extends unknown[] = unknown[]>(
  decoratorOptions: IDecoratorOptions,
): (...options: U) => PropertyDecorator & { meta: IDecoratorOptions } {
  return (...args: U) => {
    const meta: IDecoratorOptions = {
      name: decoratorOptions.name,
      type: decoratorOptions.type,
    };
    const fn = (target: object, propertyKey: string): void => {
      const { name, type } = decoratorOptions;
      const annotations = getAnnotations(target, propertyKey) ?? [];
      const existingAnnotation = annotations.find((d) => d.type === type && d.name === name);
      const existingAnnotationValue = existingAnnotation?.value;
      const transformParameters = decoratorOptions.transformParameters ?? defaultTransform;
      const value = transformParameters(args, existingAnnotationValue);
      if (!existingAnnotation) {
        annotations.push({ name, type, value });
      } else {
        existingAnnotation.value = value;
      }

      Reflect.defineMetadata(annotationDecoratorMetadataKey, annotations, target, propertyKey);
    };

    return Object.assign(fn, { meta });
  };
}

export function getAnnotations(target: object, propertyKey: string): IDecoratorMeta[] {
  return (Reflect.getMetadata(annotationDecoratorMetadataKey, target, propertyKey) ?? []) as IDecoratorMeta[];
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

export function applyDecorators(cls: Constructor<unknown>, propertyKey: string, tree: RootNode): void {
  const annotations = getAnnotations(cls.prototype, propertyKey);
  const annotationDecoratorMap = groupDecorators<IDecoratorMeta>(annotations);

  walkPropertyTypeTree(tree, (node) => {
    const annotationsForNodeKind = annotationDecoratorMap.get(node.kind) ?? [];
    // Treat note.annotations as a record from here to allow assignment
    // Invalid fields should not be possible due to typechecking
    const nodeAnnotations = node.annotations as Record<string, unknown>;

    for (const annotation of annotationsForNodeKind) {
      nodeAnnotations[annotation.name] = annotation.value;
    }
  });
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export const Validate = createAnnotationDecorator<
  [func: (args: IPropertyValidatorCallbackArguments) => INodeValidationResult, meta?: IPropertyValidator['meta']]
>({
  name: 'validationFunctions',
  type: 'root',
  transformParameters: validatorTransform,
});

// eslint-disable-next-line @typescript-eslint/naming-convention
export const ValidateString = createAnnotationDecorator<
  [
    func: (args: IPropertyValidatorCallbackArguments<string>) => INodeValidationResult,
    meta?: IPropertyValidator['meta'],
  ]
>({
  name: 'validationFunctions',
  type: 'string',
  transformParameters: validatorTransform,
});

// eslint-disable-next-line @typescript-eslint/naming-convention
export const ValidateNumber = createAnnotationDecorator<
  [func: (args: IPropertyValidatorCallbackArguments) => INodeValidationResult, meta?: IPropertyValidator['meta']]
>({
  name: 'validationFunctions',
  type: 'number',
  transformParameters: validatorTransform,
});

// eslint-disable-next-line @typescript-eslint/naming-convention
export const ValidateArray = createAnnotationDecorator<
  [func: (args: IPropertyValidatorCallbackArguments) => INodeValidationResult, meta?: IPropertyValidator['meta']]
>({
  name: 'validationFunctions',
  type: 'array',
  transformParameters: validatorTransform,
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
  Validate((args) => validateLength(args as IPropertyValidatorCallbackArguments<string | unknown[]>, min, max), {
    name: '@Length',
    context: {
      min,
      max,
    },
  });

// eslint-disable-next-line @typescript-eslint/naming-convention, @typescript-eslint/explicit-function-return-type
export const StringLength = (min: number, max?: number) =>
  ValidateString((args) => validateLength(args as IPropertyValidatorCallbackArguments<string | unknown[]>, min, max), {
    name: '@StringLength',
    context: {
      min,
      max,
    },
  });

// eslint-disable-next-line @typescript-eslint/naming-convention, @typescript-eslint/explicit-function-return-type
export const ArrayLength = (min: number, max?: number) =>
  ValidateArray((args) => validateLength(args as IPropertyValidatorCallbackArguments<string | unknown[]>, min, max), {
    name: '@ArrayLength',
    context: {
      min,
      max,
    },
  });

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
      reason: StringValidationError.INVALID_NUMBER_STRING,
    });
  }

  const n = parseFloat(value);
  if (Number.isNaN(n)) {
    return fail(value, {
      reason: StringValidationError.INVALID_NUMBER_STRING,
    });
  }
  return success();
}

// eslint-disable-next-line @typescript-eslint/naming-convention, @typescript-eslint/explicit-function-return-type
export const IsNumber = () =>
  ValidateString(validateNumberString, {
    name: '@IsNumber',
    context: {},
  });

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
      reason: StringValidationError.INVALID_INTEGER_STRING,
    });
  }
  return success();
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export const IsInteger = (radix: 10 | 16 = 10): PropertyDecorator & { meta: IDecoratorOptions } =>
  ValidateString((args) => validateIntegerString(args, radix), {
    name: '@IsInteger',
    context: { radix },
  });

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
  ValidateNumber((args) => validateRange(args as IPropertyValidatorCallbackArguments<number>, min, max), {
    name: '@Range',
    context: {
      min,
      max,
    },
  });

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
export const IsNumberList = () =>
  ValidateString((args) => validateNumberList(args), {
    name: '@IsNumberList',
    context: {},
  });

// eslint-disable-next-line @typescript-eslint/naming-convention, @typescript-eslint/explicit-function-return-type
export const OneOf = (allowedValues: unknown[], enumName: string = 'OneOf') => {
  const allowed = new Set<unknown>(allowedValues);
  return ValidateString(
    (args) => {
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
    },
    { name: '@OneOf', context: { allowedValues: Array.from(allowed) } },
  );
};

export function validateHostname({
  value,
  success,
  fail,
}: IPropertyValidatorCallbackArguments<string>): INodeValidationResult {
  if (isFQDN(value)) {
    return success();
  } else {
    return fail(value, {
      reason: StringValidationError.INVALID_FQDN,
    });
  }
}

// eslint-disable-next-line @typescript-eslint/naming-convention, @typescript-eslint/explicit-function-return-type
export const IsFQDN = () =>
  ValidateString((args) => validateHostname(args), {
    name: '@IsFQDN',
    context: {},
  });

export function validateUrl(
  { value, success, fail }: IPropertyValidatorCallbackArguments<string>,
  allowedProtocols: string[] = [],
): INodeValidationResult {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  if (isURL(value, { protocols: allowedProtocols, require_valid_protocol: Boolean(allowedProtocols.length) })) {
    return success();
  } else {
    return fail(value, {
      reason: StringValidationError.INVALID_URL,
    });
  }
}

// eslint-disable-next-line @typescript-eslint/naming-convention, @typescript-eslint/explicit-function-return-type
export const IsUrl = (allowedProtocols: string[] = []) =>
  ValidateString((args) => validateUrl(args, allowedProtocols), {
    name: '@IsUrl',
    context: { allowedProtocols },
  });

export function validateISO8601String({
  value,
  success,
  fail,
}: IPropertyValidatorCallbackArguments<string>): INodeValidationResult {
  if (isISO8601(value, { strict: true })) {
    return success();
  } else {
    return fail(value, {
      reason: StringValidationError.INVALID_ISO_8601_STRING,
    });
  }
}

// eslint-disable-next-line @typescript-eslint/naming-convention, @typescript-eslint/explicit-function-return-type
export const IsISO8601 = () =>
  ValidateString((args) => validateISO8601String(args), {
    name: '@IsIsoDateTime',
    context: {},
  });

export function validateEmail({
  value,
  success,
  fail,
}: IPropertyValidatorCallbackArguments<string>): INodeValidationResult {
  if (isEmail(value)) {
    return success();
  } else {
    return fail(value, {
      reason: StringValidationError.INVALID_EMAIL,
    });
  }
}

// eslint-disable-next-line @typescript-eslint/naming-convention, @typescript-eslint/explicit-function-return-type
export const IsEmail = () =>
  ValidateString((args) => validateEmail(args), {
    name: '@IsEmail',
    context: {},
  });

export function validateRegex(
  { value, success, fail }: IPropertyValidatorCallbackArguments<string>,
  pattern: string | RegExp,
): INodeValidationResult {
  const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
  if (value.match(regex)) {
    return success();
  } else {
    return fail(value, {
      reason: StringValidationError.NO_REGEX_MATCH,
      context: {
        pattern,
      },
    });
  }
}

// eslint-disable-next-line @typescript-eslint/naming-convention, @typescript-eslint/explicit-function-return-type
export const Regexp = (pattern: string | RegExp) =>
  ValidateString((args) => validateRegex(args, pattern), {
    name: '@Regexp',
    context: {
      pattern: pattern.toString(),
    },
  });

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
