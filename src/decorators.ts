import 'reflect-metadata';

import {
  DecoratorNode,
  IAnnotationMap,
  IDecoratorNodeValidationError,
  INodeValidationResult,
  IPropertyCallbackArguments2,
  IValidationContext,
  TypeNode,
  ValidationErrorType,
} from './nodes';
import { enumerate } from './utils';

export const typeDecoratorMetadataKey = Symbol('typeDecoratorMetadataKey');
export const annotationDecoratorMetadataKey = Symbol('annotationDecoratorMetadataKey');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DecoratorFactory<T extends unknown[] = any[]> = (
  ...args: T
) => // eslint-disable-next-line @typescript-eslint/no-explicit-any
(this: DecoratorNode, value: any, context: IValidationContext) => INodeValidationResult;

// eslint-disable-next-line @typescript-eslint/ban-types
export type PropertyDecorator = ((target: object, propertyKey: string) => void) & { meta: IAnnotationDecoratorOptions };

export interface IDecoratorOptions {
  decoratorType: 'validator' | 'annotation';
  type: TypeNode['kind'];
}

export interface IValidationDecoratorOptions extends IDecoratorOptions {
  name: string;
  validate: DecoratorFactory;
  options?: unknown[];
}

export interface IAnnotationDecoratorOptions extends IDecoratorOptions {
  name: keyof IAnnotationMap;
  transformParameters?: (args: unknown[], previous: unknown) => unknown;
}

export interface IDecoratorMeta {
  type: TypeNode['kind'];
  name: string;
}

export interface IValidationDecoratorMeta extends IDecoratorMeta {
  decoratorType: 'validator';
  validator: (this: DecoratorNode, value: unknown, context: IValidationContext) => INodeValidationResult;
  options: unknown[];
}

export interface IAnnotationDecoratorMeta extends IDecoratorMeta {
  decoratorType: 'annotation';
  value: unknown;
}

export type TDecoratorMeta = IValidationDecoratorMeta | IAnnotationDecoratorMeta;

declare module './nodes' {
  // Extends the IAnnoationMap from ./nodes.ts
  // eslint-disable-next-line no-shadow
  export interface IAnnotationMap {
    from?: string;
    validateIf?: (value: unknown, values: unknown) => boolean;
  }
}

export enum LengthValidationError {
  LENGTH_FAILED = 'LENGTH_FAILED',
}

export enum StringValidationError {
  NOT_A_NUMBER_STRING = 'NOT_A_NUMBER_STRING',
  LENGTH_FAILED = 'LENGTH_FAILED',
  NOT_A_NUMBER_LIST = 'NOT_A_NUMBER_LIST',
}

export enum NumberValidationError {
  OUT_OF_RANGE = 'OUT_OF_RANGE',
}

// export function createValidationDecorator<U extends unknown[] = unknown[]>(
//   decoratorOptions: Omit<IValidationDecoratorOptions, 'decoratorType'>,
// ): (...options: U) => PropertyDecorator & { meta: IValidationDecoratorMeta } {
//   return (...options: U) => {
//     const { name, type, validate: validatorFactory } = decoratorOptions;
//     const meta: IValidationDecoratorMeta = {
//       decoratorType: 'validator',
//       name,
//       type,
//       options,
//       validator: validatorFactory(...options),
//     };
//     const fn: PropertyDecorator = (target, propertyKey) => {
//       const propertyDecorators = getDecorators(target, propertyKey) ?? [];
//       propertyDecorators.push(meta);
//       Reflect.defineMetadata(typeDecoratorMetadataKey, propertyDecorators, target, propertyKey);
//     };
//
//     return Object.assign(fn, { meta });
//   };
// }

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

// export function getDecorators(target: object, propertyKey: string): IValidationDecoratorMeta[] {
//   return (Reflect.getMetadata(typeDecoratorMetadataKey, target, propertyKey) ?? []) as IValidationDecoratorMeta[];
// }

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

type ValidateFunc<T> = (node: DecoratorNode, value: T, context: IValidationContext) => INodeValidationResult;
// eslint-disable-next-line @typescript-eslint/naming-convention
// export const Validate = createValidationDecorator<[validateFunc: ValidateFunc<never>]>({
//   name: 'Validate',
//   type: 'root',
//   validate(func: ValidateFunc<unknown>) {
//     return function (this: DecoratorNode, value: unknown, context: IValidationContext) {
//       return func(this, value, context);
//     };
//   },
// });

