var tuple: [boolean, boolean, number, string] = [false, true, 2, 'str'];

function access(index: number) {
  return tuple[index];
}

var bool: boolean = access(0) && access(1);
var isBoolean = typeof bool === 'boolean';
var num: number = access(2);
var str: string = access(3);

console.log(isBoolean, num, str);
