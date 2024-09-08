import { type BigNumber } from 'bignumber.js';

import { IsNumber, ValidateIf ,PropertyDecorator} from '../decorators';
import { ValidationErrorType } from '../nodes';
import { AbstractValueTransformerFactory, registry, Transformed, TransformerFunction } from '../transformer-parser';


@registry.decorate<Transformed<string, BigNumber, never>>()
export class NumberStringToBigNumberTransformer extends AbstractValueTransformerFactory {
  bigNumber: typeof import('bignumber.js');

  constructor() {
    super();
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
    this.bigNumber = require('bignumber.js');
  }

  getDecorators(): PropertyDecorator[] {
    return [IsNumber()];
  }
  getTransformer(): TransformerFunction<string> {
    return ({ value }) => {
      const dt = this.bigNumber.BigNumber(value);
      return dt;
    };
  }
}

@registry.decorate<Transformed<BigNumber, string, never>>()
export class BigNumberToNumberStringTransformer extends AbstractValueTransformerFactory {
  bigNumber: typeof import('bignumber.js');

  constructor() {
    super();
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
    this.bigNumber = require('bignumber.js');
  }

  getDecorators(): PropertyDecorator[] {
    return [ValidateIf(() => false), IsNumber()];
  }

  getTransformer(): TransformerFunction<BigNumber> {
    return ({ value, fail }) => {
      if (!(value instanceof this.bigNumber.BigNumber)) {
        return fail(value, { reason: ValidationErrorType.NOT_AN_OBJECT, context: { className: 'BigNumber' } });
      }
      return value.toString();
    };
  }
}
