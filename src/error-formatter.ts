import { INodeValidationError, ValidationErrorType } from './nodes';

export interface IErrorMessage {
  path: string[];
  reason: INodeValidationError['reason'];
  value: unknown;
  context?: Record<string, unknown>;
}

export function flattenValidationError(
  error: INodeValidationError,
  path: string[] = [],
  messages: IErrorMessage[] = [],
): IErrorMessage[] {
  switch (error.type) {
    case 'array':
      if (error.reason === ValidationErrorType.ELEMENT_TYPE_FAILED) {
        path = [...path, `[${error?.context?.element}]`];
        for (const previousError of error.previousErrors) {
          flattenValidationError(previousError, path, messages);
        }
      } else {
        //
      }
      break;
    case 'class':
      if (error.reason === ValidationErrorType.OBJECT_PROPERTY_FAILED) {
        const classErrors = error.previousErrors;
        for (const classError of classErrors) {
          const propertyPath = [...path, classError.context!.propertyName! as string];
          flattenValidationError(classError, propertyPath, messages);
        }
      } else {
        messages.push({
          path,
          reason: error.reason!,
          value: error.value,
        });
      }
      break;

    case 'union': {
      if (error.reason === ValidationErrorType.NO_UNION_MATCH) {
        const errors = error.previousErrors.map((previousError) => {
          if (previousError.type === 'class' || previousError.type === 'enum') {
            return previousError.context!.name;
          } else {
            return previousError.type;
          }
        });

        messages.push({
          path,
          reason: error.reason,
          value: error.value,
          context: {
            unionErrors: errors,
          },
        });
      }

      break;
    }
    case 'enum': {
      messages.push({
        path,
        reason: error.reason!,
        value: error.value,
        context: { allowedValues: error.context?.allowedValues },
      });
      break;
    }

    default:
      messages.push({
        path,
        reason: error.reason!,
        value: error.value,
      });
  }
  return messages;
}
