type Tuple = [number, string];

export function concat(tuple: Tuple): string {
  return tuple[0] + ' ' + tuple[1];
}
