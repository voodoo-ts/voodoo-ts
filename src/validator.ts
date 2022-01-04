import 'reflect-metadata';
import 'source-map-support/register';

import { randomUUID } from 'crypto';
import ErrorStackParser from 'error-stack-parser';
import {
  ClassDeclaration,
  ClassInstancePropertyTypes,
  Project,
  PropertyDeclaration,
  SourceFile,
  SyntaxKind,
} from 'ts-morph';

import { ParseError, RecursionLimitError } from './errors';
import {
  ArrayNode,
  BooleanNode,
  ClassNode,
  EnumNode,
  INodeValidationError,
  ITypeAndTree,
  NullNode,
  NumberNode,
  RootNode,
  StringNode,
  TypeNode,
  UndefinedNode,
  UnionNode,
  ValidationErrorType,
} from './nodes';

export const validatorMetadataKey = Symbol('format');

interface IValidatorOptions {
  auto: boolean;
}

export interface IValidatorClassMeta {
  id: string;

  filename: string;
  line: number;

  options: IValidatorOptions;
}

type Constructor<T> = new (...args: unknown[]) => T;

interface IValidationSuccess<T> {
  success: true;
  object: T;
}

interface IValidationError<T> {
  success: false;
  object: null;
  errors: Record<string | number | symbol, IErrorMessage[]>;
}

type IValidationResult<T> = IValidationSuccess<T> | IValidationError<T>;

type MaybePartial<T> = Partial<T> & Record<any, any>;

export interface IValidatorConstructorOptions {
  project: Project;
}

type GetClassTrees<T> = () => ITypeAndTree<T, keyof T>[];

class ClassTreeCache {
  map = new Map<string, ITypeAndTree[]>();

  getKey(classDeclaration: ClassDeclaration): string {
    const sourceFile = classDeclaration.getSourceFile();
    const line = classDeclaration.getStartLineNumber();
    const filename = sourceFile.getFilePath();
    const key = `${line}::${filename}`;
    return key;
  }

  get<T>(classDeclaration: ClassDeclaration): ITypeAndTree<T>[] | undefined {
    return this.map.get(this.getKey(classDeclaration)) as ITypeAndTree<T>[];
  }

  set<T>(classDeclaration: ClassDeclaration, classTrees: ITypeAndTree<T>[]): void {
    this.map.set(this.getKey(classDeclaration), classTrees);
  }
}

export class ValidatorInstance {
  project: Project;
  classTreeCache = new ClassTreeCache();

  constructor(options: IValidatorConstructorOptions) {
    this.project = options.project;
  }

  static withDefaultProject(): ValidatorInstance {
    return new ValidatorInstance({
      project: new Project({
        tsConfigFilePath: 'tsconfig.json',
        // Optionally specify compiler options, tsconfig.json, in-memory file system, and more here.
        // If you initialize with a tsconfig.json, then it will automatically populate the project
        // with the associated source files.
        // Read more: https://ts-morph.com/setup/
      }),
    });
  }

  /**
   * This method tries to find a class based on the className, filename and line where the @Validator() call occured.
   *
   * This loops through the whole syntax tree of the source file, and checks each class syntax node
   * if the line correspondents to the class. Because this is rather hacky, the `line` parameter
   * might not line up exactly to the class syntax node's start line. This considers decorators,
   * but will fail for more unconventional code styles. This however should always work:
   *
   * ```
   * @SomeDecorator()
   * @Validator()
   * @SomeOtherDecorator()
   * class Test {}
   *
   * ```
   *
   * @param filename Filename of the where the class should be searched
   * @param className String represtation of the className
   * @param line The line where the @Decorator() call occured
   * @returns
   */
  getClass(filename: string, className: string, line: number): ClassDeclaration {
    const sourceFile = this.project.getSourceFileOrThrow(filename);

    const walkSyntaxNodes = (node: ReturnType<SourceFile['getChildAtIndex']>, level = 0): ClassDeclaration | null => {
      for (const c of node.getChildren()) {
        if (c.getKind() === SyntaxKind.ClassDeclaration) {
          const cls = c as ClassDeclaration;

          // A class can have multiple decorators, collect their line numbers and check them too
          const decoratorLineStarts = cls.getDecorators().map((decorator) => decorator.getStartLineNumber());
          for (const decoratorLineStart of decoratorLineStarts) {
            if (decoratorLineStart === line) {
              return cls;
            }
          }

          if (cls.getStartLineNumber() === line) {
            return cls;
          }
        }
        const cls = walkSyntaxNodes(c, level + 1);
        if (cls) {
          return cls;
        }
      }
      return null;
    };

    const cls = walkSyntaxNodes(sourceFile);

    if (!cls) {
      throw new Error(`class not found: ${className}`);
    }

    return cls;
  }

