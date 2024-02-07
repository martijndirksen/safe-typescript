interface B {
  foo(): void;
  bar: string;
}

interface A extends B {
  baz(): void;
}

var a: A = { foo() {}, bar: 'success', baz() {} };
var a2: [A] = [a];

function parse(entities: [B]): string {
  return entities[0].bar;
}

console.log(parse(a2));
