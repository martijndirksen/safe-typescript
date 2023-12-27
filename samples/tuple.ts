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

export function concat(tuple: [number, Person, string, Date]): string {
  //tuple[2] = new Person();
  return tuple[0] + ' ' + tuple[1] + ' ' + tuple[2];
}
var date: any = new Date();
concat([3, new Employee('Steve', 28, 1), 's', date]);

// export function concatStr(a: string[], b: string[]) {
//   return null;
// }

// concatStr(['4'], ['bob']);
