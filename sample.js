RT.registerType(RT.InterfaceRepr("Object", {
    "toString": RT.ArrowType([], RT.Str, undefined),
    "toLocaleString": RT.ArrowType([], RT.Str, undefined),
    "valueOf": RT.ArrowType([], RT.InterfaceType("Object"), undefined),
    "hasOwnProperty": RT.ArrowType([RT.Str], RT.Bool, undefined),
    "isPrototypeOf": RT.ArrowType([RT.InterfaceType("Object")], RT.Bool, undefined),
    "propertyIsEnumerable": RT.ArrowType([RT.Str], RT.Bool, undefined) }, {}, []));
RT.registerType(RT.InterfaceRepr("String", {
    "toString": RT.ArrowType([], RT.Str, undefined),
    "charAt": RT.ArrowType([RT.Num], RT.Str, undefined),
    "charCodeAt": RT.ArrowType([RT.Num], RT.Num, undefined),
    "concat": RT.ArrowType([RT.ArrayType(RT.Str)], RT.Str, {
        "type": RT.ArrayType(RT.Str),
        "optional": true }, 0),
    "indexOf": RT.ArrowType([RT.Str, RT.Num], RT.Num, undefined, 1),
    "lastIndexOf": RT.ArrowType([RT.Str, RT.Num], RT.Num, undefined, 1),
    "localeCompare": RT.ArrowType([RT.Str], RT.Num, undefined),
    "localeCompare": RT.ArrowType([RT.Str, RT.ArrayType(RT.Str), RT.JustType("CollatorOptions")], RT.Num, undefined, 2),
    "localeCompare": RT.ArrowType([RT.Str, RT.Str, RT.JustType("CollatorOptions")], RT.Num, undefined, 2),
    "match": RT.ArrowType([RT.Str], RT.ArrayType(RT.Str), undefined),
    "match": RT.ArrowType([RT.InterfaceType("RegExp")], RT.ArrayType(RT.Str), undefined),
    "replace": RT.ArrowType([RT.Str, RT.Str], RT.Str, undefined),
    "replace": RT.ArrowType([RT.Str, RT.StructuredType({
        "<call>": RT.ArrowType([RT.Str, RT.ArrayType(RT.Any)], RT.Str, {
            "type": RT.ArrayType(RT.Any),
            "optional": true }, 1) }, {})], RT.Str, undefined),
    "replace": RT.ArrowType([RT.InterfaceType("RegExp"), RT.Str], RT.Str, undefined),
    "replace": RT.ArrowType([RT.InterfaceType("RegExp"), RT.StructuredType({
        "<call>": RT.ArrowType([RT.Str, RT.ArrayType(RT.Any)], RT.Str, {
            "type": RT.ArrayType(RT.Any),
            "optional": true }, 1) }, {})], RT.Str, undefined),
    "search": RT.ArrowType([RT.Str], RT.Num, undefined),
    "search": RT.ArrowType([RT.InterfaceType("RegExp")], RT.Num, undefined),
    "slice": RT.ArrowType([RT.Num, RT.Num], RT.Str, undefined, 1),
    "split": RT.ArrowType([RT.Str, RT.Num], RT.ArrayType(RT.Str), undefined, 1),
    "split": RT.ArrowType([RT.InterfaceType("RegExp"), RT.Num], RT.ArrayType(RT.Str), undefined, 1),
    "substring": RT.ArrowType([RT.Num, RT.Num], RT.Str, undefined, 1),
    "toLowerCase": RT.ArrowType([], RT.Str, undefined),
    "toLocaleLowerCase": RT.ArrowType([], RT.Str, undefined),
    "toUpperCase": RT.ArrowType([], RT.Str, undefined),
    "toLocaleUpperCase": RT.ArrowType([], RT.Str, undefined),
    "trim": RT.ArrowType([], RT.Str, undefined),
    "substr": RT.ArrowType([RT.Num, RT.Num], RT.Str, undefined, 1) }, {
    "<index>": RT.IndexMapType(RT.Num, RT.Str),
    "length": RT.Num }, []));
RT.registerType(RT.InterfaceRepr("Number", {
    "toString": RT.ArrowType([RT.Num], RT.Str, undefined, 0),
    "toFixed": RT.ArrowType([RT.Num], RT.Str, undefined, 0),
    "toExponential": RT.ArrowType([RT.Num], RT.Str, undefined, 0),
    "toPrecision": RT.ArrowType([RT.Num], RT.Str, undefined, 0),
    "toLocaleString": RT.ArrowType([RT.ArrayType(RT.Str), RT.JustType("NumberFormatOptions")], RT.Str, undefined, 1),
    "toLocaleString": RT.ArrowType([RT.Str, RT.JustType("NumberFormatOptions")], RT.Str, undefined, 1) }, {}, []));
RT.registerType(RT.InterfaceRepr("Boolean", {}, {}, []));
RT.registerType(RT.InterfaceRepr("Error", {}, {
    "name": RT.Str,
    "message": RT.Str }, []));
RT.registerType(RT.InterfaceRepr("TypeError", {}, {
    "name": RT.Str,
    "message": RT.Str }, []));
RT.registerType(RT.InterfaceRepr("RegExp", {
    "exec": RT.ArrowType([RT.Str], RT.InterfaceType("RegExpExecArray"), undefined),
    "test": RT.ArrowType([RT.Str], RT.Bool, undefined),
    "compile": RT.ArrowType([], RT.InterfaceType("RegExp"), undefined) }, {
    "source": RT.Str,
    "global": RT.Bool,
    "ignoreCase": RT.Bool,
    "multiline": RT.Bool,
    "lastIndex": RT.Num }, []));
function add(a, b) {
    return RT.checkAndTag(a + b, RT.Any, RT.Num);
}

add(5, 8);
