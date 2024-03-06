var arr: number[] = [];
var arr2: number[] = [2, 4, 7];
var arr3: number[][] = [[2], [4], arr2];
var arr4: string[] = ['str1', 'str2', 'str3'];

var input: any = 'str4';
arr4.push(input);
var str = arr4[0] + arr4[1];

arr4[1] = input;