  /**
   * This loops through all direct and indirect properties of `cls` and outputs them in the internal
   * TypeNode tree format
   *
   * @param cls A ts-morph class decleration whose members will be processed
   * @param depth Internal parameter to track recusrive depth, to bail out from infinite loops
   */
  getPropertyTypeTrees<T>(cls: ClassDeclaration, depth: number = 0): ITypeAndTree<T>[] {
    // Walk the syntax nodes for a type recursively and try to build a tree of validators from it
    // Error handling not existent, will bail on unknown nodes

    const cached = this.classTreeCache.get<T>(cls);
    if (cached) {
      return cached;
    }

    const walkTypeNodes = (
      t: ReturnType<ClassInstancePropertyTypes['getType']>,
      hasQuestionToken: boolean,
      tree?: TypeNode,
      level = 1,
    ): TypeNode => {
      const log = (...args: any[]): void => console.log(' '.repeat(level), ...args);

      if (level > 10) {
        throw new RecursionLimitError('Recursion limit reached', {
          limit: 10,
          class: cls.getName(),
        });
      }

      if (!tree) {
        // First function call, set up root node. If our property is defined as optional, the result type is T | undefined
        // If this is the case, unwrap the union to allow for nicer error reporting
        tree = new RootNode(hasQuestionToken);
        if (hasQuestionToken && t.isUnion()) {
          const unionTypes = t.getUnionTypes().filter((unionType) => !unionType.isUndefined());
          if (unionTypes.length === 1) {
            return walkTypeNodes(unionTypes[0], false, tree, level + 1);
          } else {
            const unionNode = new UnionNode();
            tree.children.push(unionNode);
            for (const unionType of unionTypes) {
              walkTypeNodes(unionType, false, unionNode, level + 1);
            }
            return tree;
          }
        }
      }

      if (t.isNumber()) {
        tree.children.push(new NumberNode());
      } else if (t.isString()) {
        tree.children.push(new StringNode());
      } else if (t.isBoolean()) {
        tree.children.push(new BooleanNode());
      } else if (t.isNull()) {
        tree.children.push(new NullNode());
      } else if (t.isUndefined()) {
        tree.children.push(new UndefinedNode());
      } else if (t.isEnum()) {
        const name = t.getText();
        const items = t.getUnionTypes().map((t) => t.getLiteralValueOrThrow()) as string[];

        tree.children.push(new EnumNode(name, items));
      } else if (t.isUnion()) {
        const unionNode = new UnionNode();
        tree.children.push(unionNode);
        for (const unionType of t.getUnionTypes()) {
          walkTypeNodes(unionType, false, unionNode, level + 1);
        }
      } else if (t.isArray()) {
        const arrayNode = new ArrayNode();
        tree.children.push(arrayNode);
        walkTypeNodes(t.getArrayElementTypeOrThrow(), false, arrayNode, level + 1);
      } else if (t.isClass()) {
        // We won't do recursive stuff for now
        if (depth === 10) {
          throw new Error('loop detected');
        }

        // Get the class declaration for the referenced class
        const referencedClassDeclaration = t.getSymbol()?.getDeclarations()[0] as ClassDeclaration;
        const className = t.getText();

        const getClassTrees: GetClassTrees<T> = () =>
          this.getPropertyTypeTrees<T>(referencedClassDeclaration, depth + 1);

        tree.children.push(new ClassNode(className, getClassTrees));
      } else if (t.isInterface()) {
        log('is interface', t.getText());
      } else if (t.getAliasSymbol()) {
        const name = t.getAliasSymbol()?.getFullyQualifiedName();

        if (name === 'Omit') {
          const typeArguments = t.getAliasTypeArguments();

          if (typeArguments.length !== 2) {
            throw new ParseError('Omit<T, U> has not the expected structure', {
              class: cls.getName(),
              asText: t.getText(),
              typeArguments,
            });
          }

          const [targetCls, keys] = typeArguments;

          const referencedClassDeclaration = targetCls.getSymbol()?.getDeclarations()[0] as ClassDeclaration;

          if (referencedClassDeclaration.getKind() !== SyntaxKind.ClassDeclaration) {
            throw new ParseError('Only other validators are supported as T', {
              class: cls.getName(),
              asText: t.getText(),
            });
          }

          const keyNames = new Set<string>();
          if (keys.isStringLiteral()) {
            keyNames.add(keys.getLiteralValueOrThrow().toString());
          } else if (keys.isUnion()) {
            for (const unionType of keys.getUnionTypes()) {
              keyNames.add(unionType.getLiteralValueOrThrow().toString());
            }
          } else {
            // TODO
            throw new ParseError('Unknown paramter U for Omit<T, U>', {
              class: cls.getName(),
              asText: keys.getText(),
              keys,
            });
          }

          const getClassTrees: GetClassTrees<T> = () => {
            const classTrees = this.getPropertyTypeTrees<T>(referencedClassDeclaration, depth + 1).filter(
              (tree) => !keyNames.has(tree.name as string),
            );
            return classTrees;
          };

          tree.children.push(new ClassNode(referencedClassDeclaration.getName() ?? '<unknown>', getClassTrees));
        } else {
          throw new ParseError('Syntax not supported', {
            class: cls.getName(),
            asText: t.getText(),
          });
        }
      } else {
        console.log('error', t.getText());

        debugger;

        throw new ParseError('Syntax not supported', {
          class: cls.getName(),
          asText: t.getText(),
        });
      }

      return tree;
    };

    // We need to merge in all attributes from base classes, so start with the supplied class
    // and walk up until there is no base class
    const trees: ITypeAndTree<T>[] = [];
    let currentClass: ClassDeclaration | undefined = cls;
    while (currentClass) {
      for (const prop of currentClass.getInstanceProperties()) {
        const type = prop.getType();
        const hasQuestionToken = (prop as PropertyDeclaration).hasQuestionToken();

        const tree = walkTypeNodes(type, hasQuestionToken);

        trees.push({
          name: prop.getName() as keyof T,
          tree,
        });
      }

      currentClass = currentClass.getBaseClass();
    }

    this.classTreeCache.set(cls, trees);

    return trees;
  }

