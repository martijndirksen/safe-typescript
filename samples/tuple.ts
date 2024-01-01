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

export function print(tuple: [Person, string]): string {
  return tuple[0].name + tuple[1];
}

//print(['Bob', 'Steve']);
// error TS2082: Supplied parameters do not match any signature
// of call target:
//  Type 'String' is missing property 'name' from type 'Person'.

var input = [new Person('Bob', 26), 'Steve'];

print(input);
// print([new Person('Bob', 26), 'Steve']);
// print([new Employee('Bob', 26, 1001), 'Steve']);
