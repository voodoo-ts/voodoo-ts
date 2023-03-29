import { LengthValidationError, StringValidationError } from './decorators';
import {
  IEnumNodeValidationError,
  ILiteralNodeValidationError,
  INodeValidationError,
  IRecordNodeValidationError,
  isArrayNodeItemValidatorError,
  isArrayNodeValidatorError,
  IUnionNodeValidationError,
  ValidationErrorType,
} from './nodes';

export interface IErrorMessage {
  path: string[];
  nodeValidationError: INodeValidationError;
}

export function getTypeName(obj: unknown): string {
  if (typeof obj === 'object') {
    if (obj === null) {
      return 'null';
    } else {
      return obj.constructor.name;
    }
  } else {
    return typeof obj;
  }
}
//
export function getNodeTypeName(e: INodeValidationError): string {
  switch (e.type) {
    case 'any':
    case 'string':
    case 'number':
    case 'boolean':
    case 'undefined':
    case 'null':
      return e.type;
    case 'enum':
      return e.context.enumName;
    case 'array':
    case 'tuple':
      return `${getNodeTypeName(e)}[]`;
    case 'class':
      return `${e.context.className}`;
    case 'record':
      return `Record<string, ${getNodeTypeName(e.previousErrors[0])}>`;
    case 'literal':
      return `${e.context.expected}`;
    case 'intersection':
      return e.context.className;
    case 'union':
      return e.previousErrors.map(getNodeTypeName).join(' | ');
    case 'root':
      return `Root<>`;
    case 'constraint':
      return `Constraint<>`;
  }
}
//
type ErrorFunc = (error: any) => string;
const translations: {
  EN: Partial<Record<ValidationErrorType | LengthValidationError | StringValidationError, (error: any) => string>>;
} = {
  EN: {
    [ValidationErrorType.VALUE_REQUIRED]: () => `Value is required`,
    [ValidationErrorType.UNKNOWN_FIELD]: () => `No unknown fields allowed`,
    [ValidationErrorType.NOT_A_STRING]: (e) =>
      `Value '${e.value}' (type: ${getTypeName(e.value)}) is not a valid string`,
    [ValidationErrorType.NOT_A_NUMBER]: (e) =>
      `Value '${e.value}' (type: ${getTypeName(e.value)}) is not a valid number`,
    [ValidationErrorType.NOT_AN_ENUM]: (e: IEnumNodeValidationError) =>
      `Value '${e.value}' is not a valid ${e.context.enumName}. Allowed values: ${e.context.allowedValues}`,
    [ValidationErrorType.NOT_A_BOOLEAN]: (e) =>
      `Value '${e.value}' (type: ${getTypeName(e.value)}) is not a valid boolean`,
    [ValidationErrorType.NOT_NULL]: (e) => `Value '${e.value}' (type: ${getTypeName(e.value)}) should be null`,
    [ValidationErrorType.NO_UNION_MATCH]: (e: IUnionNodeValidationError) =>
      `'Value ${e.value}' (type: ${getTypeName(e.value)}) did not match any of these types ${getNodeTypeName(e)}`,
    [ValidationErrorType.NOT_AN_OBJECT]: (e) => `Not a valid object`,
    [ValidationErrorType.RECORD_PROPERTY_FAILED]: (e: IRecordNodeValidationError) =>
      `Value of ${e.context.key} (type: ${getTypeName(e.value)}) is not a valid ${getNodeTypeName(e)}`,
    [ValidationErrorType.NOT_AN_ARRAY]: (e) =>
      `Value '${e.value}' (type: ${getTypeName(e.value)}) is not a valid array`,
    [ValidationErrorType.NO_LENGTH_MATCH]: (e) => `${e.value.length}`,
    [ValidationErrorType.LITERAL_NOT_MATCHING]: (e: ILiteralNodeValidationError) =>
      `Value '${e.value}' is not '${e.context.expected}'`,
    [ValidationErrorType.CUSTOM]: () => `Unknown error`,
    [ValidationErrorType.TYPE_CONSTRAINT_FAILED]: () => `Type constraint failed`,
    [LengthValidationError.LENGTH_FAILED]: (e) =>
      `Length of '${e.value}' must be at least ${e.context.min} and at most ${e.context.max}`,
    [StringValidationError.STRING_LENGTH_FAILED]: () => ``,
    [StringValidationError.NOT_A_NUMBER_LIST]: () => ``,
    [StringValidationError.NOT_A_NUMBER_STRING]: () => ``,
  },
};

