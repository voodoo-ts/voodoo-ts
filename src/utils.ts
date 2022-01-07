export function* enumerate<T>(iterable: Iterable<T>, start: number = 0): Generator<[number, T], void, unknown> {
  let i = start;
  for (const item of iterable) {
    yield [i, item];
    i++;
  }
}

export function* zip<T, U>(a: T[], b: U[]): Generator<[T, U]> {
  const iterA = a[Symbol.iterator]();
  const iterB = b[Symbol.iterator]();
  while (true) {
    const valueA = iterA.next();
    const valueB = iterB.next();

    if (valueA.done || valueB.done) {
      return;
    }

    yield [valueA.value, valueB.value];
  }
}
