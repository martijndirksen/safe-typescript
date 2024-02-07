interface B {
  foo(): void;
  bar: string;
}

interface A extends B {
  baz(): void;
}

var a: A = { foo() {}, bar: 'success', baz() {} };

function parse(entities: [B]): string {
  return entities[0].bar;
}

console.log(parse([a]));