export function formatErrors(nodeValidationError: INodeValidationError) {
  return groupErrors(flattenValidationError(nodeValidationError));
}

export function flattenValidationError(
  nodeValidationError: INodeValidationError,
  path: string[] = [],
): IErrorMessage[] {
  const messages: IErrorMessage[] = [];

  if (nodeValidationError.reason === ValidationErrorType.PROPERTY_FAILED) {
    for (const previousError of nodeValidationError.previousErrors) {
      messages.push(...flattenValidationError(previousError, path));
    }
    return messages;
  }

  switch (nodeValidationError.type) {
    case 'array':
    case 'tuple':
      if (isArrayNodeItemValidatorError(nodeValidationError)) {
        path = [...path, `[${nodeValidationError.context.element}]`];
        for (const previousError of nodeValidationError.previousErrors) {
          messages.push(...flattenValidationError(previousError, path));
        }
      } else if (isArrayNodeValidatorError(nodeValidationError) && nodeValidationError.previousErrors.length) {
        for (const previousError of nodeValidationError.previousErrors) {
          messages.push(...flattenValidationError(previousError, path));
        }
      } else {
        messages.push({
          path,
          nodeValidationError,
        });
      }
      break;
    case 'intersection':
      if (nodeValidationError.reason === ValidationErrorType.OBJECT_PROPERTY_FAILED) {
        for (const classError of nodeValidationError.previousErrors) {
          if (classError.type === 'class' || classError.type === 'intersection') {
            messages.push(...flattenValidationError(classError as INodeValidationError, path));
          }
        }
      } else {
        messages.push({
          path,
          nodeValidationError,
        });
      }
      break;
    case 'class':
      if (nodeValidationError.reason === ValidationErrorType.OBJECT_PROPERTY_FAILED) {
        const classErrors = nodeValidationError.previousErrors;
        for (const classError of classErrors) {
          const propertyPath = [...path, classError.context.propertyName];
          messages.push(...flattenValidationError(classError as INodeValidationError, propertyPath));
        }
      } else {
        messages.push({
          path,
          nodeValidationError,
        });
      }
      break;

    case 'union': {
      if (nodeValidationError.reason === ValidationErrorType.NO_UNION_MATCH) {
        const errors = nodeValidationError.previousErrors.map((previousError) => {
          if (previousError.type === 'class') {
            return previousError.context.className;
          } else if (previousError.type === 'enum') {
            return previousError.context.enumName;
          } else {
            return previousError.type;
          }
        });

        messages.push({
          path,
          nodeValidationError,
        });
      }

      break;
    }
    case 'enum': {
      messages.push({
        path,
        nodeValidationError,
      });
      break;
    }

    case 'record':
      const recordPath = nodeValidationError.context.key ? [...path, nodeValidationError.context.key] : path;
      if (nodeValidationError.reason === ValidationErrorType.NOT_AN_OBJECT) {
        messages.push({ path: recordPath, nodeValidationError });
      } else {
        messages.push({ path: recordPath, nodeValidationError: nodeValidationError.previousErrors[0] });
      }
      break;

    case 'constraint': {
      messages.push({
        path,
        nodeValidationError,
      });
      break;
    }

    default: {
      messages.push({
        path,
        nodeValidationError,
      });
    }
  }

  return messages;
}

export function groupErrors(errors: IErrorMessage[]) {
  const groupedErrors: Record<string, any> = {};
  for (const error of errors) {
    const jsonPath = `$.${error.path.join('.')}`;

    let translator = translations.EN[error.nodeValidationError.reason as ValidationErrorType];
    if (!translator) {
      translator = () => `FALLBACK`;
    }
    groupedErrors[jsonPath] = {
      message: translator(error.nodeValidationError),
      context: 'context' in error.nodeValidationError ? error.nodeValidationError.context : {},
    };
  }
  return groupedErrors;
}
