import { type DateTime } from 'luxon';

import { IsISO8601, ValidateIf, PropertyDecorator } from '../decorators';
import { ValidationErrorType } from '../nodes';
import { registry, Transformed, AbstractValueTransformerFactory, TransformerFunction } from '../transformer-parser';

@registry.decorate<Transformed<string, DateTime, never>>()
export class IsoStringToDateTimeTransformer extends AbstractValueTransformerFactory {
  luxon: typeof import('luxon');

  constructor() {
    super();
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
    this.luxon = require('luxon') as typeof import('luxon');
  }

  getDecorators(): PropertyDecorator[] {
    return [IsISO8601()];
  }
  getTransformer(): TransformerFunction<string> {
    return ({ value }) => {
      const dt = this.luxon.DateTime.fromISO(value);
      return dt;
    };
  }
}

@registry.decorate<Transformed<DateTime, string, never>>()
export class DateTimeToIsoStringTransformer extends AbstractValueTransformerFactory {
  luxon: typeof import('luxon');

  constructor() {
    super();
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
    this.luxon = require('luxon') as typeof import('luxon');
  }

  getDecorators(): PropertyDecorator[] {
    return [ValidateIf(() => false), IsISO8601()];
  }

  getTransformer(): TransformerFunction<DateTime> {
    return ({ value, fail }) => {
      if (!(value instanceof this.luxon.DateTime)) {
        return fail(value, { reason: ValidationErrorType.NOT_AN_OBJECT, context: { className: 'DateTime' } });
      }
      return value.toISO();
    };
  }
}
