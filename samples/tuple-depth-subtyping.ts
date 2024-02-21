interface B {
  foo(): void;
  bar: string;
}

interface A extends B {
  baz(): void;
}

class AImpl implements A {
  bar = 'success';
  foo() {}
  baz() {}
}

var a: A = new AImpl();
var a2: [A] = [a];

console.log(a2);

// TODO: This should not result in any RTTI, because it is inherently sound
function parse(entities: [B]): string {
  entities[0].foo();
  return entities[0].bar;
}

console.log(parse(a2));