// eslint-disable-next-line @typescript-eslint/naming-convention
export const Validate2 = createAnnotationDecorator<
  [func: (args: IPropertyCallbackArguments2) => INodeValidationResult]
>({
  name: 'validationFunctions',
  type: 'root',
  transformParameters: stackingTransform,
});

// eslint-disable-next-line @typescript-eslint/naming-convention
export const ValidateString = createAnnotationDecorator<
  [func: (args: IPropertyCallbackArguments2<string>) => INodeValidationResult]
>({
  name: 'validationFunctions',
  type: 'string',
  transformParameters: stackingTransform,
});

// eslint-disable-next-line @typescript-eslint/naming-convention
export const ValidateNumber = createAnnotationDecorator<
  [func: (args: IPropertyCallbackArguments2) => INodeValidationResult]
>({
  name: 'validationFunctions',
  type: 'number',
  transformParameters: stackingTransform,
});

// eslint-disable-next-line @typescript-eslint/naming-convention
export const ValidateArray = createAnnotationDecorator<
  [func: (args: IPropertyCallbackArguments2) => INodeValidationResult]
>({
  name: 'validationFunctions',
  type: 'array',
  transformParameters: stackingTransform,
});

export function validateLength(
  { value, success, fail }: IPropertyCallbackArguments2<string | unknown[]>,
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

// // eslint-disable-next-line @typescript-eslint/explicit-function-return-type, @typescript-eslint/naming-convention
// export const LengthFactory = (type: TypeNode['kind']) =>
//   createValidationDecorator<[min: number, max?: number]>({
//     name: 'Length',
//     type,
//     validate(this: DecoratorNode, min: number, max?: number) {
//       return function (value: string | unknown[]) {
//         const length = value.length;
//         if (length < min) {
//           return this.fail(value, {
//             reason: LengthValidationError.LENGTH_FAILED,
//             context: { min, max, length },
//           });
//         }
//         if (max !== undefined && length > max) {
//           return this.fail(value, {
//             reason: LengthValidationError.LENGTH_FAILED,
//             context: { min, max, length },
//           });
//         }
//         return this.success();
//       };
//     },
//   });
//
// // eslint-disable-next-line @typescript-eslint/naming-convention
// export const Length = LengthFactory('root');
// // eslint-disable-next-line @typescript-eslint/naming-convention
// export const StringLength = LengthFactory('string');
// // eslint-disable-next-line @typescript-eslint/naming-convention
// export const ArrayLength = LengthFactory('array');

export function validateNumberString({ value, success, fail }: IPropertyCallbackArguments2): INodeValidationResult {
  const n = parseFloat(value as string);
  if (Number.isNaN(n)) {
    return fail(value, {
      reason: StringValidationError.NOT_A_NUMBER_STRING,
    });
  }
  return success();
}

// eslint-disable-next-line @typescript-eslint/naming-convention, @typescript-eslint/explicit-function-return-type
export const IsNumber2 = () => Validate2(validateNumberString);

/*// eslint-disable-next-line @typescript-eslint/naming-convention
export const IsNumber = createValidationDecorator<[]>({
  name: 'IsNumber',
  type: 'string',
  validate() {
    return function (this: DecoratorNode, value: string) {
      const n = parseFloat(value);
      if (Number.isNaN(n)) {
        return this.fail(value, {
          reason: StringValidationError.NOT_A_NUMBER_STRING,
        });
      }
      return this.success();
    };
  },
});*/

export function validateIntegerString(
  { value, success, fail }: IPropertyCallbackArguments2<string>,
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
      reason: StringValidationError.NOT_A_NUMBER_STRING,
    });
  }
  return success();
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export const IsInteger2 = (radix: 10 | 16 = 10): PropertyDecorator & { meta: IAnnotationDecoratorOptions } =>
  ValidateString((args) => validateIntegerString(args, radix));

/*// eslint-disable-next-line @typescript-eslint/naming-convention
export const IsInteger = createValidationDecorator<[radix?: number]>({
  name: 'IsNumber',
  type: 'string',
  validate(radix: number = 10) {
    return function (this: DecoratorNode, value: string) {
      const n = parseInt(value, radix);
      if (Number.isNaN(n)) {
        return this.fail(value, {
          reason: StringValidationError.NOT_A_NUMBER_STRING,
        });
      }
      return this.success();
    };
  },
});*/

