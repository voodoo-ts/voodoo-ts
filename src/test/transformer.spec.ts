import { ClassDiscovery } from '../class-discovery';
import { TransformerInstance } from '../transformer';
import {
  IGetTransformerContext,
  AbstractValueTransformerFactory,
  registry,
  Transform,
  Transformed,
  TransformerParser,
  defaultFactory,
  TransformerFunction,
} from '../transformer-parser';
import { Constructor } from '../types';
import { ClassCache } from '../validator-parser';
import { getLineNumber, project } from './utils';

class Nested {
  nestedStringToNumber!: Transformed<string, number>;
}

// @registry.decorate<Transformed<string, DateTime, never>>()
// class StringToDateTimeValueTransformer extends AbstractValueTransformerFactory {
//   getTransformer(ctx: IGetTransformerContext): TransformationNodeBase<unknown, unknown, unknown> {
//     return new TransformationNode(
//       [
//         (value: string) => {
//           console.log({ value, date: DateTime.fromISO(value) });
//           return DateTime.fromISO(value);
//         },
//       ],
//       { name: 'datetime' },
//     );
//   }
// }

// @registry.decorate<Transformed<string | null, number | null, never>>()
// class X extends AbstractValueTransformerFactory {
//   getTransformer(ctx: IGetTransformerContext): TransformationNodeBase<unknown, unknown, unknown> {
//     return new TransformationNode(
//       [
//         (value: string | null) => {
//           return 0;
//         },
//       ],
//       { name: 'xyz' },
//     );
//   }
// }

type StringToNumber<Options extends { radix?: number }> = Transformed<string, number, Options>;
interface ISTONOPT {
  radix?: number;
}
type StringToNumberOptions<T extends ISTONOPT> = T;

@registry.decorate<StringToNumber<never>>()
class TestStringToNumberalueTransformer extends AbstractValueTransformerFactory {
  getTransformer(ctx: IGetTransformerContext): TransformerFunction<string, number> {
    console.log(ctx);
    return ({ value }) => {
      return 123;
    };
  }
}

const LINE = getLineNumber();
class Test {
  blorb!: StringToNumber<{ radix: 10 }>;
  str!: string;

  stringToNumber!: Transformed<string, number, { radix: 16 }>;
  // stn2: Transformed<string, number> | undefined;
  // rr: Record<string, Transformed<string, number>>;
  // rr: Transformed<Record<string, string>, Record<string, number>;
  // specialStringToNumber1!: Transformed<string, number, StringToNumberOptions<{ radix: 16 }>>;

  // // specialStringToNumber2!: StringToNumber<{ radix: 16 }>;

  // stringToBool!: Transformed<string, boolean>;

  @Transform<string>(({ value }) => value.split(','))
  stringToList!: Transformed<string, string[]>;
  // // nested!: NestedTransformer<Nested>;

  // stringToDateTime!: Transformed<string, DateTime>;

  // t1!: Transformed<string | null, number | null>;
  // t2!: Transformed<null | string, number | null>;
}

describe('transformer', () => {
  it('shoud', async () => {
    const cd = new ClassDiscovery(project);
    const cc = new ClassCache<Constructor<any>>();
    const dclr = cd.getClass('Test', 'src/test/transformer.spec.ts', LINE, 0);
    cc.set(dclr, Test);
    // const p = new TransformerValidatorParser(cc);
    // const pn = p.getClassNode(dclr);
    // console.log(pn);

    const tp = TransformerParser.default(cc, cd, defaultFactory, [
      /*new X(), new StringToDateTimeValueTransformer()*/
      new TestStringToNumberalueTransformer(),
    ]);
    const tree = tp.getPropertyTypeTrees(dclr);

    console.log(JSON.stringify(tree));

    const x = await tp.transform(dclr, {
      blorb: '44',
      str: 'str',
      stringToNumber: '9001',
      stringToList: '1,2,3',
    });

    console.log(x);
    // const n = tp.getTransformerNode(dclr);
    // console.log(n);
    // const result = await n.transform({
    //   str: '123',
    //   stringToNumber: '9001',
    //   specialStringToNumber1: '0xFF',
    //   stringToList: '1,9001',
    //   stringToBool: 'true',
    //   stringToDateTime: '2022-08-15T12:34:56Z',
    //   t1: null,
    //   t2: null,
    // });
    // console.log(result);
    // console.log(JSON.stringify(result, null, 2));
    // const x = tp.parse(dclr);
    // console.debug(x);
    // console.log(JSON.stringify(x, null, 2));
    // cd.classCache.set()
    // const cn = p.getClassNode(dclr);
    // console.log(cn);
  });

  it('should', () => {
    const inst = new TransformerInstance({ project });
  });
});

describe('transformer', () => {
  it('shoud', async () => {
    const t = new TransformerInstance({ project });

    interface IInterface {
      interfaceProperty: number;
    }

    interface IOtherInterface {
      otherInterfaceProperty: number;
    }

    @t.transformerDecorator()
    class TestEmbed {
      // @In<Transformed<string, DateTime>>()
      // @Out<Transformed<Date, string>>()
      // date!: DateTime;

      emebeddedProperty!: number;
      x!: Transformed<string, number>;
    }

    @t.transformerDecorator()
    class Test {
      testString!: string;
      testNumber!: number;
      testUnion!: Test | null;
      testNested!: TestEmbed;
      testOptional?: string;
      // testIntersection!: IInterface & IOtherInterface;
    }

    @t.transformerDecorator()
    class TestGenericEmeb<T> {
      genericProperty!: T;
    }

    @t.transformerDecorator()
    class TestGeneric {
      t!: TestGenericEmeb<number>;
    }

    const trees = t.getPropertyTypeTreesFromConstructor(Test);
    console.log(trees);

    const r = await t.transform(Test, {
      testString: 'str',
      testNumber: 9001,
      testUnion: null,
      testNested: {
        emebeddedProperty: 9001,
        x: '123' as any,
      },
      // testIntersection: {
      //   interfaceProperty: 1,
      //   otherInterfaceProperty: 2,
      // },
    });
    const r2 = await t.transform(Test, {
      testString: 'str',
      testNumber: 9001,
      testUnion: {
        testString: '',
        testNumber: 0,
        testUnion: null,
        testNested: {
          emebeddedProperty: 23,
          x: '123' as any,
        },
        testOptional: '123',
      },
      testNested: {
        emebeddedProperty: 9001,
        x: '123' as any,
      },
      // testIntersection: {
      //   interfaceProperty: 1,
      //   otherInterfaceProperty: 2,
      // },
    });

    console.log(r);
  });

  it('should', () => {
    const inst = new TransformerInstance({ project });
  });
});
