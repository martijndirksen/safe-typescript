// var a: [number, string, string] = [1, 'a', 'b'];
// a.2 = 7;
// var a: number[] = [4, 8, 12];
// a[2] = 1;

// var obj: { f0: number; f1: number; f2: number } = { f0: 4, f1: 8, f2: 12 };
// var tgt: any = 8;
// obj.f2 = tgt;
// TODO: implement compile-time error about width/depth typing mismatch
//var tuple: [number, { val: string }] = [4, { val: '2' }];

//function setValue(index: number, val: number) {
//  tuple[index] = val;
//}

//var process = { argv: ['', '', '3', '28'] };

//setValue(+process.argv[2], +process.argv[3]);

// function setValue(index, val) {
//   console.log(tuple);
//   RT.writeField(
//     tuple,
//     RT.StructuredType(
//       {},
//       {
//         0: RT.Num,
//         1: RT.Num,
//       }
//     ),
//     index,
//     val,
//     RT.Num
//   );
//   console.log(tuple);
// }

// // var process = { argv: ['', '', '3', '28'] };

// setValue(+process.argv[2], +process.argv[3]);
// console.log(+process.argv[2], +process.argv[3]);

const tuple: [...number[], number, string] = [4, 2, 'Bob'];
const tuple2: [number, ...number[], string] = [4, 2, 'Bob'];
const tuple3: [number, string, ...number[]] = [4, '2', 8, 8, 7];
const tuple4: [number, string, number] = [4, '2', 8, 8, 7];

// var tuple: [number, number] = [4, 2];
// //error TS2094: The property 'push' does not exist on value of type 'tuple'.
// tuple.push(4);
