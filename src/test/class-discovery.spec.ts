/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { ClassDeclaration } from 'ts-morph';

import { ClassDiscovery } from '../class-discovery';
import { ClassNotFoundError } from '../errors';
import { Constructor } from '../types';
import {
  LINE_NUMBER_MULTI_DECORATOR_CLASS,
  LINE_NUMBER_DECORATED_CLASS,
  LINE_NUMBER_UNDECORATED_CLASS,
  MultiDecoratorClass,
  DecoratedClass,
  UndecoratedClass,
} from './class-discovery.fixture';
import { project } from './utils';

const FIXTURE_FILENAME = 'src/test/class-discovery.fixture.ts';
const COLUMN = 2;

describe('class-discovery', () => {
  it('should be able to discover classes without decorator', () => {
    const classDiscovery = new ClassDiscovery(project);
    const classDeclaration = classDiscovery.getClass(
      UndecoratedClass.name,
      FIXTURE_FILENAME,
      LINE_NUMBER_UNDECORATED_CLASS,
      COLUMN,
    );

    expect(classDeclaration).toBeInstanceOf(ClassDeclaration);
  });

  it('should be able to discover classes with a single decorator', () => {
    const classDiscovery = new ClassDiscovery(project);
    const classDeclaration = classDiscovery.getClass(
      DecoratedClass.name,
      FIXTURE_FILENAME,
      LINE_NUMBER_DECORATED_CLASS,
      COLUMN,
    );

    expect(classDeclaration).toBeInstanceOf(ClassDeclaration);
  });

  it('should have cached the lookup after discovery', () => {
    const classDiscovery = new ClassDiscovery(project);

    classDiscovery.getClass(DecoratedClass.name, FIXTURE_FILENAME, LINE_NUMBER_DECORATED_CLASS, COLUMN);

    const cacheEntries = Object.fromEntries(classDiscovery.classCache.entries());
    expect(cacheEntries).toEqual({
      [`${LINE_NUMBER_DECORATED_CLASS}:${COLUMN}:${FIXTURE_FILENAME}`]: expect.any(
        ClassDeclaration as unknown as Constructor<unknown>,
      ),
    });
  });

  it('should use the cached version', () => {
    const classDiscovery = new ClassDiscovery(project);
    const spy = jest.spyOn(classDiscovery.classCache, 'get');

    const classDeclaration = classDiscovery.getClass(
      DecoratedClass.name,
      FIXTURE_FILENAME,
      LINE_NUMBER_DECORATED_CLASS,
      COLUMN,
    );
    classDiscovery.getClass(DecoratedClass.name, FIXTURE_FILENAME, LINE_NUMBER_DECORATED_CLASS, COLUMN);

    expect(spy).toBeCalledTimes(2);
    expect(spy).toReturnWith(classDeclaration);
  });

  it('should be able to discover classes with multiple decorators', () => {
    const classDiscovery = new ClassDiscovery(project);
    const classDeclaration = classDiscovery.getClass(
      MultiDecoratorClass.name,
      FIXTURE_FILENAME,
      LINE_NUMBER_MULTI_DECORATOR_CLASS,
      COLUMN,
    );

    expect(classDeclaration).toBeTruthy();
  });

  it('should throw if class can not be found', () => {
    const classDiscovery = new ClassDiscovery(project);
    const classDeclaration = () => classDiscovery.getClass(DecoratedClass.name, FIXTURE_FILENAME, 1, COLUMN);
    expect(classDeclaration).toThrow(ClassNotFoundError);
  });
});
