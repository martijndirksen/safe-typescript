// var a: [number, string, string] = [1, 'a', 'b'];
// a.2 = 7;
// var a: number[] = [4, 8, 12];
// a[2] = 1;

// var obj: { f0: number; f1: number; f2: number } = { f0: 4, f1: 8, f2: 12 };
// var tgt: any = 8;
// obj.f2 = tgt;
var tuple: [number, number] = [4, 2];

function setValue(index: number, val: number) {
  tuple[index] = val;
}

var process = { argv: ['', '', '3', '28'] };

setValue(+process.argv[2], +process.argv[3]);

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
