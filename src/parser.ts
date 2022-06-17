import path from 'path';
import process from 'process';
import {
  ClassDeclaration,
  InterfaceDeclaration,
  Node,
  PropertyDeclaration,
  SourceFile,
  SyntaxKind,
  Type,
  TypeLiteralNode,
} from 'ts-morph';

import {
  getAnnotations,
  getDecorators,
  groupDecorators,
  IAnnotationDecoratorMeta,
  IValidationDecoratorMeta,
} from './decorators';
import { ParseError, RuntimeError } from './errors';
import {
  AnyNode,
  ArrayNode,
  BooleanNode,
  ClassNode,
  DecoratorNode,
  EnumNode,
  IntersectionNode,
  ITypeAndTree,
  LiteralNode,
  NullNode,
  NumberNode,
  RecordNode,
  RootNode,
  StringNode,
  TupleNode,
  TypeNode,
  UndefinedNode,
  UnionNode,
  walkPropertyTypeTree,
} from './nodes';
import { Constructor } from './types';
import { zip } from './utils';

type GetClassTrees = () => ITypeAndTree[];

type ClassOrInterfaceOrLiteral = ClassDeclaration | InterfaceDeclaration | TypeLiteralNode;

interface IOmitParameters {
  referencedClassDeclaration: ClassOrInterfaceOrLiteral;
  targetType: Type;
  propertyNames: Set<string>;
}

interface IMinimalProperty {
  getName(): string;
  getType(): Type;
  getStartLineNumber(...args: unknown[]): number;
  getSourceFile(): SourceFile;
  hasQuestionToken?(): boolean;
}

interface IPropertyListItem {
  declaration: ClassOrInterfaceOrLiteral | null;
  props: IMinimalProperty[];
  typeMap?: TypeMap;
}

/**
 * Typeguard to ensure a thrown exception is a ParseError
 * @param error
 * @returns
 */
export function isParseError(error: unknown): error is ParseError {
  return error instanceof ParseError;
}

/**
 * Typeguard to ensure obj is a class declaration
 * @param obj Must be a ts-morph node
 * @returns
 */
export function isClass(obj: Node): obj is ClassDeclaration {
  return obj?.getKind && obj.getKind() === SyntaxKind.ClassDeclaration;
}

/**
 * Typeguard to ensure obj is an interface declaration
 * @param obj - Must be a ts-morph node
 * @returns
 */
function isInterface(obj: Node): obj is InterfaceDeclaration {
  return obj?.getKind && obj.getKind() === SyntaxKind.InterfaceDeclaration;
}

/**
 * Typeguard to ensure obj is an type literal declaration
 * @param obj - Must be a ts-morph node
 * @returns
 */
function isTypeLiteral(obj: Node): obj is TypeLiteralNode {
  return obj?.getKind && obj.getKind() === SyntaxKind.TypeLiteral;
}

/**
 * Typeguard to ensure obj is class or interface declaration or a literal
 * @param obj -
 * @returns
 */
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

/**
 * Returns the name of a class or an interface. For object literals it'll use
 * the filename and line number as name
 * @param obj - A class, interface or objectliteral delcaration.
 * @returns
 */
function getName(obj: ClassOrInterfaceOrLiteral | null): string {
  /* istanbul ignore if */
  if (obj === null) {
    return 'null';
  }

  if (isClass(obj) || isInterface(obj)) {
    const name = obj.getName();
    if (name) {
      return name;
    }
  }

  return `${obj.getSourceFile().getFilePath()}:${obj.getStartLineNumber()}`;
}

function getTypeId(type: Type): number {
  // eslint-disable-next-line no-underscore-dangle
  const compilerType = (type as any)._compilerType;
  if (typeof compilerType?.id === 'number') {
    return compilerType.id;
  }
  throw new ParseError(`Can't get type id for: ${type.getText()}`);
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
  const [targetType, stringLiteralOrUnion] = type.getAliasTypeArguments();

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

  return { referencedClassDeclaration, propertyNames, targetType };
}

