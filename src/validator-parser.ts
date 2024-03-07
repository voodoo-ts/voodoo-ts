import path from 'path';
import process from 'process';
import {
  ClassDeclaration,
  InterfaceDeclaration,
  Node,
  PropertyDeclaration,
  PropertySignature,
  SyntaxKind,
  Type,
  TypeLiteralNode,
} from 'ts-morph';

import { applyDecorators } from './decorators';
import { ParseError, RuntimeError } from './errors';
import {
  AnyNode,
  ArrayNode,
  BooleanNode,
  ClassNode,
  EnumNode,
  IClassMeta,
  IntersectionNode,
  IPropertyComment,
  ITypeAndTree,
  LiteralNode,
  NumberNode,
  RecordNode,
  RootNode,
  StringNode,
  TupleNode,
  TypeNode,
  UndefinedNode,
  UnionNode,
} from './nodes';
import { Constructor } from './types';
import { zip } from './utils';

export type GetClassTrees = () => ITypeAndTree[];

export type ClassOrInterfaceOrLiteral = ClassDeclaration | InterfaceDeclaration | TypeLiteralNode;

interface IOmitParameters {
  referencedClassDeclaration: ClassOrInterfaceOrLiteral;
  targetType: Type;
  propertyNames: Set<string>;
}

export type PropertyDeclarationOrSignature = PropertyDeclaration | PropertySignature;

export interface IPropertyListItem {
  declaration: ClassOrInterfaceOrLiteral | null;
  props: PropertyDeclarationOrSignature[];
  typeMap?: TypeMap;
}

export interface IResolvedProperty {
  type: Type;
  nullable: boolean;
}

/**
 * Typeguard to ensure a thrown exception is a ParseError
 */
export function isParseError(error: unknown): error is ParseError {
  return error instanceof ParseError;
}

/**
 * Typeguard to ensure obj is a class declaration
 * @param obj - Must be a ts-morph node
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
export function isInterface(obj: Node): obj is InterfaceDeclaration {
  return obj?.getKind && obj.getKind() === SyntaxKind.InterfaceDeclaration;
}

/**
 * Typeguard to ensure obj is an type literal declaration
 * @param obj - Must be a ts-morph node
 * @returns
 */
export function isTypeLiteral(obj: Node): obj is TypeLiteralNode {
  return obj?.getKind && obj.getKind() === SyntaxKind.TypeLiteral;
}

/**
 * Typeguard to ensure obj is class or interface declaration or a literal
 * @param obj -
 * @returns
 */
export function isClassOrInterfaceOrLiteral(obj?: Node): obj is ClassOrInterfaceOrLiteral {
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
export function getName(obj: ClassOrInterfaceOrLiteral | null): string {
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
  if (
    'compilerType' in type &&
    typeof type.compilerType === 'object' &&
    type.compilerType &&
    'id' in type.compilerType &&
    typeof type.compilerType.id === 'number'
  ) {
    return type.compilerType.id;
  }

  throw new ParseError(`Can't get type id for: ${type.getText()}`);
}

export function getFirstSymbolDeclaration(type: Type | Node): ClassOrInterfaceOrLiteral {
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
    /* istanbul ignore next */
    throw new ParseError('Unknown paramter U for Omit<T, U>', {
      asText: stringLiteralOrUnion.getText(),
      keys: stringLiteralOrUnion,
    });
  }

  return { referencedClassDeclaration, propertyNames, targetType };
}

export function getPropertyName(property: PropertyDeclarationOrSignature): string {
  const nameNode = property.getNameNode();
  if (Node.isIdentifier(nameNode)) {
    return property.getName();
  } else if (Node.isComputedPropertyName(nameNode)) {
    const [opening, stringLiteral, closing] = nameNode.getChildren();
    /* istanbul ignore else */
    if (opening && Node.isStringLiteral(stringLiteral) && closing) {
      return stringLiteral.getLiteralValue();
    } else {
      throw new ParseError(`Expected string literal for computed property`);
    }
  } else {
    /* istanbul ignore next */
    throw new ParseError(`Can't handle name node of type ${nameNode.getKindName()}`);
  }
}

