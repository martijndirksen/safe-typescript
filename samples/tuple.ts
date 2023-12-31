export class Person {
  constructor(name: string, age: number) {
    this.name = name;
    this.age = age;
  }

  name: string;
  age: number;
}

export class Employee extends Person {
  constructor(name: string, age: number, id: number) {
    super(name, age);
    this.id = id;
  }

  id: number;
}

export function concat(tuple: [string, string, string]): string {
  return tuple[0] + ' ' + tuple[1] + ' ' + tuple[2];
}
concat(['s', 'b', 'c', 'd']);

// export function concatStr(a: string[], b: string[]) {
//   return null;
// }

// concatStr(['4'], ['bob']);
