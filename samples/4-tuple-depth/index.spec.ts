import { describe, expect, it } from 'vitest';
import { buildSample, runSample } from '../test/utils';

describe('4-tuple-depth', () => {
  it('tuple-depth-subtyping', async () => {
    const { success, output, stderr } = await buildSample(
      'samples/4-tuple-depth/tuple-depth-subtyping.ts'
    );
    console.log(stderr);
    expect(success).toBeTruthy();
    expect(output).toBe(
      `RT.registerType(RT.InterfaceRepr("B", {
    "foo": RT.ArrowType([], RT.Void, undefined) }, {
    "bar": RT.Str }, [], false));
RT.registerType(RT.InterfaceRepr("A", {
    "baz": RT.ArrowType([], RT.Void, undefined),
    "foo": RT.ArrowType([], RT.Void, undefined) }, {
    "bar": RT.Str }, ["B"], false));

var AImpl = (function () {
    function AImpl() {
        this.bar = 'success';
    }
    AImpl.prototype.foo = function () {
    };
    AImpl.prototype.baz = function () {
    };
    AImpl.__rtti__ = RT.registerClass("AImpl", {
        "foo": RT.ArrowType([], RT.Void, undefined),
        "baz": RT.ArrowType([], RT.Void, undefined) }, {
        "bar": RT.Str }, undefined, ["A"], {
        "<new>": RT.ArrowType([], RT.InstanceType("AImpl"), undefined) }, {
        "prototype": RT.InstanceType("AImpl") }, RT.ArrowType([], RT.InstanceType("AImpl"), undefined), AImpl);
    return AImpl;
})();
AImpl.prototype.__rtti__ = RT.InstanceType("AImpl");

var a = new AImpl();
var a2 = [
    RT.shallowTag(a, RT.InterfaceType("A"))
];

console.log(RT.shallowTag(a2, RT.Tuple({
    "0": RT.InterfaceType("A") })));

function parse(entities) {
    entities[0].foo();
    return entities[0].bar;
}

console.log(parse(a2));
`
    );
    const runtimeOutput = await runSample(
      'samples/4-tuple-depth/tuple-depth-subtyping.js'
    );

    console.log(runtimeOutput.stderr);
    expect(runtimeOutput.stdout).toContain('success');
  });
});
