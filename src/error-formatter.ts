import { INodeValidationError, ValidationErrorType } from './nodes';

export interface IErrorMessage {
  path: string[];
  reason: INodeValidationError['reason'];
  value: unknown;
  context?: Record<string, unknown>;
}

export function flattenValidationError(error: INodeValidationError, path: string[] = []): IErrorMessage[] {
  const messages: IErrorMessage[] = [];
  switch (error.type) {
    case 'array':
    case 'tuple':
      if (error.reason === ValidationErrorType.ELEMENT_TYPE_FAILED) {
        path = [...path, `[${error?.context?.element}]`];
        for (const previousError of error.previousErrors) {
          messages.push(...flattenValidationError(previousError, path));
        }
      } else if (error.reason === ValidationErrorType.DECORATORS_FAILED) {
        for (const classError of error.previousErrors) {
          messages.push(...flattenValidationError(classError, path));
        }
      } else {
        messages.push({
          path,
          reason: error.reason!,
          value: error.value,
        });
      }
      break;
    case 'class':
    case 'intersection':
      if (error.reason === ValidationErrorType.OBJECT_PROPERTY_FAILED) {
        const classErrors = error.previousErrors;
        for (const classError of classErrors) {
          const propertyPath = [...path, classError.context!.propertyName! as string];
          messages.push(...flattenValidationError(classError, propertyPath));
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

    case 'decorator':
      messages.push({
        path,
        reason: error.reason!,
        value: error.value,
        context: error.context,
      });
      break;

    default:
      if (error.reason !== ValidationErrorType.DECORATORS_FAILED) {
        messages.push({
          path,
          reason: error.reason!,
          value: error.value,
        });
      }
      for (const classError of error.previousErrors) {
        messages.push(...flattenValidationError(classError, path));
      }
  }
  return messages;
}
