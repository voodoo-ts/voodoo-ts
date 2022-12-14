import {
  IArrayNodeItemValidationError,
  IArrayNodeValidationError,
  IBaseNodeValidationError,
  IEnumNodeValidationError,
  ILiteralNodeValidationError,
  INodeValidationError,
  IRecordNodeValidationError,
  isArrayNodeItemValidatorError,
  IUnionNodeValidationError,
  ValidationErrorType,
} from './nodes';

export interface IErrorMessage {
  path: string[];
  // reason: INodeValidationError['reason'];
  // value: unknown;
  // context?: Record<string, unknown>;
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
    case 'decorator':
      return e.context.decorator.name;
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
  }
}

const translations: { EN: Record<ValidationErrorType, (error: any) => string> } = {
  EN: {
    [ValidationErrorType.VALUE_REQUIRED]: (e: IBaseNodeValidationError) => `Value is required`,
    [ValidationErrorType.UNKNOWN_FIELD]: (e) => `No unknown fields allowed`,
    [ValidationErrorType.NOT_A_STRING]: (e) => `'${e.value}' (type: ${getTypeName(e.value)}) is not a valid string`,
    [ValidationErrorType.NOT_A_NUMBER]: (e) => `'${e.value}' (type: ${getTypeName(e.value)}) is not a valid number`,
    [ValidationErrorType.NOT_AN_ENUM]: (e: IEnumNodeValidationError & IBaseNodeValidationError) =>
      `'${e.value}' is not a valid ${e.context.enumName}. Allowed values: ${e.context.allowedValues}`,
    [ValidationErrorType.NOT_A_BOOLEAN]: (e) => `'${e.value}' (type: ${getTypeName(e.value)}) is not a valid boolean`,
    [ValidationErrorType.NOT_NULL]: (e) => `'${e.value}' should be null`,
    [ValidationErrorType.NO_UNION_MATCH]: (e: IUnionNodeValidationError & IBaseNodeValidationError) =>
      `'${e.value}' did not match any of these types ${getNodeTypeName(e)}`,
    [ValidationErrorType.OBJECT_PROPERTY_FAILED]: (e) => `todo ${e}`,
    [ValidationErrorType.NOT_AN_OBJECT]: (e) => `Not a valid object`,
    [ValidationErrorType.RECORD_PROPERTY_FAILED]: (e: IRecordNodeValidationError) =>
      `Type of property ${e.context.key} is not ${'todo'}`,
    [ValidationErrorType.ARRAY_FAILED]: (e: IArrayNodeValidationError) => `array faile`,
    [ValidationErrorType.ARRAY_ITEM_FAILED]: (e: IArrayNodeItemValidationError) =>
      `Invalid value at index ${e.context.element}`,
    [ValidationErrorType.NOT_AN_ARRAY]: (e) => `'${e.value}' (type: ${getTypeName(e.value)}) is not a valid array`,
    [ValidationErrorType.NO_LENGTH_MATCH]: (e) => `${e.value.length}`,
    [ValidationErrorType.LITERAL_NOT_MATCHING]: (e: ILiteralNodeValidationError & IBaseNodeValidationError) =>
      `'${e.value}' is not '${e.context.expected}'`,
    [ValidationErrorType.DECORATORS_FAILED]: (e) => `todo`,
    [ValidationErrorType.CUSTOM]: (e) => `Unknown error`,
    [ValidationErrorType.PROPERTY_FAILED]: () => `propfailed`,
  },
};

export function flattenValidationError(
  nodeValidationError: INodeValidationError,
  path: string[] = [],
): IErrorMessage[] {
  const messages: IErrorMessage[] = [];
  switch (nodeValidationError.type) {
    case 'array':
    case 'tuple':
      if (isArrayNodeItemValidatorError(nodeValidationError)) {
        path = [...path, `[${nodeValidationError?.context?.element}]`];
        for (const previousError of nodeValidationError.previousErrors) {
          messages.push(...flattenValidationError(previousError, path));
        }
      } else if (nodeValidationError.reason === ValidationErrorType.DECORATORS_FAILED) {
        for (const classError of nodeValidationError.previousErrors) {
          messages.push(...flattenValidationError(classError, path));
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
        const classErrors = nodeValidationError.previousErrors[0].previousErrors;
        const errs = nodeValidationError.previousErrors[0];
        // if (errs.type === "")
        // for (const classError of classErrors) {
        //   if (classError.type === 'intersection') {
        //   } else if (classError.type === 'class') {
        //     const propertyPath = [...path, (classError.context as any).propertyName as any];
        //     messages.push(...flattenValidationError(classError as INodeValidationError, propertyPath));
        //   }
        // }
      } else {
        // const propertyPath = [...path, nodeValidationError.previousErrors[0].previousErrors[0].context.propertyName];
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
            return previousError.context;
          } else {
            return previousError.type;
          }
        });

        messages.push({
          path,
          nodeValidationError,
          // reason: nodeValidationError.reason,
          // value: nodeValidationError.value,
          // context: {
          //   unionErrors: errors,
          // },
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

    case 'decorator':
      messages.push({
        path,
        nodeValidationError,
      });
      break;

    case 'record':
      // const recordPath = nodeValidationError.context.key ? [...path, nodeValidationError.context.key] : path;
      // if (nodeValidationError.reason === ValidationErrorType.NOT_AN_OBJECT) {
      //   messages.push({ path: recordPath, nodeValidationError });
      // } else {
      //   console.log(nodeValidationError);
      //   messages.push({ path: recordPath, nodeValidationError: nodeValidationError.previousErrors[0] });
      // }
      break;

    default:
      if (nodeValidationError.reason !== ValidationErrorType.DECORATORS_FAILED) {
        messages.push({
          path,
          nodeValidationError,
        });
      }
      for (const classError of nodeValidationError.previousErrors) {
        messages.push(...flattenValidationError(classError, path));
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
