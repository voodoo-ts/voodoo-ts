import { ClassDeclaration, Node, Project } from 'ts-morph';

import { ClassNotFoundError } from './errors';
import { isClass } from './parser';

export class ClassDiscovery {
  project: Project;
  classCache = new Map<string, ClassDeclaration>(); // TODO: Better name

  constructor(project: Project) {
    this.project = project;
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
   * @param filename Filename of the file the class should be searched
   * @param className String representation of the className
   * @param line The line where the @Decorator() call occurred
   * @returns
   */
  getClass(className: string, filename: string, line: number): ClassDeclaration {
    const cacheKey = `${line}:${filename}`;
    const cached = this.classCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const sourceFile = this.project.getSourceFileOrThrow(filename);

    const walkSyntaxNodes = (node: Node, level = 0): ClassDeclaration | null => {
      for (const childNode of node.getChildren()) {
        if (isClass(childNode)) {
          const cls = childNode;

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
        const cls = walkSyntaxNodes(childNode, level + 1);
        if (cls) {
          return cls;
        }
      }
      return null;
    };

    const cls = walkSyntaxNodes(sourceFile);

    if (!cls) {
      throw new ClassNotFoundError(`Class not found: ${className}`);
    }

    this.classCache.set(cacheKey, cls);

    return cls;
  }
}
