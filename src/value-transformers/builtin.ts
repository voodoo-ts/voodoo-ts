import { IsInteger, OneOf, PropertyDecorator } from '../decorators';
import {
  registry,
  Transformed,
  AbstractValueTransformerFactory,
  IGetTransformerContext,
  TransformerFunction,
} from '../transformer-parser';

@registry.decorate<Transformed<string, number, { radix?: number; integer?: boolean }>>()
export class StringToNumberValueTransformer extends AbstractValueTransformerFactory {
  getDecorators(ctx: IGetTransformerContext): PropertyDecorator[] {
    return [IsInteger(ctx.options?.radix as 10 | 16)];
  }

  getTransformer(ctx: IGetTransformerContext): TransformerFunction<string, number> {
    return ({ value }) => {
      return Number.parseInt(value, (ctx.options?.radix as number) ?? 10);
    };
  }
}

export const DEFAULT_TRUE_LIST = ['on', 'true', 'yes', '1'];
export const DEFAULT_FALSE_LIST = ['off', 'false', 'no', '0'];

@registry.decorate<Transformed<string, boolean, never>>()
export class StringToBooleanValueTransformer extends AbstractValueTransformerFactory {
  trueList: Set<string>;
  falseList: Set<string>;

  constructor(trueList: string[] = DEFAULT_TRUE_LIST, falseList: string[] = DEFAULT_FALSE_LIST) {
    super();
    this.trueList = new Set(trueList);
    this.falseList = new Set(falseList);
  }

  getDecorators(): PropertyDecorator[] {
    return [OneOf([...this.trueList.values(), ...this.falseList.values()], 'BooleanString')];
  }

  getTransformer(): TransformerFunction<string> {
    return ({ value }): boolean => {
      return this.trueList.has(value);
    };
  }
}
