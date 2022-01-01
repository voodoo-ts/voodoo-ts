export function* enumerate<T>(iterable: Iterable<T>, start: number = 0): Generator<[number, T], void, unknown> {
  let i = start;
  for (const item of iterable) {
    yield [i, item];
    i++;
  }
}
