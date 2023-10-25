export interface Iterator<T> {
  moveNext(): boolean;
  current(): T;
}