export function validateRange(
  { value, success, fail }: IPropertyCallbackArguments2<number>,
  min: number,
  max?: number,
): INodeValidationResult {
  if (value < min) {
    return fail(value, { reason: NumberValidationError.OUT_OF_RANGE });
  }
  if (max !== undefined && value > max) {
    return fail(value, { reason: NumberValidationError.OUT_OF_RANGE });
  }
  return success();
}

// eslint-disable-next-line @typescript-eslint/naming-convention, @typescript-eslint/explicit-function-return-type
export const Range2 = (min: number, max?: number) =>
  Validate2((args) => validateRange(args as IPropertyCallbackArguments2<number>, min, max));

/*// eslint-disable-next-line @typescript-eslint/naming-convention
export const Range = createValidationDecorator<[min: number, max?: number]>({
  name: 'Range',
  type: 'number',
  validate(min: number, max?: number) {
    return function (this: DecoratorNode, value: number) {
      if (value < min) {
        return this.fail(value, { reason: NumberValidationError.OUT_OF_RANGE });
      }
      if (max !== undefined && value > max) {
        return this.fail(value, { reason: NumberValidationError.OUT_OF_RANGE });
      }
      return this.success();
    };
  },
});*/

export function validateNumberList(
  { value, success, fail }: IPropertyCallbackArguments2<string>,
  splitter: Parameters<string['split']>[0] = /,\s*/,
  radix: number = 10,
): INodeValidationResult {
  const splitted = value.split(splitter);
  for (const [i, item] of enumerate(splitted)) {
    if (Number.isNaN(parseInt(item, radix))) {
      return fail(value, {
        reason: StringValidationError.NOT_A_NUMBER_LIST,
        context: { element: i },
      });
    }
  }

  return success();
}

// eslint-disable-next-line @typescript-eslint/naming-convention, @typescript-eslint/explicit-function-return-type
// export const IsNumberList2 = (splitter: Parameters<string['split']>[0] = /,\s*/, radix: number = 10) =>
// Validate2((args) => validateRange(args as IPropertyCallbackArguments2<number>, min, max));

// eslint-disable-next-line @typescript-eslint/naming-convention
// export const IsNumberList = createValidationDecorator<[splitter?: Parameters<string['split']>[0]]>({
//   name: 'IsNumberList',
//   type: 'string',
//   validate(splitter: Parameters<string['split']>[0] = /,\s*/, radix: number = 10) {
//     return function (this: DecoratorNode, value: string) {
//       const splitted = value.split(splitter);
//       for (const [i, item] of enumerate(splitted)) {
//         if (Number.isNaN(parseInt(item, radix))) {
//           return this.fail(value, {
//             reason: StringValidationError.NOT_A_NUMBER_LIST,
//             context: { element: i },
//           });
//         }
//       }
//
//       return this.success();
//     };
//   },
// });

// eslint-disable-next-line @typescript-eslint/naming-convention, @typescript-eslint/explicit-function-return-type
export const OneOf2 = (allowedValues: unknown[]) => {
  const allowed = new Set<unknown>(allowedValues);
  return ValidateString((args) => {
    if (allowed.has(args.value)) {
      return args.success();
    } else {
      return args.fail(args.value, {
        reason: ValidationErrorType.NOT_AN_ENUM,
        context: {
          enumName: 'OneOf',
          allowedValues,
        },
      });
    }
  });
};

/* // eslint-disable-next-line @typescript-eslint/naming-convention
export const OneOf = createValidationDecorator<[allowedValues: unknown[]]>({
  name: 'OneOf',
  type: 'root',
  validate(allowedValues: unknown[]) {
    const allowed = new Set<unknown>(allowedValues);
    return function (this: DecoratorNode, value: unknown) {
      if (allowed.has(value)) {
        return this.success();
      } else {
        return this.fail(value, {
          reason: 'FOO',
        });
      }
    };
  },
});*/

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

// eslint-disable-next-line @typescript-eslint/naming-convention
export const From = createAnnotationDecorator<[string]>({
  name: 'from' as const,
  type: 'root',
});