export class ClassCache<T> {
  map = new Map<string, T>();

  /**
   * Computes a cache key for a class, interface or object literal. Since names
   * can occur multiple times in a file, this uses the filename and line as key
   * @param classDeclaration
   * @returns
   */
  static getKey(classDeclaration: ClassOrInterfaceOrLiteral): string {
    const sourceFile = classDeclaration.getSourceFile();
    const line = classDeclaration.getStartLineNumber();
    const filename = path.relative(process.cwd(), sourceFile.getFilePath());
    return `${line}:${filename}`;
  }

  getByKey(key: string): T | undefined {
    return this.map.get(key);
  }

  get(classDeclaration: ClassOrInterfaceOrLiteral): T | undefined {
    return this.map.get(ClassCache.getKey(classDeclaration)) as T;
  }

  set(classDeclaration: ClassOrInterfaceOrLiteral, classTrees: T): void {
    this.map.set(ClassCache.getKey(classDeclaration), classTrees);
  }
}

export class TypeCache<T> {
  map = new Map<string, T>();

  /**
   * Computes a cache key for a class or file, this also considers type arguments for generics
   * @param classDeclaration - An interface, class or literal node
   * @param typeParameters - typeIds from the type's generic parameters
   * @returns
   */
  static getKey(classDeclaration: ClassOrInterfaceOrLiteral, typeParameters: number[]): string {
    const sourceFile = classDeclaration.getSourceFile();
    const line = classDeclaration.getStartLineNumber();
    const filename = path.relative(process.cwd(), sourceFile.getFilePath());

    return JSON.stringify({
      reference: `${line}:${classDeclaration.getPos()}:${filename}`,
      parameters: typeParameters,
    });
  }

  getByKey(key: string): T | undefined {
    return this.map.get(key);
  }

  get(classDeclaration: ClassOrInterfaceOrLiteral, typeParameters: number[]): T | undefined {
    return this.map.get(TypeCache.getKey(classDeclaration, typeParameters)) as T;
  }

  set(classDeclaration: ClassOrInterfaceOrLiteral, typeParameters: number[], classTrees: T): void {
    this.map.set(TypeCache.getKey(classDeclaration, typeParameters), classTrees);
  }
}

export interface ITypeSignature {
  declaration: ClassOrInterfaceOrLiteral;
  parameters: Type[];
}

type TypeMap = Map<string, Type>;

export class Parser {
  classDeclarationToClassReference = new ClassCache<Constructor<unknown>>();
  classTreeCache = new TypeCache<ITypeAndTree[]>();
  declarationsDiscovered = new Set<string>();

  constructor(classDeclarationToClassReference: ClassCache<Constructor<unknown>>) {
    this.classDeclarationToClassReference = classDeclarationToClassReference;
  }

  handleRootNode(type: Type, hasQuestionToken: boolean): [TypeNode, Type] {
    const tree = new RootNode(hasQuestionToken);

    if (type.isUnion()) {
      const unionTypes = type.getUnionTypes();
      const hasUndefined = unionTypes.find((t) => t.isUndefined());
      const unionTypesWithoutUndefined = unionTypes.filter((unionType) => !unionType.isUndefined());

      if (hasUndefined) {
        tree.optional = true;
      }

      if (unionTypesWithoutUndefined.length === 1) {
        // Prevent unnecessary UnionNode
        return [tree, unionTypesWithoutUndefined[0]];
      } else {
        return [tree, type];
      }
    }
    return [tree, type];
  }

  handleTypeParameter(type: Type, typeMap?: TypeMap): Type {
    if (type.isTypeParameter()) {
      const typeName = type.getSymbolOrThrow().getName();

      if (!typeMap) {
        throw new ParseError(`No typeMap supplied, can't resolve "${typeName}"`);
      }

      const aliasedType = typeMap.get(typeName);

      if (aliasedType) {
        return aliasedType;
      } else {
        throw new ParseError(`Can't find type in "${typeName}" in typeMap`);
      }
    }

    return type;
  }

