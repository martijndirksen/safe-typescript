// Modified by N.Swamy, A.Rastogi (2014)
///<reference path='../../../../dist/lib.d.ts' />
var RT;
(function (RT) {
    function createEmptyMap() {
        var o = {};
        o.__proto__ = null;
        return o;
    }
    RT.createEmptyMap = createEmptyMap;
    function __forceCheckedArray(c, t) {
        return RT.checkAndTag(c, RT.Any, RT.ArrayType(t));
    }
    RT.__forceCheckedArray = __forceCheckedArray;
    function forceCheckedArray(c) {
        return c;
    }
    RT.forceCheckedArray = forceCheckedArray;
    function applyVariadic(o, m, args) {
        var f = o[m];
        return f.apply(o, args);
    }
    RT.applyVariadic = applyVariadic;
    function printTag(o) {
        console.log(RT.prettyprint_t(o.__rtti__));
    }
    RT.printTag = printTag;
})(RT || (RT = {}));
