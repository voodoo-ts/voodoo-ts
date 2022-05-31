import { ParseError } from '../../errors';
import { TypeNodeData } from '../../nodes';
import { ValidatorInstance } from '../../validator';
import { getLineNumber, project } from '../utils';

describe('generics', () => {
  const v = new ValidatorInstance({ project });

  @v.validatorDecorator()
  class Test {
    genericProperty!: Generic<string, number, boolean>;
    genericProperty2!: Generic<string, Embedded, boolean>;
    genericProperty3!: Pick<Generic<string, number>, 'property1'>;
    genericProperty4!: Generic<Generic<string, string, string>, string, string>;
  }

  @v.validatorDecorator()
  class Embedded {
    embeddedProperty!: string;
  }

  const LINE_NUMBER_GENERIC_CLASS = getLineNumber();
  @v.validatorDecorator()
  class Generic<T, U, V = unknown> {
    property1!: T;
    property2!: U;
    property3!: V;
  }

  interface ITest {
    property1: string;
  }

  @v.validatorDecorator()
  class TestExtending extends Generic<string, number, boolean> implements ITest {}

  it('should have cached all variants of `Generic`', () => {
    v.validate(Test, {});

    const trees = Array.from(v.parser.classTreeCache.map.entries()).filter(([k, v]) =>
      JSON.parse(k).reference.startsWith(`${LINE_NUMBER_GENERIC_CLASS}:`),
    );

    expect(trees.length).toEqual(5);
  });

  it('should construct the correct tree', () => {
    const { tree } = v.getPropertyTypeTreesFromConstructor(Test)[0];

    expect(tree).toEqual({
      kind: 'root',
      optional: false,
      children: [
        {
          kind: 'class',
          name: 'Generic',
          children: [],
          annotations: {},
          meta: {
            from: 'class',
            reference: expect.any(String),
          },
          getClassTrees: expect.any(Function),
        },
      ],
      annotations: {},
    } as TypeNodeData);
  });

  it('should construct the correct tree for extending classes', () => {
    const trees = v.getPropertyTypeTreesFromConstructor(TestExtending);

    expect(trees).toEqual([
      {
        name: 'property1',
        tree: {
          kind: 'root',
          optional: false,
          children: [
            {
              kind: 'string',
              reason: expect.anything(),
              children: [],
              annotations: {},
            },
          ],
          annotations: {},
        } as TypeNodeData,
      },
      {
        name: 'property2',
        tree: {
          kind: 'root',
          optional: false,
          children: [
            {
              kind: 'number',
              reason: expect.anything(),
              children: [],
              annotations: {},
            },
          ],
          annotations: {},
        } as TypeNodeData,
      },
      {
        name: 'property3',
        tree: {
          kind: 'root',
          optional: false,
          children: [
            {
              kind: 'boolean',
              reason: expect.anything(),
              children: [],
              annotations: {},
            },
          ],
          annotations: {},
        } as TypeNodeData,
      },
    ]);
    // expect(tree).toEqual({
    //   kind: 'root',
    //   optional: false,
    //   children: [
    //     {
    //       kind: 'class',
    //       name: 'Generic',
    //       children: [],
    //       annotations: {},
    //       meta: {
    //         from: 'class',
    //         reference: expect.any(String),
    //       },
    //       getClassTrees: expect.any(Function),
    //     },
    //   ],
    //   annotations: {},
    // } as TypeNodeData);
  });

  it('should validate', () => {
    const result = v.validate(Test, {
      genericProperty: {
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
    });

    expect(result.success).toEqual(true);
  });

  it('should not validate generic classes', () => {
    expect(() => v.validate(Generic, { property1: 1, property2: 2, property3: 3 })).toThrowError(ParseError);
  });
});
