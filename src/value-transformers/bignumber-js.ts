import { BigNumber } from 'bignumber.js';

import { IsNumber, PropertyDecorator } from '../decorators';
import { IPropertyValidatorCallbackArguments, INodeValidationResult, INodeValidationError } from '../nodes';
import { AbstractValueTransformerFactory, registry, Transformed, TransformerFunction } from '../transformer-parser';
import { ICustomValidator, validatorRegistry } from '../validator-parser';

export enum BigNumberErrorTypes {
  NOT_A_BIGNUMBER_INSTANCE = 'NOT_A_BIGNUMBER_INSTANCE',
}

((bn) => bn)(BigNumber);

@validatorRegistry.decorate<BigNumber>()
export class BigNumberValidator implements ICustomValidator {
  translations?: Record<string, Record<string, (e: INodeValidationError) => string>> = {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    EN: {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      [BigNumberErrorTypes.NOT_A_BIGNUMBER_INSTANCE]: (e) =>
        `Expected BigNumber instance, received: ${(e.context as Record<string, unknown>).received}`,
    },
  };

  validate(args: IPropertyValidatorCallbackArguments<unknown>): INodeValidationResult {
    return args.value instanceof BigNumber
      ? args.success()
      : args.fail(args.value, {
          reason: 'NOT_A_BIGNUMBER_INSTANCE',
          context: { received: (args.value as object).constructor?.name ?? typeof args.value },
        });
  }
}

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
      return this.bigNumber.BigNumber(value);
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
    return [];
  }

  getTransformer(): TransformerFunction<BigNumber> {
    return ({ value }) => {
      return value.toString();
    };
  }
}
