export class Bob {
  name: string;
  age: number;
}

export function concat(tuple: [number, Bob, string, Date]): string {
  tuple[2] = new Bob();
  return tuple[0] + ' ' + tuple[1] + ' ' + tuple[2];
}

concat([3, new Bob(), 's', new Date()]);

// export function concatStr(a: string[], b: string[]) {
//   return null;
// }

// concatStr(['4'], ['bob']);