export function getDocs(
  node: PropertyDeclarationOrSignature | ClassDeclaration | InterfaceDeclaration,
): IPropertyComment | undefined {
  const structure = node.getStructure();

  if (structure.docs?.length) {
    const [doc] = structure.docs;
    if (typeof doc === 'string') {
      return {
        description: doc,
        tags: [],
      };
    } else {
      return {
        description: doc.description?.toString().trim() ?? '',
        tags:
          doc.tags?.map(({ tagName, text }) => ({ tagName: tagName.toString(), text: text?.toString() ?? '' })) ?? [],
      };
    }
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

  getByKeyWithoutParameters(key: string): T | undefined {
    const { reference } = JSON.parse(key) as { reference: string };
    const keyWithoutParams = JSON.stringify({
      reference,
      parameters: [],
    });
    return this.getByKey(keyWithoutParams);
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

export type TypeMap = Map<string, Type>;

export class PropertyDiscovery {
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

      const props = currentDeclaration.getInstanceProperties().filter((property): property is PropertyDeclaration => {
        return Node.isPropertySignature(property) || Node.isPropertyDeclaration(property);
      });

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

    for (const propertyListEntry of properties) {
      propertyListEntry.props = propertyListEntry.props.filter((property) => {
        return Node.isPropertyDeclaration(property as unknown as Node);
      });
    }

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
      let baseTypeTypeMap: TypeMap | undefined;
      if (baseType.getTypeArguments().length) {
        const declarationForType = getFirstSymbolDeclaration(baseType);
        if (!isInterface(declarationForType)) {
          throw new ParseError(`Type ${baseType.getText()} is not an interface`);
        }

        baseTypeTypeMap = this.buildTypeMap(declarationForType, baseType);
      }
      const baseTypeProperties = baseType.getProperties();
      const baseTypeDeclarations = baseTypeProperties
        .map((p) => p.getDeclarations()[0])
        .filter(
          (d) => d.getKind() === SyntaxKind.PropertyDeclaration || d.getKind() === SyntaxKind.PropertySignature,
        ) as PropertyDeclaration[];

      /* istanbul ignore if */
      if (baseTypeDeclarations.length !== baseTypeProperties.length) {
        throw new ParseError(`Could not resolve all property declarations in ${baseType.getText()}`);
      }

      properties.push({
        declaration: null,
        props: baseTypeDeclarations,
        typeMap: baseTypeTypeMap,
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
}

export class Parser {
  classDeclarationToClassReference = new TypeCache<Constructor<unknown>>();
  propertyDiscovery: PropertyDiscovery;
  classTreeCache = new TypeCache<ITypeAndTree[]>();
  declarationsDiscovered = new Set<string>();
  classNodeCache: Map<ClassDeclaration, ClassNode> = new Map();

  constructor(classDeclarationToClassReference: TypeCache<Constructor<unknown>>) {
    this.classDeclarationToClassReference = classDeclarationToClassReference;
    this.propertyDiscovery = new PropertyDiscovery();
  }

  handleRootNode(property: PropertyDeclarationOrSignature, typeMap?: TypeMap): RootNode {
    const resolvedPropertyType = this.getPropertyType(property);
    let type = resolvedPropertyType.type;
    const nullable = resolvedPropertyType.nullable;
    const hasQuestionToken = Boolean(property.hasQuestionToken?.());
    const hasInitializer = Boolean(property.getStructure().initializer);

    const rootNode = new RootNode(hasQuestionToken || hasInitializer);

    rootNode.annotations.comment = getDocs(property);
    rootNode.annotations.hasInitializer = hasInitializer;

    if (type.isUnion()) {
      const unionTypes = type.getUnionTypes();
      const hasUndefined = unionTypes.find((t) => t.isUndefined());
      const unionTypesWithoutUndefined = unionTypes.filter((unionType) => !unionType.isUndefined());

      if (hasUndefined) {
        rootNode.optional = true;
      }

      if (unionTypesWithoutUndefined.length === 1) {
        // Prevent unnecessary UnionNode
        // return [rootNode, unionTypesWithoutUndefined[0]];
        type = unionTypesWithoutUndefined[0];
      }
    }

    const typeNode = this.walkTypeNodes(type, { typeMap });

    if (typeNode.kind === 'union') {
      typeNode.children = typeNode.children.filter((tn) => tn.kind !== 'undefined');
      if (nullable) {
        typeNode.children.push(new LiteralNode(null));
      }
      rootNode.children = [typeNode];
    } else {
      if (nullable) {
        const unionNode = new UnionNode();
        unionNode.children = [new LiteralNode(null), typeNode];
        rootNode.children = [unionNode];
      } else {
        rootNode.children = [typeNode];
      }
    }

    return rootNode;
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

  walkTypeNodes(type: Type, { typeMap }: { typeMap?: TypeMap } = {}): TypeNode {
    type = this.handleTypeParameter(type, typeMap);

    if (type.isNumber()) {
      return new NumberNode();
    } else if (type.isString()) {
      return new StringNode();
    } else if (type.isBoolean()) {
      return new BooleanNode();
    } else if (type.isNull()) {
      return new LiteralNode(null);
    } else if (type.isUndefined()) {
      return new UndefinedNode();
    } else if (type.isNumberLiteral() || type.isStringLiteral()) {
      return new LiteralNode(type.getLiteralValue());
    } else if (type.isBooleanLiteral()) {
      const expected = type.getText() === 'true';

      return new LiteralNode(expected);
    } else if (type.isAny() || type.isUnknown()) {
      return new AnyNode();
    } else if (type.isEnum()) {
      const name = type.getText();
      const items = type.getUnionTypes().map((t) => t.getLiteralValueOrThrow()) as string[];

      return new EnumNode(name, items);
    } else if (type.isIntersection()) {
      return this.createIntersectionNode(type, typeMap);
    } else if (type.isUnion()) {
      return this.handleUnion(type);
    } else if (type.isArray()) {
      return this.handleArray(type);
    } else if ((type.isInterface() || type.isObject() || type.isClass()) && !type.getAliasSymbol()) {
      if (!type.isTuple()) {
        return this.createClassNode(type);
      } else {
        return this.handleTuple(type);
      }
    } else if (type.getAliasSymbol()) {
      return this.handleAliasSymbols(type);
    } else {
      throw new ParseError(`Syntax not supported: ${type.getText()}`, {
        asText: type.getText(),
        noBranchMatched: true,
      });
    }
  }

  handleArray(type: Type): TypeNode {
    const arrayNode = new ArrayNode();
    arrayNode.children.push(this.walkTypeNodes(type.getArrayElementTypeOrThrow()));
    return arrayNode;
  }

  handleTuple(type: Type): TypeNode {
    const tupleNode = new TupleNode();
    for (const tupleElementType of type.getTypeArguments()) {
      tupleNode.children.push(this.walkTypeNodes(tupleElementType));
    }

    return tupleNode;
  }

  handleUnion(type: Type): TypeNode {
    const unionNode = new UnionNode();
    for (const unionType of type.getUnionTypes()) {
      unionNode.children.push(this.walkTypeNodes(unionType));
    }
    return unionNode;
  }

  handleAliasSymbols(type: Type): TypeNode {
    const name = type.getAliasSymbol()?.getFullyQualifiedName();

    if (name === 'Omit' || name === 'Pick') {
      const { targetType, propertyNames } = getOmitParameters(type);
      const propertyFilter = (tree: ITypeAndTree): boolean =>
        (propertyNames.has(tree.name) && name === 'Pick') || (!propertyNames.has(tree.name) && name === 'Omit');

      const contextProperty = name === 'Pick' ? 'picked' : 'omitted';

      return this.createClassNode(targetType, propertyFilter, {
        [contextProperty]: propertyNames,
      });
    } else if (name === 'Record') {
      const recordNode = new RecordNode();
      const [keyType, valueType] = type.getAliasTypeArguments();
      recordNode.children.push(this.walkTypeNodes(keyType, {}), this.walkTypeNodes(valueType, {}));
      return recordNode;
    } else if (name === 'Partial') {
      const [partialType] = type.getAliasTypeArguments();
      const classNode = this.createClassNode(partialType, () => true, { partial: true });
      return classNode;
    } else {
      throw new ParseError(`Syntax not supported: ${type.getText()}`, {
        asText: type.getText(),
        hasAliasSymbol: true,
      });
    }
  }

  createIntersectionNode(type: Type, typeMap?: TypeMap): IntersectionNode {
    const classNodes = type
      .getIntersectionTypes()
      .map((intersectionType) => this.walkTypeNodes(intersectionType, { typeMap })) as ClassNode[];

    if (classNodes.some((c) => c.kind !== 'class')) {
      throw new ParseError(
        `Intersections can only consist of known classes, interface and/or objects. Type: ${type.getText()}`,
      );
    }

    const references = classNodes.map((c) => c.meta.reference);

    const intersectionNode = new IntersectionNode(type.getText(), references);

    intersectionNode.children.push(...classNodes);
    return intersectionNode;
  }

  createClassNode(
    type: Type,
    filter: (t: ITypeAndTree) => boolean = () => true,
    meta: Omit<IClassMeta, 'from' | 'reference'> = {},
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

    const typeSignature = this.getTypeSignature(referencedDeclaration, type);

    if (!this.declarationsDiscovered.has(typeSignature)) {
      this.declarationsDiscovered.add(typeSignature);
      // Discover embedded interfaces / objects in references declaration, but only once
      getClassTrees();
    }

    const from =
      {
        [SyntaxKind.ClassDeclaration]: 'class' as const,
        [SyntaxKind.InterfaceDeclaration]: 'interface' as const,
        [SyntaxKind.TypeLiteral]: 'object' as const,
      }[referencedDeclaration.getKind() as number] ?? ('unknown' as const);

    const classNode = new ClassNode(
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

    if (isClass(referencedDeclaration) || isInterface(referencedDeclaration)) {
      classNode.annotations.comment = getDocs(referencedDeclaration);
    }

    return classNode;
  }

  getTypeSignature(declaration: ClassOrInterfaceOrLiteral, type: Type): string {
    return TypeCache.getKey(declaration, type.getTypeArguments().map(getTypeId));
  }

  /**
   * This loops through all direct and indirect properties of `cls` and outputs them in the internal
   * TypeNode tree format
   *
   * @param classDeclaration - A ts-morph class declaration whose members will be processed
   * @param typeMap - Maps the type parameter name to the type it represents
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

    for (const { declaration, props: properties, typeMap: defaultTypeMap } of this.propertyDiscovery.getAllProperties(
      classDeclaration,
    )) {
      for (const property of properties) {
        const mergedTypeMap: TypeMap = new Map(defaultTypeMap);
        for (const [k, v] of typeMap?.entries() ?? []) {
          if (mergedTypeMap.has(k)) {
            throw new ParseError('Duplicate type in typemap');
          }
          mergedTypeMap.set(k, v);
        }

        try {
          const name = getPropertyName(property);
          const tree = this.buildTypeTree(declaration, property, mergedTypeMap);
          if (declaration && isClass(declaration)) {
            this.applyDecorators(declaration, name, tree);
          }
          trees.push({
            name,
            tree,
          });
        } catch (error) {
          if (isParseError(error)) {
            // Enrich context
            error.message += `\n  ${getName(declaration)}.${property.getName()} at ${property
              .getSourceFile()
              .getFilePath()}:${property.getStartLineNumber()}`;
            error.context.class = getName(declaration);
            error.context.property = property.getName();
          }
          throw error;
        }
      }
    }

    this.classTreeCache.set(classDeclaration, types, trees);

    return trees;
  }

  getCachedClassNode(classDeclaration: ClassDeclaration): ClassNode {
    const cached = this.classNodeCache.get(classDeclaration);
    if (!cached) {
      const classNode = this.getClassNode(classDeclaration);
      this.classNodeCache.set(classDeclaration, classNode);
      return classNode;
    } else {
      return cached;
    }
  }

  getClassNode(classDeclaration: ClassOrInterfaceOrLiteral): ClassNode {
    const trees = this.getPropertyTypeTrees(classDeclaration);
    const classNode = new ClassNode(
      {
        name: getName(classDeclaration),
        meta: {
          from: 'class',
          reference: TypeCache.getKey(classDeclaration, []),
        },
      },
      () => trees,
    );

    if (isClass(classDeclaration) || isInterface(classDeclaration)) {
      classNode.annotations.comment = getDocs(classDeclaration);
    }

    return classNode;
  }

  getPropertyType(property: PropertyDeclarationOrSignature): IResolvedProperty {
    return { type: property.getType(), nullable: false };
  }

  buildTypeTree(
    currentClass: ClassOrInterfaceOrLiteral | null,
    property: PropertyDeclarationOrSignature,
    typeMap?: TypeMap,
  ): RootNode {
    return this.handleRootNode(property, typeMap);
  }

  applyDecorators(classDeclaration: ClassDeclaration, propertyKey: string, tree: RootNode): void {
    const cls = this.classDeclarationToClassReference.get(classDeclaration, []);

    if (!cls) {
      throw new RuntimeError(`Referenced class '${getName(classDeclaration)}' is not decorated`);
    }

    applyDecorators(cls, propertyKey, tree);
  }
}
