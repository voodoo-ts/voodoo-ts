import { ParseError } from '../../errors';
import { ClassNode, RootNode } from '../../nodes';
import { ValidatorInstance } from '../../validator';
import {
  BooleanNodeFixture,
  ClassNodeFixture,
  NumberNodeFixture,
  RootNodeFixture,
  StringNodeFixture,
} from '../fixtures';
import { getLineNumber, project } from '../utils';

describe('generics', () => {
  const v = new ValidatorInstance({ project });

  @v.transformerDecorator()
  class Test {
    genericProperty1!: Generic<string, number, boolean>;
    genericProperty2!: Generic<string, Embedded, boolean>;
    genericProperty3!: Pick<Generic<string, number>, 'property1'>;
    genericProperty4!: Generic<Generic<string, string, string>, string, string>;
    genericProperty5!: Generic<string, number>;
  }

  @v.transformerDecorator()
  class Embedded {
    embeddedProperty!: string;
  }

  const LINE_NUMBER_GENERIC_CLASS = getLineNumber();
  @v.transformerDecorator()
  class Generic<T, U, V = unknown> {
    property1!: T;
    property2!: U;
    property3!: V;
  }

  interface ITest {
    property1: string;
  }

  @v.transformerDecorator()
  class TestExtending extends Generic<string, number, boolean> implements ITest {}

  it('should have cached all variants of `Generic`', () => {
    v.validate(Test, {});

    const trees = Array.from(v.parser.classTreeCache.map.entries())
      .map(([k]) => JSON.parse(k))
      .filter((r) => r.reference.startsWith(`${LINE_NUMBER_GENERIC_CLASS}:`));

    expect(trees.length).toEqual(5);
    expect(trees.map((t) => t.parameters.length)).toEqual([3, 3, 3, 3, 3]);
  });

  describe('should construct the correct tree for Test.genericProperty1', () => {
    const { tree } = v.getPropertyTypeTreesFromConstructor(Test)[0];

    it('root', () => {
      expect(tree).toEqual(
        RootNodeFixture.createRequired({
          children: [ClassNodeFixture.create('Generic', { from: 'class', reference: expect.any(String) })],
        }),
      );
    });

    it('subtrees', () => {
      const [property1Tree, property2Tree, property3Tree] = ((tree as RootNode).children[0] as ClassNode)
        .getClassTrees()
        .map((tt) => tt.tree);

      expect(property1Tree).toEqual(
        RootNodeFixture.createRequired({
          children: [StringNodeFixture.create()],
        }),
      );
      expect(property2Tree).toEqual(
        RootNodeFixture.createRequired({
          children: [NumberNodeFixture.create()],
        }),
      );
      expect(property3Tree).toEqual(
        RootNodeFixture.createRequired({
          children: [BooleanNodeFixture.create()],
        }),
      );
    });
  });

  it('should construct the correct tree for extending classes', () => {
    const trees = v.getPropertyTypeTreesFromConstructor(TestExtending);

    expect(trees).toEqual([
      {
        name: 'property1',
        tree: RootNodeFixture.createRequired({
          children: [StringNodeFixture.create()],
        }),
      },
      {
        name: 'property2',
        tree: RootNodeFixture.createRequired({
          children: [NumberNodeFixture.create()],
        }),
      },
      {
        name: 'property3',
        tree: RootNodeFixture.createRequired({
          children: [BooleanNodeFixture.create()],
        }),
      },
    ]);
  });

  it('should validate', () => {
    const result = v.validate(Test, {
      genericProperty1: {
        property1: '',
        property2: 0,
        property3: true,
      },
      genericProperty2: {
        property1: '',
        property2: { embeddedProperty: 'test' },
        property3: true,
      },
      genericProperty3: {
        property1: 'string',
      },
      genericProperty4: {
        property1: {
          property1: '1',
          property2: '2',
          property3: '3',
        },
        property2: '2',
        property3: '3',
      },
      genericProperty5: {
        property1: '1',
        property2: 1,
        property3: null,
      },
    });

    expect(result.success).toEqual(true);
  });

  it('should not validate generic classes', () => {
    expect(() => v.validate(Generic, { property1: 1, property2: 2, property3: 3 })).toThrowError(ParseError);
  });
});