  walkTypeNodes(
    type: Type,
    { tree, typeMap, ...params }: { hasQuestionToken?: boolean; tree?: TypeNode; typeMap?: TypeMap } = {},
  ): TypeNode {
    // Walk the syntax nodes for a type recursively and try to build a tree of validators from it

    if (!tree) {
      // First function call, set up root node. If our property is defined as optional, the result type is T | undefined
      // If this is the case, unwrap the union to allow for nicer error reporting
      [tree, type] = this.handleRootNode(type, Boolean(params.hasQuestionToken));
    }

    type = this.handleTypeParameter(type, typeMap);

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
    } else if (type.isNumberLiteral() || type.isStringLiteral()) {
      tree.children.push(new LiteralNode(type.getLiteralValue()));
    } else if (type.isBooleanLiteral()) {
      const expected = type.getText() === 'true';
      tree.children.push(new LiteralNode(expected));
    } else if (type.isAny() || type.isUnknown()) {
      tree.children.push(new AnyNode());
    } else if (type.isEnum()) {
      const name = type.getText();
      const items = type.getUnionTypes().map((t) => t.getLiteralValueOrThrow()) as string[];

      tree.children.push(new EnumNode(name, items));
    } else if (type.isIntersection()) {
      tree.children.push(this.createIntersectionNode(type, typeMap));
    } else if (type.isUnion()) {
      this.handleUnion(type, tree);
    } else if (type.isArray()) {
      const arrayNode = new ArrayNode();
      tree.children.push(arrayNode);
      this.walkTypeNodes(type.getArrayElementTypeOrThrow(), { tree: arrayNode });
    } else if ((type.isInterface() || type.isObject() || type.isClass()) && !type.getAliasSymbol()) {
      if (!type.isTuple()) {
        tree.children.push(this.createClassNode(type));
      } else {
        this.handleTuple(type, tree);
      }
    } else if (type.getAliasSymbol()) {
      this.handleAliasSymbols(type, tree);
    } else {
      throw new ParseError(`Syntax not supported: ${type.getText()}`, {
        asText: type.getText(),
        noBranchMatched: true,
      });
    }

