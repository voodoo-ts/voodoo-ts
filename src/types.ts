export interface Constructor<T> {
  new (...args: any[]): T;
  prototype: object;
}
