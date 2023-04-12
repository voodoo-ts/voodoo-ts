import {
  LengthValidationError,
  NumberListValidationError,
  NumberValidationError,
  StringValidationError,
} from './decorators';
import { RuntimeError } from './errors';
import {
  IConstraintNodeValidationError,
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
export type FormattedErrors = Record<string, { message: string; context: Record<string, unknown> }>;

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
    /* istanbul ignore next */
    default:
      throw new RuntimeError(`Unexpected node type ${e.type}`);
  }
}

const translations: {
  EN: Partial<
    Record<
      | ValidationErrorType
      | LengthValidationError
      | StringValidationError
      | NumberValidationError
      | NumberListValidationError,
      (error: any) => string
    >
  >;
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
    [ValidationErrorType.NO_UNION_MATCH]: (e: IUnionNodeValidationError) =>
      `'Value ${e.value}' (type: ${getTypeName(e.value)}) did not match any of these types ${getNodeTypeName(e)}`,
    [ValidationErrorType.NOT_AN_OBJECT]: () => `Not a valid object`,
    [ValidationErrorType.NOT_AN_ARRAY]: (e) =>
      `Value '${e.value}' (type: ${getTypeName(e.value)}) is not a valid array`,
    [ValidationErrorType.NO_LENGTH_MATCH]: (e) => `${e.value.length}`,
    [ValidationErrorType.LITERAL_NOT_MATCHING]: (e: ILiteralNodeValidationError) =>
      `Value '${e.value}' is not '${e.context.expected}'`,
    [ValidationErrorType.CUSTOM]: () => `Unknown error`,
    [LengthValidationError.LENGTH_FAILED]: (e) =>
      `Length of '${e.value}' must be at least ${e.context.min} and at most ${e.context.max ?? 'MAX_SAFE_INTEGER'}`,
    [StringValidationError.NOT_A_NUMBER_STRING]: (e: IConstraintNodeValidationError) =>
      `Value "${e.value}" can't be parsed as float`,
    [StringValidationError.NOT_A_INTEGER_STRING]: (e: IConstraintNodeValidationError) =>
      `Value "${e.value}" can't be parsed as integer`,
    [NumberListValidationError.INVALID_NUMBER_LIST_ITEM]: (e: IConstraintNodeValidationError) =>
      `Item at index ${e.context.i} in number list is not a valid integer`,
    [NumberValidationError.OUT_OF_RANGE]: (e: IConstraintNodeValidationError) =>
      `Value ${e.value} is out of range (${e.context.min}, ${e.context.max ?? 'MAX_SAFE_INTEGER'})`,
  },
};

export function formatErrors(nodeValidationError: INodeValidationError): FormattedErrors {
  return groupErrors(flattenValidationError(nodeValidationError, []));
}

export function flattenValidationError(nodeValidationError: INodeValidationError, path: string[]): IErrorMessage[] {
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
        messages.push({
          path,
          nodeValidationError,
        });
      }

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
      switch (nodeValidationError.reason) {
        case NumberListValidationError.INVALID_NUMBER_LIST:
          return nodeValidationError.previousErrors.flatMap((e) => flattenValidationError(e, path));
        default:
          return [{ path, nodeValidationError }];
      }
    }

    default: {
      if (nodeValidationError.previousErrors[0]?.type === 'constraint') {
        messages.push(...nodeValidationError.previousErrors.flatMap((e) => flattenValidationError(e, path)));
      } else {
        messages.push({
          path,
          nodeValidationError,
        });
      }
    }
  }

  return messages;
}

export function groupErrors(errors: IErrorMessage[]): FormattedErrors {
  const groupedErrors: Record<string, any> = {};
  for (const error of errors) {
    const jsonPath = `$.${error.path.join('.')}`;

    const translator = translations.EN[error.nodeValidationError.reason as ValidationErrorType];
    if (!translator) {
      throw new RuntimeError(`Can't find translator for ${error.nodeValidationError.reason}`);
    }
    groupedErrors[jsonPath] = {
      message: translator(error.nodeValidationError),
      context: 'context' in error.nodeValidationError ? error.nodeValidationError.context : {},
    };
  }
  return groupedErrors;
}
