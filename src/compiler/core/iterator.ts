/// <reference path='references.ts' />


  export interface Iterator<T> {
    moveNext(): boolean;
    current(): T;
  }
}