    return tree;
  }

  handleTuple(type: Type, tree: TypeNode): void {
    const tupleNode = new TupleNode();
    tree.children.push(tupleNode);
    for (const tupleElementType of type.getTypeArguments()) {
      this.walkTypeNodes(tupleElementType, { tree: tupleNode });
    }
  }

  handleUnion(type: Type, tree: TypeNode): void {
    const unionNode = new UnionNode();
    tree.children.push(unionNode);
    for (const unionType of type.getUnionTypes()) {
      // Skip undefined, it is already handled by the RootNode
      if (tree.kind === 'root' && unionType.isUndefined()) {
        continue;
      }
      this.walkTypeNodes(unionType, { tree: unionNode });
    }
  }

  handleAliasSymbols(type: Type, tree: TypeNode): void {
    const name = type.getAliasSymbol()?.getFullyQualifiedName();

    if (name === 'Omit' || name === 'Pick') {
      const { targetType, propertyNames } = getOmitParameters(type);
      const propertyFilter = (tree: ITypeAndTree): boolean =>
        (propertyNames.has(tree.name) && name === 'Pick') || (!propertyNames.has(tree.name) && name === 'Omit');

      const contextProperty = name === 'Pick' ? 'picked' : 'omitted';
      tree.children.push(
        this.createClassNode(targetType, propertyFilter, {
          [contextProperty]: propertyNames,
        }),
      );
    } else if (name === 'Record') {
      const recordNode = new RecordNode();
      const [keyType, valueType] = type.getAliasTypeArguments();
      this.walkTypeNodes(keyType, { tree: recordNode });
      this.walkTypeNodes(valueType, { tree: recordNode });
      tree.children.push(recordNode);
    } else {
      throw new ParseError(`Syntax not supported: ${type.getText()}`, {
        asText: type.getText(),
        hasAliasSymbol: true,
      });
    }
  }

  createIntersectionNode(type: Type, typeMap?: TypeMap): IntersectionNode {
    const childRootNodes = type
      .getIntersectionTypes()
      .map((intersectionType) => this.walkTypeNodes(intersectionType, { typeMap }));
    const classNodes = childRootNodes.flatMap((rootNode) => rootNode.children as ClassNode[]);

    if (classNodes.some((c) => c.kind !== 'class')) {
      throw new ParseError(
        `Intersections can only consist of known classes, interface and/or objects. Type: ${type.getText()}`,
      );
    }

    const getAllowedFields = (): Set<string> =>
      new Set<string>(classNodes.flatMap((classNode) => classNode.getClassTrees()).flatMap(({ name }) => name));
    const references = classNodes.map((c) => c.meta.reference as string);

    const intersectionNode = new IntersectionNode(type.getText(), getAllowedFields, references);

    intersectionNode.children.push(...classNodes);
    return intersectionNode;
  }

  createClassNode(
    type: Type,
    filter: (t: ITypeAndTree) => boolean = () => true,
    meta: Record<string, unknown> = {},
  ): ClassNode {
    const referencedDeclaration = getFirstSymbolDeclaration(type);

    let typeMap: TypeMap | undefined;
    if (isClass(referencedDeclaration) || isInterface(referencedDeclaration)) {
      const declarationTypeParameters = referencedDeclaration.getTypeParameters();

      typeMap = new Map(
        zip(
          declarationTypeParameters.map((t) => t.getName()),
          type.getTypeArguments(),
        ),
      );
    }

    const getClassTrees: GetClassTrees = () => this.getPropertyTypeTrees(referencedDeclaration, typeMap).filter(filter);

    const typeSignature = TypeCache.getKey(referencedDeclaration, type.getTypeArguments().map(getTypeId));

    if (!this.declarationsDiscovered.has(typeSignature)) {
      this.declarationsDiscovered.add(typeSignature);
      // Discover embedded interfaces / objects in references declaration, but only once
      getClassTrees();
    }

    const from =
      {
        [SyntaxKind.ClassDeclaration]: 'class',
        [SyntaxKind.InterfaceDeclaration]: 'interface',
        [SyntaxKind.TypeLiteral]: 'object',
      }[referencedDeclaration.getKind() as number] ?? 'unknown';

    return new ClassNode(
      {
        name: getName(referencedDeclaration),
        meta: {
          ...meta,
          reference: typeSignature,
          from,
        },
      },
      getClassTrees,
    );
  }

  /**
   * This loops through all direct and indirect properties of `cls` and outputs them in the internal
   * TypeNode tree format
   *
   * @param classDeclaration A ts-morph class declaration whose members will be processed
   * @param typeMap Maps the type parameter name to the type it represents
   */
  getPropertyTypeTrees(classDeclaration: ClassOrInterfaceOrLiteral, typeMap?: TypeMap): ITypeAndTree[] {
    const types = typeMap ? Array.from(typeMap?.values()).map(getTypeId) : [];
    const cached = this.classTreeCache.get(classDeclaration, types);
    if (cached) {
      return cached;
    }

    // We need to merge in all attributes from base classes, so start with the supplied class
    // and walk up until there is no base class
    const trees: ITypeAndTree[] = [];

    for (const { declaration, props: properties, typeMap: defaultTypeMap } of this.getAllProperties(classDeclaration)) {
      for (const prop of properties) {
        const mergedTypeMap: TypeMap = new Map(defaultTypeMap);
        for (const [k, v] of typeMap?.entries() ?? []) {
          if (mergedTypeMap.has(k)) {
            throw new ParseError('megablorb');
          }
          mergedTypeMap.set(k, v);
        }

        const name = prop.getName();
        const tree = this.buildTypeTree(declaration, prop, mergedTypeMap);

        if (declaration && isClass(declaration)) {
          this.applyDecorators(declaration, name, tree);
        }

        trees.push({
          name,
          tree,
        });
      }
    }

    this.classTreeCache.set(classDeclaration, types, trees);

    return trees;
  }

  getClassNode(classDeclaration: ClassOrInterfaceOrLiteral): ClassNode {
    const trees = this.getPropertyTypeTrees(classDeclaration);
    const classNode = new ClassNode({ name: getName(classDeclaration) }, () => trees);

    return classNode;
  }

  buildTypeMap(
    currentDeclaration: ClassDeclaration | InterfaceDeclaration,
    currentBaseType: Type | undefined | null,
  ): TypeMap | undefined {
    let typeMap: TypeMap | undefined;
    if (currentBaseType) {
      if (currentBaseType.getTypeArguments().length) {
        typeMap = new Map(
          zip(
            currentDeclaration.getTypeParameters().map((t) => t.getName()),
            currentBaseType.getTypeArguments(),
          ),
        );
      }
    }
    return typeMap;
  }

  getClassHierarchyProperties(classDeclaration: ClassDeclaration, type?: Type): IPropertyListItem[] {
    const properties: IPropertyListItem[] = [];

    let currentDeclaration: ClassDeclaration | undefined = classDeclaration;
    let currentBaseType: Type | undefined = type;
    while (currentDeclaration) {
      let typeMap: TypeMap | undefined;
      if (currentBaseType) {
        if (currentBaseType.getTypeArguments().length) {
          typeMap = new Map(
            zip(
              currentDeclaration.getTypeParameters().map((t) => t.getName()),
              currentBaseType.getTypeArguments(),
            ),
          );
        }
      }

      const props = currentDeclaration.getInstanceProperties();

      properties.push({
        declaration: currentDeclaration,
        props,
        typeMap,
      });

      // Base classes also might also carry a base type which is needed to find
      // out the type parameters if the base class is generic. There should be only one
      // base type, since there is also only base class.
      const baseTypes = currentDeclaration.getBaseTypes();
      if (baseTypes.length) {
        if (baseTypes.length > 1) {
          throw new ParseError(
            `Class declaration with multiple base types encountered. This scenario is not supported`,
          );
        }
      }
      [currentBaseType] = currentDeclaration.getBaseTypes();

      currentDeclaration = currentDeclaration.getBaseClass();
    }

    properties.reverse();

    return properties;
  }

  getTypeLiteralProperties(declaration: TypeLiteralNode): IPropertyListItem[] {
    return [
      {
        declaration,
        props: declaration.getProperties(),
      },
    ];
  }

  getInterfaceHierarchyProperties(declaration: InterfaceDeclaration, type: Type | null = null): IPropertyListItem[] {
    const typeMap = this.buildTypeMap(declaration, type);
    const properties: IPropertyListItem[] = [
      {
        declaration,
        props: declaration.getProperties(),
        typeMap,
      },
    ];

    const baseDeclarations = declaration.getBaseDeclarations();
    const baseTypes = declaration.getBaseTypes();

    const typesHandled = new Set<string>();
    for (const baseType of baseTypes) {
      const matchedDeclaration = baseDeclarations.find(
        (d) => d.getSymbol()?.getName() === baseType.getSymbol()?.getName(),
      );

      if (matchedDeclaration?.getName) {
        const name = matchedDeclaration.getName();
        if (!name) {
          throw new ParseError("Can't handle interface(ish) ancestor without name");
        }

        if (isClass(matchedDeclaration)) {
          properties.push(...this.getClassHierarchyProperties(matchedDeclaration, baseType));
        } else if (isInterface(matchedDeclaration)) {
          properties.push(...this.getInterfaceHierarchyProperties(matchedDeclaration, baseType));
        } else {
          throw new ParseError(`Declaration is of unknown type: ${declaration.getText()}`);
        }

        typesHandled.add(name);
      }
    }

    const remainingTypes = baseTypes.filter((t) => !t.getSymbol() || !typesHandled.has(t.getSymbol()!.getName()));

    for (const baseType of remainingTypes) {
      let typeMap: TypeMap | undefined;
      if (baseType.getTypeArguments().length) {
        const declarationForType = getFirstSymbolDeclaration(baseType);
        if (!isInterface(declarationForType)) {
          throw new ParseError('Blorb');
        }

        typeMap = this.buildTypeMap(declarationForType, baseType);
      }
      const baseTypeProperties = baseType.getProperties();
      const baseTypeDeclarations = baseTypeProperties
        .map((p) => p.getDeclarations()[0])
        .filter(
          (d) => d.getKind() === SyntaxKind.PropertyDeclaration || d.getKind() === SyntaxKind.PropertySignature,
        ) as PropertyDeclaration[];

      /* istanbul ignore if */
      if (baseTypeDeclarations.length !== baseTypeProperties.length) {
        console.log(baseTypeProperties.map((p) => p.getDeclarations()[0].getKindName()));
        throw new ParseError(`Could not resolve all property declarations in ${baseType.getText()}`);
      }

      properties.push({
        declaration: null,
        props: baseTypeDeclarations,
        typeMap,
      });
    }

    const propertiesSeen = new Set<string>();
    const skip = new Set<string>();
    for (const p of properties) {
      for (const prop of p.props) {
        const name = prop.getName();
        if (!propertiesSeen.has(name)) {
          propertiesSeen.add(name);
        } else {
          skip.add(name);
        }
      }
      p.props = p.props.filter((prop) => !skip.has(prop.getName()));
    }

    return properties.reverse();
  }

  getAllProperties(classDeclaration: ClassOrInterfaceOrLiteral | Node): IPropertyListItem[] {
    if (isClass(classDeclaration)) {
      return this.getClassHierarchyProperties(classDeclaration);
    } else if (isInterface(classDeclaration)) {
      return this.getInterfaceHierarchyProperties(classDeclaration);
    } else if (isTypeLiteral(classDeclaration)) {
      return this.getTypeLiteralProperties(classDeclaration);
    } else {
      /* istanbul ignore next */
      throw new ParseError(`Can't get properties for ${classDeclaration.getText()}`);
    }
  }

  buildTypeTree(currentClass: ClassOrInterfaceOrLiteral | null, prop: IMinimalProperty, typeMap?: TypeMap): TypeNode {
    const type = prop.getType();
    const hasQuestionToken = prop.hasQuestionToken?.();

    try {
      return this.walkTypeNodes(type, { hasQuestionToken, typeMap });
    } catch (error) {
      if (isParseError(error)) {
        // Enrich context
        error.message += `\n  ${getName(currentClass)}.${prop.getName()} at ${prop
          .getSourceFile()
          .getFilePath()}:${prop.getStartLineNumber()}`;
        error.context.class = getName(currentClass);
        error.context.property = prop.getName();
      }
      throw error;
    }
  }

  applyDecorators(classDeclaration: ClassDeclaration, propertyKey: string, tree: TypeNode): void {
    const cls = this.classDeclarationToClassReference.get(classDeclaration);

    if (!cls) {
      throw new RuntimeError(`Referenced class '${getName(classDeclaration)}' is not decorated`);
    }

    const decorators = getDecorators(cls.prototype, propertyKey);
    const annotations = getAnnotations(cls.prototype, propertyKey);

    const propertyDecoratorMap = groupDecorators<IValidationDecoratorMeta>(decorators);
    const annotationDecoratorMap = groupDecorators<IAnnotationDecoratorMeta>(annotations);

    walkPropertyTypeTree(tree, (node) => {
      const validatorsForNodeKind = propertyDecoratorMap.get(node.kind) ?? [];

      const decoratorNodes = validatorsForNodeKind.map(
        (decorator) => new DecoratorNode(decorator.name, decorator.type, decorator.validator),
      );
      node.children.push(...decoratorNodes);

      const annotationsForNodeKind = annotationDecoratorMap.get(node.kind) ?? [];
      // Treat note.annotations as a record from here to allow assignment
      // Invalid fields should not be possible due to typechecking
      const nodeAnnotations = node.annotations as Record<string, unknown>;

      for (const annotation of annotationsForNodeKind) {
        nodeAnnotations[annotation.name] = annotation.value;
      }
    });
  }
}
