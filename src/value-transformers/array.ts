import {
  registry,
  Transformed,
  AbstractValueTransformerFactory,
  IGetTransformerContext,
  TransformerFunction,
} from '../transformer-parser';

@registry.decorate<Transformed<string, string[], { separator?: string; regex?: string }>>()
export class StringToStringArrayTransformer extends AbstractValueTransformerFactory {
  getTransformer(ctx: IGetTransformerContext): TransformerFunction<string, string[]> {
    const seperator = ctx.options?.regex
      ? new RegExp(ctx.options?.separator as string)
      : (ctx.options?.separator as string | undefined) ?? ',';

    return ({ value }) => {
      return value.split(seperator);
    };
  }
}

@registry.decorate<Transformed<string[], string, { separator?: string }>>()
export class StringArrayToStringTransformer extends AbstractValueTransformerFactory {
  getTransformer(ctx: IGetTransformerContext): TransformerFunction<string[], string> {
    return ({ value }) => {
      return value.join((ctx.options?.separator as string) ?? ',');
    };
  }
}

// @registry.decorate<Transformed<string, number[], { separator?: string; regex?: boolean }>>()
// export class StringToNumberArrayTransformer extends AbstractValueTransformerFactory {
//   getDecorators(ctx: IGetTransformerContext): PropertyDecorator[] {
//     return [IsNumberList()];
//   }

//   getTransformer(ctx: IGetTransformerContext): TransformerFunction<string, string[]> {
//     return ({ value }) => {
//       return value.split((ctx.options?.separator as string) ?? ',').map((v) => parseFloat());
//     };
//   }
// }
