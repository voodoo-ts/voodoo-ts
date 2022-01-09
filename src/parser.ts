import {
  ClassDeclaration,
  InterfaceDeclaration,
  Node,
  PropertyDeclaration,
  SyntaxKind,
  Type,
  TypeLiteralNode,
} from 'ts-morph';

import { ParseError } from './errors';
import {
  ArrayNode,
  BooleanNode,
  ClassNode,
  EnumNode,
  ITypeAndTree,
  NullNode,
  NumberNode,
  RootNode,
  StringNode,
  TypeNode,
  UndefinedNode,
  UnionNode,
} from './nodes';

type GetClassTrees = () => ITypeAndTree[];

type ClassOrInterfaceOrLiteral = ClassDeclaration | InterfaceDeclaration | TypeLiteralNode;

interface IOmitParameters {
  referencedClassDeclaration: ClassOrInterfaceOrLiteral;
  propertyNames: Set<string>;
}

export function isParseError(error: unknown): error is ParseError {
  return error instanceof ParseError;
}

function isClass(obj: Node): obj is ClassDeclaration {
  return obj.getKind() === SyntaxKind.ClassDeclaration;
}

function isInterface(obj: Node): obj is InterfaceDeclaration {
  return obj.getKind() === SyntaxKind.InterfaceDeclaration;
}
function isClassOrInterfaceOrLiteral(obj?: Node): obj is ClassOrInterfaceOrLiteral {
  if (!obj) {
    return false;
  }

  return (
    obj.getKind() === SyntaxKind.ClassDeclaration ||
    obj.getKind() === SyntaxKind.InterfaceDeclaration ||
    obj.getKind() === SyntaxKind.TypeLiteral
  );
}

function getName(obj: ClassOrInterfaceOrLiteral): string {
  if (isClass(obj) || isInterface(obj)) {
    const name = obj.getName();
    if (name) {
      return name;
    }
  }

  return `${obj.getSourceFile().getFilePath()}:${obj.getStartLineNumber()}`;
}

function getFirstSymbolDeclaration(type: Type): ClassOrInterfaceOrLiteral {
  const declaration = type.getSymbol()?.getDeclarations()[0];
  if (!declaration) {
    throw new ParseError('No declaration found', {
      asText: type.getText(),
    });
  }

  if (!isClassOrInterfaceOrLiteral(declaration)) {
    throw new ParseError('Symbol is not a class / interface / object literal', {
      asText: type.getText(),
    });
  }

  return declaration;
}

function getOmitParameters(type: Type): IOmitParameters {
  const typeArguments = type.getAliasTypeArguments();

  if (typeArguments.length !== 2) {
    throw new ParseError('Omit<T, U> has not the expected structure', {
      asText: type.getText(),
      typeArguments,
    });
  }

  const [targetType, stringLiteralOrUnion] = typeArguments;

  const referencedClassDeclaration = getFirstSymbolDeclaration(targetType);

  const propertyNames = new Set<string>();
  if (stringLiteralOrUnion.isStringLiteral()) {
    propertyNames.add(stringLiteralOrUnion.getLiteralValueOrThrow().toString());
  } else if (stringLiteralOrUnion.isUnion()) {
    for (const unionType of stringLiteralOrUnion.getUnionTypes()) {
      propertyNames.add(unionType.getLiteralValueOrThrow().toString());
    }
  } else {
    throw new ParseError('Unknown paramter U for Omit<T, U>', {
      asText: stringLiteralOrUnion.getText(),
      keys: stringLiteralOrUnion,
    });
  }

  return { referencedClassDeclaration, propertyNames };
}

class ClassTreeCache {
  map = new Map<string, ITypeAndTree[]>();

  getKey(classDeclaration: ClassOrInterfaceOrLiteral): string {
    const sourceFile = classDeclaration.getSourceFile();
    const line = classDeclaration.getStartLineNumber();
    const filename = sourceFile.getFilePath();
    return `${line}::${filename}`;
  }

  get(classDeclaration: ClassOrInterfaceOrLiteral): ITypeAndTree[] | undefined {
    return this.map.get(this.getKey(classDeclaration)) as ITypeAndTree[];
  }

  set(classDeclaration: ClassOrInterfaceOrLiteral, classTrees: ITypeAndTree[]): void {
    this.map.set(this.getKey(classDeclaration), classTrees);
  }
}

