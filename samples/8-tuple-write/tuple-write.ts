var tuple: [string, number] = ['str', 13];
tuple[0] = 'mod';
tuple[1] = tuple[1] * 2;
console.log(tuple[0], tuple[1]);
