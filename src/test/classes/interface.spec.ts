import { ClassNode, TypeNode } from '../../nodes';
import { ValidatorInstance } from '../../validator';
import { ClassNodeFixture, NumberNodeFixture, RootNodeFixture, StringNodeFixture } from '../fixtures';
import { project } from '../utils';

/**
 * Asserts that n is a `ClassNode` using expect
 * @param node - The TypeNode to assert
 */
function assertClassTree(node: TypeNode): asserts node is ClassNode {
  expect(node.kind).toEqual('class');
}

describe('interface', () => {
  const v = new ValidatorInstance({ project });

  interface ITest {
    test: number;
  }

  interface ITest2 extends ITest {
    stringProperty: string;
  }

  type Combined = ITest & { objectProperty: number };
  type PickedAndCombined = Pick<Combined, 'objectProperty'> & { someOtherObjectProperty: number };

  interface ITest3 extends Combined {
    test3Property: string;
  }

  interface IGeneric<T> {
    genericProperty: T;
  }

  interface ITest4 extends ITest, ITest2 {}

  interface ITest5 extends Pick<ITest, 'test'> {
    test5property: string;
  }

  interface ITest6 extends PickedAndCombined {
    test6property: string;
  }

  interface ITest7 extends IGeneric<number> {
    test7property: string;
  }

  interface IGeneric3<T> {
    genericProperty3: T;
  }

  interface IGeneric2<T> extends IGeneric3<'generic3'> {
    genericProperty2: T;
  }

  interface ITest8 extends IGeneric2<'generic2'> {
    test8property: string;
  }

  @v.validatorDecorator()
  class CTestBase<T> {
    baseProperty!: T;
  }

  @v.validatorDecorator()
  class CTest<T> extends CTestBase<number> {
    classProperty!: T;
  }

  interface ITest9 extends CTest<'test9'> {
    test9property: string;
  }

  @v.validatorDecorator()
  class Test {
    embedded!: ITest;
    embedded1!: ITest;
    embedded2!: ITest2;
    embedded3!: {
      inlineNumberProperty: number;
    };
    embedded4!: ITest3;
    embedded5!: ITest4;
    embedded6!: ITest5;
    embedded7!: ITest6;
    embedded8!: ITest7;
    embedded9!: ITest8;
    embedded10!: ITest9;
    embedded11!: IGeneric<number>;
  }

  it('should construct the correct tree for interfaces', () => {
    const trees = v.getPropertyTypeTreesFromConstructor(Test);
    const { name, tree } = trees[0];

    expect(name).toEqual('embedded');
    expect(tree).toEqual(
      RootNodeFixture.createRequired({
        children: [ClassNodeFixture.create('ITest', { from: 'interface' })],
      }),
    );
  });

  it('should construct the correct trees for extending interfaces', () => {
    const trees = v.getPropertyTypeTreesFromConstructor(Test);
    const { name, tree } = trees[2];

    expect(name).toEqual('embedded2');
    expect(tree).toEqual(
      RootNodeFixture.createRequired({
        children: [ClassNodeFixture.create('ITest2', { from: 'interface' })],
      }),
    );

    expect((tree.children[0] as ClassNode).getClassTrees()).toEqual([
      {
        name: 'test',
        tree: RootNodeFixture.createRequired({
          children: [NumberNodeFixture.create()],
        }),
      },
      {
        name: 'stringProperty',
        tree: RootNodeFixture.createRequired({
          children: [StringNodeFixture.create()],
        }),
      },
    ]);
  });

  it('should construct the correct trees for object literals', () => {
    const trees = v.getPropertyTypeTreesFromConstructor(Test);
    const { name, tree } = trees[3];

    expect(name).toEqual('embedded3');
    expect(tree).toEqual(
      RootNodeFixture.createRequired({
        children: [
          ClassNodeFixture.create(
            Test.name,
            { from: 'object' },
            { name: expect.stringMatching(/.*\/.+?\.spec\.(ts|js):\d+$/) },
          ),
        ],
      }),
    );
  });

  it('should construct the correct trees for interfaces extending an intersection', () => {
    const trees = v.getPropertyTypeTreesFromConstructor(Test);
    const { name, tree } = trees[4];

    expect(name).toEqual('embedded4');

    expect(tree).toEqual(
      RootNodeFixture.createRequired({
        children: [
          ClassNodeFixture.create('ITest3', {
            reference: expect.any(String),
            from: 'interface',
          }),
        ],
      }),
    );

    assertClassTree(tree.children[0]);
    const interfaceTrees = tree.children[0].getClassTrees();

    expect(interfaceTrees.length).toEqual(3);
    expect(interfaceTrees).toEqual([
      {
        name: 'test',
        tree: RootNodeFixture.createRequired({
          children: [NumberNodeFixture.create()],
        }),
      },
      {
        name: 'objectProperty',
        tree: RootNodeFixture.createRequired({
          children: [NumberNodeFixture.create()],
        }),
      },
      {
        name: 'test3Property',
        tree: RootNodeFixture.createRequired({
          children: [StringNodeFixture.create()],
        }),
      },
    ]);
  });

  it('should construct the correct trees for interfaces with multiple parents', () => {
    const trees = v.getPropertyTypeTreesFromConstructor(Test);
    const { name, tree } = trees[5];

    expect(name).toEqual('embedded5');

    assertClassTree(tree.children[0]);
    const interfaceTrees = tree.children[0].getClassTrees();

    expect(interfaceTrees.length).toEqual(2);

    expect(new Set<string>(interfaceTrees.map((t) => t.name))).toEqual(new Set<string>(['test', 'stringProperty']));
  });

  it('should construct the correct trees for interfaces extending an picked interface', () => {
    const trees = v.getPropertyTypeTreesFromConstructor(Test);
    const { name, tree } = trees[6];

    expect(name).toEqual('embedded6');

    assertClassTree(tree.children[0]);
    const interfaceTrees = tree.children[0].getClassTrees();

    expect(interfaceTrees.length).toEqual(2);
    expect(new Set<string>(interfaceTrees.map((t) => t.name))).toEqual(new Set<string>(['test', 'test5property']));
  });

  it('should construct the correct trees for interfaces extending an intersection', () => {
    const trees = v.getPropertyTypeTreesFromConstructor(Test);
    const { name, tree } = trees[7];

    expect(name).toEqual('embedded7');

    assertClassTree(tree.children[0]);
    const interfaceTrees = tree.children[0].getClassTrees();

    expect(interfaceTrees.length).toEqual(3);
    expect(new Set<string>(interfaceTrees.map((t) => t.name))).toEqual(
      new Set<string>(['test6property', 'objectProperty', 'someOtherObjectProperty']),
    );
  });

  it('should construct the correct trees for interfaces that extend generic interfaces', () => {
    const trees = v.getPropertyTypeTreesFromConstructor(Test);
    const { name, tree } = trees[8];

    expect(name).toEqual('embedded8');

    assertClassTree(tree.children[0]);
    const interfaceTrees = tree.children[0].getClassTrees();

    expect(interfaceTrees.length).toEqual(2);
    expect(new Set<string>(interfaceTrees.map((t) => t.name))).toEqual(
      new Set<string>(['test7property', 'genericProperty']),
    );
  });

  it('should construct the correct trees for interfaces that extend generic interfaces²', () => {
    const trees = v.getPropertyTypeTreesFromConstructor(Test);
    const { name, tree } = trees[9];

    expect(name).toEqual('embedded9');

    assertClassTree(tree.children[0]);
    const interfaceTrees = tree.children[0].getClassTrees();

    expect(interfaceTrees.length).toEqual(3);
    expect(new Set<string>(interfaceTrees.map((t) => t.name))).toEqual(
      new Set<string>(['test8property', 'genericProperty2', 'genericProperty3']),
    );
  });

  it('should construct the correct trees for interfaces that extend class hierarchies', () => {
    const trees = v.getPropertyTypeTreesFromConstructor(Test);
    const { name, tree } = trees[10];

    expect(name).toEqual('embedded10');

    assertClassTree(tree.children[0]);
    const interfaceTrees = tree.children[0].getClassTrees();

    expect(interfaceTrees.length).toEqual(3);
    expect(new Set<string>(interfaceTrees.map((t) => t.name))).toEqual(
      new Set<string>(['test9property', 'classProperty', 'baseProperty']),
    );
  });

  it('should construct the correct trees for generic interfaces', () => {
    const trees = v.getPropertyTypeTreesFromConstructor(Test);
    const { name, tree } = trees[11];

    expect(name).toEqual('embedded11');

    assertClassTree(tree.children[0]);
    const interfaceTrees = tree.children[0].getClassTrees();

    expect(interfaceTrees.length).toEqual(1);
  });

  it('should validate', () => {
    const result = v.validate(Test, {
      embedded: { test: 1 },
      embedded1: { test: 2 },
      embedded2: { test: 3, stringProperty: 'test' },
      embedded3: { inlineNumberProperty: 234 },
      embedded4: { test3Property: 'test3', objectProperty: 1, test: 1 },
      embedded5: { test: 1, stringProperty: '123' },
      embedded6: { test5property: 'test5', test: 1 },
      embedded7: { test6property: 'test6', objectProperty: 123, someOtherObjectProperty: 123 },
      embedded8: { test7property: 'test7', genericProperty: 123 },
      embedded9: { test8property: 'test8', genericProperty2: 'generic2', genericProperty3: 'generic3' },
      embedded10: { test9property: 'test9', classProperty: 'test9', baseProperty: 9001 },
      embedded11: { genericProperty: 42 },
    });

    expect(result.success).toEqual(true);
  });
});
