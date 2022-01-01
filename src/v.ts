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

import { enumerate } from './utils';
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

// interface IValidationContext {
//   validate?: ValidatorInstance['validate'];
//   propertyName?: string;
//   level?: number;
// }

// abstract class TypeNodeBase {
//   abstract kind: string;
//   abstract validate(value: unknown, context: IValidationContext): INodeValidationResult;

//   wrapBoolean(value: unknown, result: boolean, extra: Partial<INodeValidationError> = {}): INodeValidationResult {
//     if (result) {
//       return this.success();
//     } else {
//       return this.fail(value, extra);
//     }
//   }

//   success(): INodeValidationSuccess {
//     return { success: true };
//   }

//   fail(value: unknown, extra: Partial<INodeValidationError> = {}): INodeValidationError {
//     return Object.assign(
//       {
//         success: false,
//         type: this.kind as TypeNode['kind'],
//         value,
//       },
//       extra,
//     );
//   }

//   children: TypeNodeBase[] = [];
// }

// class RootNode extends TypeNodeBase {
//   kind = 'root' as const;

//   validate(value: unknown, context: IValidationContext): INodeValidationResult {
//     if (context.level === undefined) {
//       context.level = 0;
//     }
//     for (const child of this.children) {
//       const result = child.validate(value, context);
//       if (!result.success) {
//         return result;
//       }
//     }
//     return this.success();
//   }
// }

// class StringNode extends TypeNodeBase {
//   kind = 'string' as const;

//   validate(value: unknown, context: IValidationContext): INodeValidationResult {
//     return this.wrapBoolean(value, typeof value === 'string');
//   }
// }

// class NumberNode extends TypeNodeBase {
//   kind = 'number' as const;

//   validate(value: unknown, context: IValidationContext): INodeValidationResult {
//     return this.wrapBoolean(value, typeof value === 'number');
//   }
// }

// class BooleanNode extends TypeNodeBase {
//   kind = 'boolean' as const;

//   validate(value: unknown, context: IValidationContext): INodeValidationResult {
//     return this.wrapBoolean(value, typeof value === 'boolean');
//   }
// }

// class NullNode extends TypeNodeBase {
//   kind = 'null' as const;

//   validate(value: unknown, context: IValidationContext): INodeValidationResult {
//     return this.wrapBoolean(value, value === null);
//   }
// }

// class UndefinedNode extends TypeNodeBase {
//   kind = 'undefined' as const;

//   validate(value: unknown, context: IValidationContext): INodeValidationResult {
//     return this.wrapBoolean(value, value === undefined);
//   }
// }

// class EnumNode extends TypeNodeBase {
//   kind = 'enum' as const;
//   name: string;
//   allowedValues: unknown[];

//   constructor(name: string, allowedValues: unknown[]) {
//     super();
//     this.name = name;
//     this.allowedValues = allowedValues;
//   }

//   validate(value: unknown, context: IValidationContext): INodeValidationResult {
//     return this.wrapBoolean(value, this.allowedValues.includes(value));
//   }
// }

// class UnionNode extends TypeNodeBase {
//   kind = 'union' as const;

//   validate(value: unknown, context: IValidationContext): INodeValidationResult {
//     for (const child of this.children) {
//       const result = child.validate(value, context);
//       if (result.success) {
//         return result;
//       }
//     }

//     return this.fail(value);
//   }
// }

// class ArrayNode extends TypeNodeBase {
//   kind = 'array' as const;

//   validate(value: unknown, context: IValidationContext): INodeValidationResult {
//     if (Array.isArray(value)) {
//       for (const [i, item] of enumerate(value)) {
//         for (const child of this.children) {
//           const result = child.validate(item, context);
//           if (!result.success) {
//             return this.fail(value, { reason: 'ELEMENT_TYPE_FAILED', context: { element: i }, previousError: result });
//           }
//         }
//       }
//       return this.success();
//     } else {
//       return this.fail(value, { reason: 'NOT_AN_ARRAY' });
//     }
//   }
// }

// class ClassNode extends TypeNodeBase {
//   kind = 'class' as const;
//   name: string;
//   // classTrees: ITypeAndTree<unknown, string>[];
//   getClassTrees: () => ITypeAndTree[];

//   constructor(fullReference: string, getClassTrees: () => ITypeAndTree[]) {
//     super();
//     this.name = fullReference;
//     this.getClassTrees = getClassTrees;
//   }

//   validate(value: unknown, context: IValidationContext): INodeValidationResult {
//     if (context.level === 10) {
//       throw new Error('loop');
//     }
//     if (typeof value === 'object' && value !== null) {
//       const errors: INodeValidationError[] = [];
//       for (const { name, tree } of this.getClassTrees()) {
//         const result = tree.validate((value as any)[name], { level: (context.level ?? 0) + 1 });
//         console.log({ name, value, x: (value as any)[name] });
//         console.log(JSON.stringify(result, null, 2));
//         if (!result.success) {
//           if (!result.context) {
//             result.context = {};
//           }
//           result.context.propertyName = name;
//           result.context.className = this.name;
//           errors.push(result);
//         }
//       }
//       if (errors.length) {
//         return this.fail(value, {
//           context: {
//             classErrors: errors,
//           },
//         });
//       } else {
//         return this.success();
//       }
//     } else {
//       return this.fail(value, { reason: 'NOT_AN_OBJECT' });
//     }
//   }
// }

