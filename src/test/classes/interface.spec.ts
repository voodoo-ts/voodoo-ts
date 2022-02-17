import { ClassNode } from '../../nodes';
import { IValidatorClassMeta, ValidatorInstance, validatorMetadataKey } from '../../validator';
import { project } from '../utils';

describe('interface', () => {
  const v = new ValidatorInstance({ project });

  interface ITest {
    test: number;
  }

  interface ITest2 extends ITest {
    stringProperty: string;
  }

  @v.validatorDecorator()
  class Test {
    embedded!: ITest;
    embedded1!: ITest;
    embedded2!: ITest2;
    embedded3!: {
      inlineNumberProperty: number;
    };
  }

  it('should construct the correct tree for interfaces', () => {
    const validatorMeta = Reflect.getMetadata(validatorMetadataKey, Test) as IValidatorClassMeta;
    const classDeclaration = v.classDiscovery.getClass(Test.name, validatorMeta.filename, validatorMeta.line);
    const trees = v.getPropertyTypeTrees(Test, classDeclaration);
    const { name, tree } = trees[0];

    expect(name).toEqual('embedded');
    expect(tree).toEqual({
      kind: 'root',
      optional: false,
      children: [
        {
          kind: 'class',
          name: 'ITest',
          getClassTrees: expect.any(Function),
          meta: { from: 'interface' },
          children: [],
        },
      ],
    });
  });

  it('should construct the correct trees for extending interfaces', () => {
    const validatorMeta = Reflect.getMetadata(validatorMetadataKey, Test) as IValidatorClassMeta;
    const classDeclaration = v.classDiscovery.getClass(Test.name, validatorMeta.filename, validatorMeta.line);
    const trees = v.getPropertyTypeTrees(Test, classDeclaration);
    const { name, tree } = trees[2];

    expect(name).toEqual('embedded2');
    expect(tree).toEqual({
      kind: 'root',
      optional: false,
      children: [
        {
          kind: 'class',
          name: 'ITest2',
          getClassTrees: expect.any(Function),
          meta: {
            from: 'interface',
          },
          children: [],
        },
      ],
    });

    expect((tree.children[0] as ClassNode).getClassTrees()).toEqual([
      {
        name: 'test',
        tree: {
          kind: 'root',
          optional: false,
          children: [
            {
              kind: 'number',
              reason: expect.anything(),
              children: [],
            },
          ],
        },
      },
      {
        name: 'stringProperty',
        tree: {
          kind: 'root',
          optional: false,
          children: [
            {
              kind: 'string',
              reason: expect.anything(),
              children: [],
            },
          ],
        },
      },
    ]);
  });

  it('should construct the correct trees for object literals', () => {
    const validatorMeta = Reflect.getMetadata(validatorMetadataKey, Test) as IValidatorClassMeta;
    const classDeclaration = v.classDiscovery.getClass(Test.name, validatorMeta.filename, validatorMeta.line);
    const trees = v.getPropertyTypeTrees(Test, classDeclaration);
    const { name, tree } = trees[3];

    expect(name).toEqual('embedded3');

    expect(tree).toEqual({
      kind: 'root',
      optional: false,
      children: [
        {
          kind: 'class',
          name: expect.stringMatching(/.*\/.+?\.spec\.(ts|js):\d+$/),
          getClassTrees: expect.any(Function),
          meta: { from: 'object' },
          children: [],
        },
      ],
    });
  });

  it('should validate', () => {
    const result = v.validate(Test, {
      embedded: { test: 1 },
      embedded1: { test: 2 },
      embedded2: { test: 3, stringProperty: 'test' },
      embedded3: { inlineNumberProperty: 234 },
    });

    expect(result.success).toEqual(true);
  });
});
