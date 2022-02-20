import 'reflect-metadata';

import { DecoratorNode, INodeValidationResult, IValidationContext, TypeNode } from './nodes';
import { enumerate } from './utils';

export const typeDecoratorMetadataKey = Symbol('typeDecoratorMetadataKey');

export type DecoratorFactory<T extends any[] = any[]> = (
  ...args: T
) => (this: DecoratorNode, value: any, context: IValidationContext) => INodeValidationResult;

// eslint-disable-next-line @typescript-eslint/ban-types
type PropertyDecorator = (target: object, propertyKey: string) => void;

interface IDecoratorOptions<T extends DecoratorFactory> {
  name: string;
  type: TypeNode['kind'];
  validate: T;
  options?: unknown[];
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

export function createValidationDecorator<T extends DecoratorFactory, U extends any[] = any[]>(
  decoratorOptions: IDecoratorOptions<T>,
): (...options: U) => PropertyDecorator {
  return (...options: U) => {
    return (target, propertyKey) => {
      const propertyDecorators = getDecorators(target, propertyKey) ?? [];
      propertyDecorators.push({ ...decoratorOptions, options: options ?? [] });
      Reflect.defineMetadata(typeDecoratorMetadataKey, propertyDecorators, target, propertyKey);
    };
  };
}

export function getDecorators(target: object, propertyKey: string): IDecoratorOptions<DecoratorFactory>[] | undefined {
  return Reflect.getMetadata(typeDecoratorMetadataKey, target, propertyKey) as
    | IDecoratorOptions<DecoratorFactory>[]
    | undefined;
}

export type PropertyDecoratorMap = Map<TypeNode['kind'], IDecoratorOptions<DecoratorFactory>[]>;
export type DecoratorMap = Map<string, PropertyDecoratorMap>;
export function groupDecorators(decorators: IDecoratorOptions<DecoratorFactory>[]): PropertyDecoratorMap {
  const map: PropertyDecoratorMap = new Map();
  for (const decorator of decorators) {
    const decoratorList = map.get(decorator.type) ?? [];
    decoratorList.push(decorator);
    map.set(decorator.type, decoratorList);
  }
  return map;
}

type ValidateFunc<T> = (node: DecoratorNode, value: T, context: IValidationContext) => INodeValidationResult;
// eslint-disable-next-line @typescript-eslint/naming-convention
export const Validate = createValidationDecorator<DecoratorFactory, [validateFunc: ValidateFunc<any>]>({
  name: 'Validate',
  type: 'root',
  validate(func: ValidateFunc<unknown>) {
    return function (this: DecoratorNode, value: unknown, context: IValidationContext) {
      return func(this, value, context);
    };
  },
});

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type, @typescript-eslint/naming-convention
export const LengthFactory = (type: TypeNode['kind']) =>
  createValidationDecorator<DecoratorFactory, [min: number, max?: number]>({
    name: 'Length',
    type,
    validate(this: DecoratorNode, min: number, max?: number) {
      return function (value: string | unknown[]) {
        const length = value.length;
        if (length < min) {
          return this.fail(value, {
            reason: LengthValidationError.LENGTH_FAILED,
            context: { min, max },
          });
        }
        if (max !== undefined && length > max) {
          return this.fail(value, {
            reason: LengthValidationError.LENGTH_FAILED,
            context: { min, max },
          });
        }
        return this.success();
      };
    },
  });

// eslint-disable-next-line @typescript-eslint/naming-convention
export const Length = LengthFactory('root');
// eslint-disable-next-line @typescript-eslint/naming-convention
export const StringLength = LengthFactory('string');
// eslint-disable-next-line @typescript-eslint/naming-convention
export const ArrayLength = LengthFactory('array');

// eslint-disable-next-line @typescript-eslint/naming-convention
export const IsNumber = createValidationDecorator<DecoratorFactory, []>({
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
});

// eslint-disable-next-line @typescript-eslint/naming-convention
export const IsInteger = createValidationDecorator<DecoratorFactory, []>({
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
});

// eslint-disable-next-line @typescript-eslint/naming-convention
export const Range = createValidationDecorator<DecoratorFactory, [min: number, max?: number]>({
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
});

// eslint-disable-next-line @typescript-eslint/naming-convention
export const IsNumberList = createValidationDecorator<DecoratorFactory, [splitter?: Parameters<string['split']>[0]]>({
  name: 'IsNumberList',
  type: 'string',
  validate(splitter: Parameters<string['split']>[0] = /,\s*/, radix: number = 10) {
    return function (this: DecoratorNode, value: string) {
      const splitted = value.split(splitter);
      for (const [i, item] of enumerate(splitted)) {
        if (Number.isNaN(parseInt(item, radix))) {
          return this.fail(value, {
            reason: StringValidationError.NOT_A_NUMBER_LIST,
            context: { element: i },
          });
        }
      }

      return this.success();
    };
  },
});