  validateOrThrow<T>(cls: Constructor<T>, values: unknown): values is T {
    if (!(typeof values === 'object') || values === null) {
      return false;
    }
    const r = this.validate(cls, values);
    if (!r.success) {
      throw new Error('a');
    }
    return r.success;
  }

  validateClassDeclaration<T>(classDeclaration: ClassDeclaration, values: MaybePartial<T>): IValidationResult<T> {
    const propertyTypeTrees = this.getPropertyTypeTrees<T>(classDeclaration);

    let allFieldsAreValid = true;
    const errors: Record<string | number | symbol, IErrorMessage[]> = {};
    for (const { name, tree } of propertyTypeTrees) {
      const result = tree.validate(values[name], { propertyName: name as string });
      if (!result.success) {
        errors[name] = this.flattenValidationError(result, [name as string]);
        allFieldsAreValid = false;
      } else {
        //
      }
    }

    if (allFieldsAreValid) {
      return {
        success: true,
        object: values as T,
      };
    } else {
      console.log(JSON.stringify(errors, null, 2));
      return {
        success: false,
        object: null,
        errors,
      };
    }
  }

  validate<T>(cls: Constructor<T>, values: MaybePartial<T>): IValidationResult<T> {
    // Get metadata + types
    const validatorMeta = this.getClassMetadata(cls);

    const classDeclaration = this.getClass(validatorMeta.filename, cls.name, validatorMeta.line);

    return this.validateClassDeclaration<T>(classDeclaration, values);
  }

  validatorDecorator(options: IValidatorOptions = { auto: true }): ReturnType<typeof Reflect['metadata']> {
    const error = new Error();
    const stack = ErrorStackParser.parse(error);

    return Reflect.metadata(validatorMetadataKey, {
      filename: stack[1].fileName,
      line: stack[1].lineNumber,
      id: randomUUID(),
      options,
    });
  }

  getClassMetadata(cls: Constructor<unknown>): IValidatorClassMeta {
    return Reflect.getMetadata(validatorMetadataKey, cls) as IValidatorClassMeta;
  }

  flattenValidationError<T>(
    error: INodeValidationError,
    path: string[] = [],
    messages: IErrorMessage[] = [],
  ): IErrorMessage[] {
    switch (error.type) {
      case 'array':
        if (error.reason === ValidationErrorType.ELEMENT_TYPE_FAILED) {
          path = [...path, `[${error?.context?.element}]`];
          for (const previousError of error.previousErrors) {
            this.flattenValidationError<T>(previousError, path, messages);
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
            this.flattenValidationError<T>(classError, propertyPath, messages);
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
}

export interface IErrorMessage {
  path: string[];
  reason: ValidationErrorType;
  value: unknown;
  context?: Record<string, unknown>;
}

const instance = new ValidatorInstance({
  project: new Project({
    tsConfigFilePath: 'tsconfig.json',
    // Optionally specify compiler options, tsconfig.json, in-memory file system, and more here.
    // If you initialize with a tsconfig.json, then it will automatically populate the project
    // with the associated source files.
    // Read more: https://ts-morph.com/setup/
  }),
});
export const validate = instance.validate.bind(instance);
// eslint-disable-next-line @typescript-eslint/naming-convention
export const Validator = instance.validatorDecorator.bind(instance);
