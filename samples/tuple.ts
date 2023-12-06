export class Bob {
  name: string;
  age: number;
}

export function concat(tuple: [number, Bob, string]): string {
  tuple[1] = new Bob();
  return tuple[0] + ' ' + tuple[1] + ' ' + tuple[2];
}
