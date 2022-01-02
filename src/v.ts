import 'reflect-metadata';
import 'source-map-support/register';

import { randomUUID } from 'crypto';
import ErrorStackParser from 'error-stack-parser';
import {
  ClassDeclaration,
  ClassInstancePropertyTypes,
  ModuleDeclaration,
  Project,
  PropertyDeclarationStructure,
  QuestionTokenableNodeStructure,
  SourceFile,
  SyntaxKind,
} from 'ts-morph';

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
import { enumerate } from './utils';
import { ParseError, RecursionLimitError } from './errors';

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
  errors: Partial<Record<keyof T, INodeValidationError>>;
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
   * The line is needed to tell classes in the same file, with the same name but different namespaces apart
   *
   * This will only find classes defined toplevel or in namespaces (nesting supported). This will fail
   * for classes defined in other classes or in functions.
   *
   * This function will recurse through all namespaces defined in a file. Will throw if no class can be found.
   *
   * @param filename
   * @param className
   * @param line
   * @returns
   */
  getClass(filename: string, className: string, line: number): ClassDeclaration {
    const sourceFile = this.project.getSourceFileOrThrow(filename);

    const walkSyntaxNodes = (node: ReturnType<SourceFile['getChildAtIndex']>, level = 0): ClassDeclaration | null => {
      for (const c of node.getChildren()) {
        if (c.getKind() === SyntaxKind.ClassDeclaration) {
          if (c.getStartLineNumber() === line) {
            return c as ClassDeclaration;
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
      level = 1,
      tree?: TypeNode,
    ): TypeNode => {
      const log = (...args: any[]): void => console.log(' '.repeat(level), ...args);
      const spam = false;

      if (level > 10) {
        throw new RecursionLimitError('Recursion limit reached', {
          limit: 10,
          class: cls.getName(),
        });
      }

      if (!tree) {
        tree = new RootNode();
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
          walkTypeNodes(unionType, level + 1, unionNode);
        }
      } else if (t.isArray()) {
        const arrayNode = new ArrayNode();
        tree.children.push(arrayNode);
        walkTypeNodes(t.getArrayElementTypeOrThrow(), level + 1, arrayNode);
      } else if (t.isClass()) {
        // We won't do recursive stuff for now
        if (depth === 10) {
          throw new Error('loop detected');
        }

        // Get the class declartion for the referenced class and build a tree from it
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
          console.log('OMIT');
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
          const keyNames = new Set<string>();
          if (keys.isStringLiteral()) {
            keyNames.add(keys.getLiteralValueOrThrow().toString());
          } else if (keys.isUnion()) {
            for (const unionType of keys.getUnionTypes()) {
              keyNames.add(unionType.getLiteralValueOrThrow().toString());
              console.log({ keyNames });
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
        const tree = walkTypeNodes(type);

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
    const errors: IValidationError<T>['errors'] = {};
    for (const { name, tree } of propertyTypeTrees) {
      const result = tree.validate(values[name], { propertyName: name as string });
      if (!result.success) {
        errors[name] = result;
        allFieldsAreValid = false;
      } else {
        //
      }
      console.log(name, values[name], { result });
    }

    console.log(allFieldsAreValid);
    console.log('\n\n\n');

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
    const validatorMeta = Reflect.getMetadata(validatorMetadataKey, cls) as IValidatorClassMeta;

    const classDeclaration = this.getClass(validatorMeta.filename, cls.name, validatorMeta.line);

    return this.validateClassDeclaration<T>(classDeclaration, values);
  }

  validatorDecorator(options: IValidatorOptions = { auto: true }) {
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

  getValidationErrors<T>(root: IValidationError<T>['errors']) {
    const messages: any[] = [];
    for (const [field, error] of Object.entries<INodeValidationError>(root as any)) {
      const formatted = this.getValidationError<T>(error, [field]);
      messages.push(...formatted);
    }
    console.log(messages);
  }

  getValidationError<T>(
    error: INodeValidationError,
    path: string[] = [],
    messages: IErrorMessage[] = [],
  ): IErrorMessage[] {
    // const path: string[] = [];
    // path.push(error.type);
    switch (error.type) {
      case 'array':
        if (error.reason === ValidationErrorType.ELEMENT_TYPE_FAILED) {
          path = [...path, `[${error?.context?.element}]`];
          this.getValidationError<T>(error.previousError!, path, messages);
        } else {
          //
        }
        break;
      case 'class':
        // path.push(error.)
        if (error.reason === ValidationErrorType.OBJECT_PROPERTY_FAILED) {
          const classErrors = error.context!.classErrors as INodeValidationError[];
          for (const classError of classErrors) {
            const propertyPath = [...path, classError.context!.propertyName! as string];
            this.getValidationError<T>(classError, propertyPath, messages);
          }
        } else {
          messages.push({
            path,
            reason: error.reason!,
            value: error.value,
          });
        }
        break;

      /*case 'string':
        messages.push({
          path, //: `$.${path.join('.')}`,
          message: 'not a string',
          value: error.value,
        });
        break;

      case 'number': {
        throw new Error('Not implemented yet: "number" case');
      }*/
      case 'root': {
        throw new Error('Not implemented yet: "root" case');
      }
      case 'null': {
        throw new Error('Not implemented yet: "null" case');
      }
      case 'union': {
        throw new Error('Not implemented yet: "union" case');
      }
      case 'enum': {
        throw new Error('Not implemented yet: "enum" case');
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

interface IErrorMessage {
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