// type TypeNode = RootNode | StringNode | NumberNode | NullNode | EnumNode | UnionNode | ClassNode | ArrayNode;

// interface INodeValidationSuccess {
//   success: true;
// }

// interface INodeValidationError {
//   success: false;
//   type: TypeNode['kind'];
//   value: unknown;
//   reason?: string;
//   expected?: unknown;
//   context?: Record<string, unknown>;
//   previousError?: INodeValidationError;
// }

// type INodeValidationResult = INodeValidationSuccess | INodeValidationError;

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
        // console.log(' '.repeat(level /*c.getIndentationLevel() * 2*/), c.getKindName(), c.getSymbol()?.getName());
        if (c.getKind() === SyntaxKind.ClassDeclaration) {
          // console.log(' '.repeat(level), '', c.getStartLineNumber(), line, (c as ClassDeclaration).getName());
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
    // console.log(sourceFile.getChildren().map((n) => n.getKindName()));
    const cls = walkSyntaxNodes(sourceFile);

    // const walkNamespaces = (namespace: ModuleDeclaration): ClassDeclaration | null => {
    //   console.log(namespace.getName());
    //   for (const childNamespace of namespace.getModules()) {
    //     const cls = walkNamespaces(childNamespace);
    //     if (cls) {
    //       return cls;
    //     }
    //   }

    //   const start = namespace.getStartLineNumber();
    //   const end = namespace.getEndLineNumber();
    //   console.log(namespace.getName(), start, end, line);
    //   if (line > start && line < end) {
    //     console.log('ns found');
    //     const cls = namespace.getClassOrThrow(className);
    //     if (cls) {
    //       return cls;
    //     }
    //   }

    //   return null;
    // };

    // let cls = sourceFile.getClass(className);
    // if (!cls) {
    //   for (const namespace of sourceFile.getModules()) {
    //     const result = walkNamespaces(namespace);
    //     if (result) {
    //       cls = result;
    //       break;
    //     }
    //   }
    // }

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
        throw new Error(`level > 10`);
      }

      if (!tree) {
        tree = new RootNode();
      }

      if (t.isNumber()) {
        if (spam) {
          log('is number');
        }
        tree.children.push(new NumberNode());
      } else if (t.isString()) {
        if (spam) {
          log('is string');
        }
        tree.children.push(new StringNode());
      } else if (t.isBoolean()) {
        if (spam) {
          log('is bool');
        }
        tree.children.push(new BooleanNode());
      } else if (t.isNull()) {
        if (spam) {
          log('is null');
        }
        tree.children.push(new NullNode());
      } else if (t.isUndefined()) {
        if (spam) {
          log('is undefined');
        }
        tree.children.push(new UndefinedNode());
      } else if (t.isEnum()) {
        const name = t.getText();
        if (spam) {
          log('is enum', name);
        }
        const items = t.getUnionTypes().map((t) => t.getLiteralValueOrThrow()) as string[];
        if (spam) {
          log('items', items);
        }
        tree.children.push(new EnumNode(name, items));
      } else if (t.isUnion()) {
        if (spam) {
          log('is union');
        }

        const unionNode = new UnionNode();
        tree.children.push(unionNode);
        for (const unionType of t.getUnionTypes()) {
          walkTypeNodes(unionType, level + 1, unionNode);
        }
      } else if (t.isArray()) {
        if (spam) {
          log('is array');
        }

        const arrayNode = new ArrayNode();
        tree.children.push(arrayNode);
        walkTypeNodes(t.getArrayElementTypeOrThrow(), level + 1, arrayNode);
      } else if (t.isClass()) {
        if (!spam) {
          log('is class', t.getText());
        }

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
        if (spam) {
          log('is interface', t.getText());
        }
      } else if (t.getAliasSymbol()) {
        const name = t.getAliasSymbol()?.getFullyQualifiedName();
        log('hastypesymbol', name);

        if (name === 'Omit') {
          console.log('OMIT');
          const typeArguments = t.getAliasTypeArguments();

          if (typeArguments.length !== 2) {
            throw new Error('');
          }

          const [cls, keys] = typeArguments;

          const referencedClassDeclaration = cls.getSymbol()?.getDeclarations()[0] as ClassDeclaration;
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
            throw new Error('a');
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
        console.log('error', t.getText(), t.getAliasSymbol()?.getFullyQualifiedName());
        // console.log(t.getAliasSymbol()?.getFullyQualifiedName());
        debugger;
        throw new Error('unknown type node');
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
