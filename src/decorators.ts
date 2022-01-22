import 'reflect-metadata';

import { DecoratorNode, INodeValidationResult, IValidationContext, TypeNode } from './nodes';

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
    name: 'Validate',
    type,
    validate(this: DecoratorNode, min: number, max?: number) {
      return function (value: string | unknown[], context: IValidationContext) {
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
