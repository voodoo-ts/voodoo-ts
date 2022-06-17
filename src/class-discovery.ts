import { ClassDeclaration, Project, SyntaxKind } from 'ts-morph';

import { ClassNotFoundError } from './errors';
import { isClass } from './parser';

export class ClassDiscovery {
  project: Project;
  classCache = new Map<string, ClassDeclaration>();

  /**
   * Maps the incoming decorator function position (line + column from the decorator's stack trace) to the
   * starting position the found classDeclaration has. This is needed to find cached validation trees after
   * deserialization.
   */
  decoratorPositionToClassPosition = new Map<number, number>();

  constructor(project: Project) {
    this.project = project;
  }

  /**
   * This method tries to find a class based on the className, filename, line and column where the @Validator() call occured.
   *
   * This constructs a position in the source file based on `line` and `column` and retrieves the syntax node at this
   * position. Since `line` and `column` refer to the decorator's call site, we'll receive the identifier of the decorator.
   * Starting from there we walk upwards until we find the containing `classDeclaration`.
   *
   * @param className - String representation of the className
   * @param filename - Filename of the file the class should be searched
   * @param line - The line where the `@Decorator()` call occurred
   * @param column - The column where the `@Decorator()` call occured. Points to `Decorator` (@ not included)
   * @returns The found class declaration or throws
   */
  getClass(className: string, filename: string, line: number, column: number): ClassDeclaration {
    const cacheKey = `${line}:${column}:${filename}`;
    const cached = this.classCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const sourceFile = this.project.getSourceFileOrThrow(filename);

    const pos = sourceFile.compilerNode.getPositionOfLineAndCharacter(line - 1, column - 1);
    const decoratorCallSite = sourceFile.getDescendantAtPos(pos);
    const cls = decoratorCallSite?.getParentWhile((parent, child) => {
      return child.getKind() !== SyntaxKind.ClassDeclaration;
    });

    if (!cls || !isClass(cls)) {
      throw new ClassNotFoundError(`Class not found: ${className}`);
    }

    this.decoratorPositionToClassPosition.set(pos, cls.getPos());
    this.classCache.set(cacheKey, cls);

    return cls;
  }
}
