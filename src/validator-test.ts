/*import { Validator, validate } from './v';

enum TestEnum {
  Foo = 1,
  Bar = 9001,
}

@Validator()
export class TestNested {
  id!: number;

  name!: string;
}

@Validator()
export class Test {
  testId!: number;

  name!: string;

  optional?: string;

  linkedIds!: number[];

  zort!: (string | number)[];

  isNull!: string | null;

  anEnum!: TestEnum;

  anEnumArray!: TestEnum[];

  // testx!: string | number;

  nestedOne!: TestNested;

  // nestedArray!: TestNested[];

  // nestedUnionArray!: TestNested[] | number[];

  // date!: Date;
}

@Validator()
class TestUpdate extends Test {
  extraThingy?: string;
}

// eslint-disable-next-line @typescript-eslint/no-namespace
namespace TestNamespace {
  @Validator()
  export class TestInNamespace {
    testId!: number;
  }

  export namespace TestNestedNamespace1 {
    @Validator()
    export class TestEmbeddableInNamespace1 {
      extra!: number;

      extra1000!: number;

      extra5000?: number;

      // dead?: TestInNamespace1;
    }

    @Validator()
    export class TestInNamespace1 {
      blorb!: number;
      test!: TestEmbeddableInNamespace1;
    }
  }

  export namespace TestNestedNamespace2 {
    @Validator()
    export class TestInNamespace2 {
      zort!: number;
      embedded!: TestNestedNamespace1.TestInNamespace1;
    }
  }
}

// validate(TestUpdate, {
//   //testId: 123,
//   name: 123,
//   linkedIds: [],
//   zort: [1, '2', '3', false],
//   isNull: null,
//   anEnum: TestEnum.Bar,
//   anEnumArray: [TestEnum.Foo],
// } as any);
// validate(TestNamespace.TestNestedNamespace2.TestInNamespace2, { zort: 123 });

// validate(TestNamespace.TestNestedNamespace2.TestInNamespace2, { zort: 123, embedded: { blorb: 123 } });

// validate(TestNamespace.TestNestedNamespace2.TestInNamespace2, {
//   zort: 123,
//   embedded: { blorb: 123, test: { extra: 9001 } },
// } as any);
validate(TestNamespace.TestNestedNamespace2.TestInNamespace2, {
  zort: 123,
  embedded: { blorb: '123', test: {} },
});
// validate(TestNamespace.TestNestedNamespace2.TestInNamespace2, { zort: 123, embedded: { blorb: 123 } } as any);
// validate(TestNamespace.TestNestedNamespace2.TestInNamespace2, { zort: 123, embedded: { blorb: '123' } } as any);
*/
/*
validate(TestNamespace.TestNestedNamespace1.TestInNamespace1, { testId: 123 });

validate(TestNamespace.TestNestedNamespace2.TestInNamespace2, { zort: 123 });

validate(Test, {
  testId: 123,
  name: 'test',
  linkedIds: [],
  zort: [],
  isNull: null,
  anEnum: TestEnum.Bar,
  anEnumArray: [TestEnum.Foo],
});

validate(Test, {
  testId: 123,
  name: 'test',
  linkedIds: [1, 2, 'a'],
  zort: [],
  isNull: null,
  anEnum: TestEnum.Bar,
  anEnumArray: [TestEnum.Foo],
} as any);
*/
