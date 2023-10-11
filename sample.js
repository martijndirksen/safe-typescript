import { RT } from './dist/lib/rt.js';

RT.registerType(RT.InterfaceRepr('Boolean', {}, {}, []));
RT.registerType(
  RT.InterfaceRepr(
    'Error',
    {},
    {
      name: RT.Str,
      message: RT.Str,
    },
    []
  )
);
RT.registerType(
  RT.InterfaceRepr(
    'TypeError',
    {},
    {
      name: RT.Str,
      message: RT.Str,
    },
    []
  )
);
RT.registerType(
  RT.InterfaceRepr(
    'RegExp',
    {
      exec: RT.ArrowType(
        [RT.Str],
        RT.InterfaceType('RegExpExecArray'),
        undefined
      ),
      test: RT.ArrowType([RT.Str], RT.Bool, undefined),
      compile: RT.ArrowType([], RT.InterfaceType('RegExp'), undefined),
    },
    {
      source: RT.Str,
      global: RT.Bool,
      ignoreCase: RT.Bool,
      multiline: RT.Bool,
      lastIndex: RT.Num,
    },
    []
  )
);
function add(a, b) {
  return RT.checkAndTag(a + b, RT.Any, RT.Num);
}

add(5, 8);
add(5, '8');