export class Parser {
  classTreeCache = new ClassTreeCache();
  walkTypeNodes(
    classDeclaration: ClassOrInterfaceOrLiteral,
    type: Type,
    hasQuestionToken: boolean,
    tree?: TypeNode,
  ): TypeNode {
    // Walk the syntax nodes for a type recursively and try to build a tree of validators from it

    if (!tree) {
      // First function call, set up root node. If our property is defined as optional, the result type is T | undefined
      // If this is the case, unwrap the union to allow for nicer error reporting
      tree = new RootNode(hasQuestionToken);
      if (hasQuestionToken && type.isUnion()) {
        const unionTypes = type.getUnionTypes().filter((unionType) => !unionType.isUndefined());
        if (unionTypes.length === 1) {
          // Prevent unnecessary UnionNode
          return this.walkTypeNodes(classDeclaration, unionTypes[0], false, tree);
        } else {
          const unionNode = new UnionNode();
          tree.children.push(unionNode);
          for (const unionType of unionTypes) {
            this.walkTypeNodes(classDeclaration, unionType, false, unionNode);
          }
          return tree;
        }
      }
    }

    if (type.isNumber()) {
      tree.children.push(new NumberNode());
    } else if (type.isString()) {
      tree.children.push(new StringNode());
    } else if (type.isBoolean()) {
      tree.children.push(new BooleanNode());
    } else if (type.isNull()) {
      tree.children.push(new NullNode());
    } else if (type.isUndefined()) {
      tree.children.push(new UndefinedNode());
    } else if (type.isEnum()) {
      const name = type.getText();
      const items = type.getUnionTypes().map((t) => t.getLiteralValueOrThrow()) as string[];

      tree.children.push(new EnumNode(name, items));
    } else if (type.isUnion()) {
      const unionNode = new UnionNode();
      tree.children.push(unionNode);
      for (const unionType of type.getUnionTypes()) {
        this.walkTypeNodes(classDeclaration, unionType, false, unionNode);
      }
    } else if (type.isArray()) {
      const arrayNode = new ArrayNode();
      tree.children.push(arrayNode);
      this.walkTypeNodes(classDeclaration, type.getArrayElementTypeOrThrow(), false, arrayNode);
    } else if (type.isClass()) {
      // Get the class declaration for the referenced class
      const referencedClassDeclaration = getFirstSymbolDeclaration(type);
      const className = type.getText();

      const getClassTrees: GetClassTrees = () => this.getPropertyTypeTrees(referencedClassDeclaration);

      tree.children.push(new ClassNode(className, getClassTrees));
    } else if ((type.isInterface() || type.isObject()) && !type.getAliasSymbol()) {
      // TODO
      // debugger;
      const referencedDeclaration = getFirstSymbolDeclaration(type);
      const getClassTrees: GetClassTrees = () => this.getPropertyTypeTrees(referencedDeclaration);

      tree.children.push(new ClassNode(getName(referencedDeclaration), getClassTrees));
    } else if (type.getAliasSymbol()) {
      const name = type.getAliasSymbol()?.getFullyQualifiedName();

      if (name === 'Omit') {
        const { referencedClassDeclaration, propertyNames } = getOmitParameters(type);

        const getClassTrees: GetClassTrees = () => {
          const classTrees = this.getPropertyTypeTrees(referencedClassDeclaration).filter(
            (tree) => !propertyNames.has(tree.name),
          );
          return classTrees;
        };

        tree.children.push(new ClassNode(getName(referencedClassDeclaration), getClassTrees));
      } else {
        throw new ParseError('Syntax not supported', {
          asText: type.getText(),
        });
      }
    } else {
      throw new ParseError('Syntax not supported', {
        asText: type.getText(),
      });
    }

    return tree;
  }

  /**
   * This loops through all direct and indirect properties of `cls` and outputs them in the internal
   * TypeNode tree format
   *
   * @param cls A ts-morph class declaration whose members will be processed
   */
  getPropertyTypeTrees(cls: ClassOrInterfaceOrLiteral): ITypeAndTree[] {
    const cached = this.classTreeCache.get(cls);
    if (cached) {
      return cached;
    }

    // We need to merge in all attributes from base classes, so start with the supplied class
    // and walk up until there is no base class
    const trees: ITypeAndTree[] = [];
    let currentClass: ClassOrInterfaceOrLiteral | undefined = cls;
    while (currentClass) {
      const properties = isClass(currentClass) ? currentClass.getInstanceProperties() : currentClass.getProperties();
      for (const prop of properties) {
        const type = prop.getType();
        const hasQuestionToken = (prop as PropertyDeclaration).hasQuestionToken();

        let tree: TypeNode;
        try {
          tree = this.walkTypeNodes(currentClass, type, hasQuestionToken);
        } catch (error) {
          if (isParseError(error)) {
            // Enrich context
            error.context.class = getName(currentClass);
          }
          throw error;
        }

        trees.push({
          name: prop.getName(),
          tree,
        });
      }

      if (isClass(currentClass)) {
        console.log('cls', currentClass.getBaseClass()?.getName());
        currentClass = currentClass.getBaseClass();
      } else if (isInterface(currentClass)) {
        const [baseInterface] = currentClass.getBaseDeclarations();
        if (baseInterface && isInterface(baseInterface)) {
          currentClass = baseInterface;
        } else {
          break;
        }
      } else {
        // No need to traverse for literals
        break;
      }
    }

    this.classTreeCache.set(cls, trees);

    return trees;
  }
}
