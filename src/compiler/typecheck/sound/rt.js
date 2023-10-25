// Modified by N.Swamy, A.Rastogi (2014)
///<reference path='rtapi.ts'/>
var RT;
(function (RT) {
    ////////////////////////////////////////////////////////////////////////////
    // Some utilities
    ////////////////////////////////////////////////////////////////////////////
    function assert(b, m) {
        if (!b) {
            //console.log("assert failure: " + m);
            throw new Error("assert failure: " + m);
        }
    }
    function die(msg) {
        throw new Error(msg);
    }
    RT.die = die;
    ////////////////////////////////////////////////////////////////////////////
    // Basic definitions for RTTI-related types
    ////////////////////////////////////////////////////////////////////////////
    var TT;
    (function (TT) {
        TT[TT["ANY"] = 0] = "ANY";
        TT[TT["NUMBER"] = 1] = "NUMBER";
        TT[TT["STRING"] = 2] = "STRING";
        TT[TT["BOOLEAN"] = 3] = "BOOLEAN";
        TT[TT["VOID"] = 4] = "VOID";
        TT[TT["ARRAY"] = 5] = "ARRAY";
        TT[TT["INSTANCE"] = 6] = "INSTANCE";
        TT[TT["INTERFACE"] = 7] = "INTERFACE";
        TT[TT["CLASS"] = 8] = "CLASS";
        TT[TT["INDEX_MAP"] = 9] = "INDEX_MAP";
        TT[TT["STRUCTURED_TYPE"] = 10] = "STRUCTURED_TYPE";
        TT[TT["JUST_TYPE"] = 11] = "JUST_TYPE";
        TT[TT["UN"] = 12] = "UN";
    })(TT = RT.TT || (RT.TT = {}));
    function eqOptionalMap(m1, m2) {
        if (m1 === m2) {
            return true;
        }
        if (!(m1 && m2)) {
            return false;
        }
        for (var i in m1) {
            if (!(m1[i] === m2[i])) {
                return false;
            }
        }
        for (var i in m2) {
            if (!(m1[i])) {
                return false;
            }
        }
        return true;
    }
    function prettyprint_a(a) {
        var s = "( ";
        for (var i = 0; i < a.args.length; ++i) {
            if (i > 0) {
                s += ", ";
            }
            s += prettyprint_t(a.args[i]);
            if (a.mandatoryArgs && i >= a.mandatoryArgs) {
                s += "?";
            }
        }
        if (a.varargs) {
            s += " , ..." + prettyprint_t(a.varargs);
        }
        s += " ) => " + prettyprint_t(a.result);
        return s;
    }
    function prettyprint_t(t) {
        if (isZero(t)) {
            return "zero";
        }
        switch (t.tt) {
            case TT.UN:
                return "Un";
            case TT.ANY:
                return "any";
            case TT.ARRAY:
                return prettyprint_t(t.elt) + "[]";
            case TT.BOOLEAN:
                return "boolean";
            case TT.CLASS:
                return t.name + "_Class";
            case TT.INDEX_MAP:
                return "[_:" + prettyprint_t(t.key) + "] :" + prettyprint_t(t.value);
            case TT.INSTANCE:
                return t.name;
            case TT.INTERFACE:
                return t.name;
            case TT.JUST_TYPE:
                return "dot " + prettyprint_t(t.base);
            case TT.NUMBER:
                return "number";
            case TT.STRING:
                return "string";
            case TT.STRUCTURED_TYPE:
                var s = "{ ";
                var first = true;
                var methods = t.methodTable;
                for (var m in methods) {
                    if (!first) {
                        s += ", ";
                    }
                    else {
                        first = false;
                    }
                    s += m + ":" + prettyprint_a(methods[m]);
                }
                var flds = t.fieldTable;
                first = true;
                s += ", ";
                for (var f in flds) {
                    if (!first) {
                        s += ", ";
                    }
                    else {
                        first = false;
                    }
                    s += f + ":" + prettyprint_t(flds[f]);
                }
                return (s += " }");
            case TT.VOID:
                return "void";
        }
        throw new Error("Impossible");
    }
    RT.prettyprint_t = prettyprint_t;
    function InstanceRepr(name, methods, fields, extendsList, functionObject, implementsList) {
        return { kind: TT.INSTANCE, name: name, methods: methods, fields: fields, extendsList: extendsList, functionObject: functionObject, implementsList: implementsList };
    }
    RT.InstanceRepr = InstanceRepr;
    function ClassRepr(name, methods, fields, extendsList, constr) {
        return { kind: TT.CLASS, name: name, methods: methods, fields: fields, extendsList: extendsList, constr: constr };
    }
    RT.ClassRepr = ClassRepr;
    function InterfaceRepr(name, methods, fields, extendsList, nominal) {
        if (nominal === void 0) { nominal = false; }
        return { kind: TT.INTERFACE, name: name, methods: methods, fields: fields, extendsList: extendsList };
    }
    RT.InterfaceRepr = InterfaceRepr;
    ////////////////////////////////////////////////////////////////////////////
    // Named type registry: Each declaration of a class/interface registers the 
    //                      representation of the type with the runtime
    ////////////////////////////////////////////////////////////////////////////    
    var registry = Object.create(null);
    function registerType(repr) {
        var name = repr.name;
        if (registry[name]) {
            throw new Error("Named type " + repr.name + " is already defined");
        }
        if (name === "String") {
            RT.Str.methodTable = repr.methods;
        }
        else if (name === "Object") {
            RT.objectMethods = repr.methods;
        }
        else if (name === "Number") {
            RT.Num.methodTable = repr.methods;
        }
        else {
            var named_type = namedTypesCache[name];
            if (!named_type) {
                if (repr.kind === TT.INTERFACE) {
                    named_type = InterfaceType(name);
                }
                else if (repr.kind === TT.CLASS) {
                    named_type = ClassType(name);
                }
                else if (repr.kind === TT.INSTANCE) {
                    named_type = InstanceType(name);
                }
            }
            named_type.fieldTable = repr.fields;
            named_type.methodTable = repr.methods;
            named_type.structuredType = StructuredType(repr.methods, repr.fields);
            named_type.structuredType.immutable = true;
            named_type.extendsList = repr.extendsList;
            if (repr.kind === TT.CLASS) {
                named_type.constr = repr.constr;
            }
            else if (repr.kind === TT.INSTANCE) {
                named_type.implementsList = repr.implementsList;
                named_type.functionObject = repr.functionObject;
            }
        }
        registry[name] = true;
    }
    RT.registerType = registerType;
    function registerClass(className, methods, fields, extendsC, implementsI, staticMethods, staticFields, constructorType, functionObject) {
        var instanceObject = InstanceRepr(className, methods, fields, (extendsC ? [extendsC] : []), functionObject, implementsI);
        var classObject = ClassRepr(className + "Class", staticMethods, staticFields, [], constructorType);
        registerType(instanceObject);
        registerType(classObject);
        return ClassType(className);
    }
    RT.registerClass = registerClass;
    ////////////////////////////////////////////////////////////////////////////
    // RTTI builders
    ////////////////////////////////////////////////////////////////////////////
    //constants
    var emptyFieldTable = RT.createEmptyMap();
    var emptyMethodTable = RT.createEmptyMap();
    RT.Un = {
        tt: TT.UN,
        fieldTable: emptyFieldTable,
        methodTable: emptyMethodTable
    };
    RT.Any = {
        tt: TT.ANY,
        fieldTable: emptyFieldTable,
        methodTable: emptyMethodTable,
    };
    RT.Num = {
        tt: TT.NUMBER,
        fieldTable: emptyFieldTable,
        methodTable: emptyMethodTable,
    };
    RT.Bool = {
        tt: TT.BOOLEAN,
        fieldTable: emptyFieldTable,
        methodTable: emptyMethodTable,
    };
    RT.Str = {
        tt: TT.STRING,
        fieldTable: { "length": RT.Num },
        methodTable: emptyMethodTable,
    };
    RT.Void = {
        tt: TT.VOID,
        fieldTable: emptyFieldTable,
        methodTable: emptyMethodTable,
    };
    var _;
    _ = Number.prototype.__rtti__ = RT.Num;
    _ = Boolean.prototype.__rtti__ = RT.Bool;
    _ = String.prototype.__rtti__ = RT.Str;
    _ = Object.prototype.__rtti__ = RT.Any; /* Functions and Arrays inherit __rtti__ from Object.prototype, Object.create(..) may not */
    var namedTypesCache = {};
    function getNamedType(name, tt) {
        if (namedTypesCache[name]) {
            return namedTypesCache[name];
        }
        else {
            return (namedTypesCache[name] = { tt: tt, name: name, fieldTable: emptyFieldTable, methodTable: emptyMethodTable, structuredType: undefined });
        }
    }
    //constructors
    function InterfaceType(name) {
        return getNamedType(name, TT.INTERFACE);
    }
    RT.InterfaceType = InterfaceType;
    function InstanceType(name) {
        return getNamedType(name, TT.INSTANCE);
    }
    RT.InstanceType = InstanceType;
    function ClassType(name) {
        return getNamedType(name + "Class", TT.CLASS);
    }
    RT.ClassType = ClassType;
    function StructuredType(methods, fields) {
        methods.__proto__ = null;
        fields.__proto__ = null;
        return { tt: TT.STRUCTURED_TYPE, methodTable: methods, fieldTable: fields };
    }
    RT.StructuredType = StructuredType;
    function JustType(t) {
        return { tt: TT.JUST_TYPE, base: t, fieldTable: emptyFieldTable, methodTable: emptyMethodTable };
    }
    RT.JustType = JustType;
    function IndexMapType(key, value) {
        return { tt: TT.INDEX_MAP, key: key, value: value, fieldTable: emptyFieldTable, methodTable: emptyMethodTable };
    }
    RT.IndexMapType = IndexMapType;
    function ArrayType(elt) {
        return { tt: TT.ARRAY, elt: elt, fieldTable: { "length": RT.Num }, methodTable: emptyMethodTable };
    }
    RT.ArrayType = ArrayType;
    function ArrowType(args, result, varargs, mandatoryArgs) {
        var arrow = {
            args: args,
            result: result
        };
        if (varargs) {
            arrow.varargs = varargs;
        }
        if (!(mandatoryArgs === undefined)) {
            arrow.mandatoryArgs = mandatoryArgs;
        }
        return arrow;
    }
    RT.ArrowType = ArrowType;
    function LambdaType(arg, ret, varargs, mandatoryArgs) {
        return StructuredType({ "<call>": ArrowType(arg, ret, varargs, mandatoryArgs) }, {});
    }
    RT.LambdaType = LambdaType;
    function RecordType(flds) {
        return StructuredType({}, flds);
    }
    RT.RecordType = RecordType;
    var NameRelation;
    (function (NameRelation) {
        NameRelation[NameRelation["SUBTYPE"] = 0] = "SUBTYPE";
        NameRelation[NameRelation["EQUALITY"] = 1] = "EQUALITY";
    })(NameRelation || (NameRelation = {}));
    function extendContext(cxt, t1, t2, reln) {
        var n_cxt = {};
        for (var f in cxt) {
            n_cxt[f] = cxt[f];
        }
        var s = (reln === NameRelation.SUBTYPE) ? " <: " : " = ";
        n_cxt[t1.name + s + t2.name] = true;
        if (reln === NameRelation.EQUALITY) {
            n_cxt[t2.name + s + t1.name] = true; // reflexivity of equality
        }
        return n_cxt;
    }
    function inContext(cxt, t1, t2, reln) {
        var s = (reln === NameRelation.SUBTYPE) ? " <: " : " = ";
        return cxt[t1.name + s + t2.name] === true;
    }
    var namedTypeRelationRegistry = (function () {
        var r = {};
        r.__proto__ = null;
        return r;
    })();
    function addToNamedTypeRelationRegistry(t1, t2, reln, d) {
        var s = (reln === NameRelation.SUBTYPE) ? " <: " : " = ";
        namedTypeRelationRegistry[t1.name + s + t2.name] = d;
        if (reln === NameRelation.EQUALITY) {
            namedTypeRelationRegistry[t2.name + s + t1.name] = d; // reflexivity of equality
        }
    }
    function inNamedTypeRelationRegistry(t1, t2, reln) {
        var s = (reln === NameRelation.SUBTYPE) ? t1.name + " <: " + t2.name : t1.name + " = " + t2.name;
        return (namedTypeRelationRegistry[s] ? { fst: true, snd: namedTypeRelationRegistry[s] } : { fst: false, snd: zero });
    }
    function subtype(t1, t2, cxt) {
        var sub;
        if (t1 === t2) {
            return { fst: true, snd: zero };
        }
        switch (t2.tt) {
            case TT.ANY:
                switch (t1.tt) {
                    case TT.NUMBER:
                    case TT.BOOLEAN:
                    case TT.STRING:
                    case TT.VOID:
                    case TT.INSTANCE:
                        return { fst: true, snd: zero };
                    case TT.INTERFACE:
                    case TT.STRUCTURED_TYPE:
                    case TT.ARRAY:
                    case TT.INDEX_MAP:
                    case TT.CLASS:
                        return { fst: true, snd: t1 };
                    default:
                        return { fst: false, snd: zero };
                }
            case TT.INSTANCE:
                if (t1.tt === TT.INSTANCE) {
                    return {
                        fst: t1.functionObject.prototype instanceof t2.functionObject, snd: zero
                    };
                }
                else {
                    return { fst: false, snd: zero };
                }
            case TT.VOID:
                return { fst: true, snd: zero };
            case TT.INTERFACE:
                switch (t1.tt) {
                    case TT.INTERFACE:
                        // in extends list
                        if (t1.extendsList.indexOf(t2.name) !== -1) {
                            return { fst: true, snd: t1 };
                        }
                        // in relation registry
                        if ((sub = inNamedTypeRelationRegistry(t1, t2, NameRelation.SUBTYPE)) && sub.fst) {
                            return sub;
                        }
                        // from context
                        if (inContext(cxt, t1, t2, NameRelation.SUBTYPE)) {
                            return { fst: true, snd: zero };
                        }
                        if (equalTypes(t1, t2, cxt)) {
                            return { fst: true, snd: zero };
                        }
                        // extend context and recur
                        sub = subtype(t1.structuredType, t2.structuredType, extendContext(cxt, t1, t2, NameRelation.SUBTYPE));
                        if (sub.fst) {
                            addToNamedTypeRelationRegistry(t1, t2, NameRelation.SUBTYPE, sub.snd);
                        }
                        return sub;
                    case TT.STRUCTURED_TYPE:
                        return subtype(t1, t2.structuredType, cxt);
                    case TT.INSTANCE:
                        // in implements list
                        if (t1.implementsList.indexOf(t2.name) !== -1) {
                            return { fst: true, snd: zero };
                        }
                        // in relation registry
                        if ((sub = inNamedTypeRelationRegistry(t1, t2, NameRelation.SUBTYPE)) && sub.fst) {
                            return sub;
                        }
                        // from context
                        if (inContext(cxt, t1, t2, NameRelation.SUBTYPE)) {
                            return { fst: true, snd: zero };
                        }
                        // extend context and recur
                        sub = subtype(t1.structuredType, t2.structuredType, extendContext(cxt, t1, t2, NameRelation.SUBTYPE));
                        if (sub.fst) {
                            addToNamedTypeRelationRegistry(t1, t2, NameRelation.SUBTYPE, sub.snd);
                        }
                        return sub;
                    default:
                        return { fst: false, snd: zero };
                }
            case TT.ARRAY:
                if (t1.tt === TT.ARRAY) {
                    return { fst: equalTypes(t1.elt, t2.elt, cxt), snd: zero };
                }
                else {
                    return { fst: false, snd: zero };
                }
            case TT.INDEX_MAP:
                if (t1.tt === TT.INDEX_MAP) {
                    return { fst: equalTypes(t1.key, t2.key, cxt) && equalTypes(t1.value, t2.value, cxt), snd: zero };
                }
                else {
                    return { fst: false, snd: zero };
                }
            case TT.STRUCTURED_TYPE:
                switch (t1.tt) {
                    case TT.INTERFACE:
                        return subtype(t1.structuredType, t2, cxt);
                    case TT.INSTANCE:
                        return { fst: subtype(t1.structuredType, t2, cxt).fst, snd: zero };
                    case TT.STRUCTURED_TYPE:
                        var flds1 = t1.fieldTable;
                        var flds2 = t2.fieldTable;
                        var methods1 = t1.methodTable;
                        var methods2 = t2.methodTable;
                        for (var f in flds2) {
                            if (!flds1[f]) {
                                return { fst: false, snd: zero };
                            }
                            if (!(equalTypes(flds1[f], flds2[f], cxt))) {
                                return { fst: false, snd: zero };
                            }
                        }
                        for (var m in methods2) {
                            if (!methods1[m]) {
                                return { fst: false, snd: zero };
                            }
                            if (!(isArrowSubtype(methods1[m], methods2[m], cxt))) {
                                return { fst: false, snd: zero };
                            }
                        }
                        var forgotten_flds = {};
                        var optional_flds = {};
                        var forgotten_methods = {};
                        var zero_delta = true;
                        for (var f in flds1) {
                            if (!flds2[f]) {
                                zero_delta = true;
                                forgotten_flds[f] = flds1[f];
                            }
                        }
                        for (var m in methods1) {
                            if (!methods2[m] || !isArrowEqual(methods1[m], methods2[m], cxt)) {
                                zero_delta = true;
                                forgotten_methods[m] = methods1[m];
                            }
                        }
                        if (zero_delta) {
                            return { fst: true, snd: zero };
                        }
                        else {
                            return { fst: true, snd: StructuredType(forgotten_methods, forgotten_flds) };
                        }
                    default:
                        return { fst: false, snd: zero };
                }
            case TT.JUST_TYPE:
                return { fst: subtype(t1.tt === TT.JUST_TYPE ? t1.base : t1, t2.base, cxt).fst, snd: zero };
            default:
            //falls off
        }
        //s-primdot TODO: this is not inc. right now
        /*if (t1.tt === TT.JUST_TYPE && primitive((<JustType> t1).base) && (t2.tt === (<JustType> t1).base.tt || t2.tt === TT.ANY)) {
            return { fst: true, snd: zero };
        }*/
        //default
        return { fst: false, snd: zero };
    }
    function isZeroSubtype(t1, t2) {
        var bd = subtype(t1, t2, {});
        return (bd.fst && isZero(bd.snd));
    }
    function isSubtype(t1, t2) {
        return subtype(t1, t2, {}).fst;
    }
    function isArrowSubtype(t1, t2, cxt) {
        if (!(t1.args.length === t2.args.length) || !(t1.mandatoryArgs === t2.mandatoryArgs)) {
            return false;
        }
        var sub;
        for (var i = t1.args.length; i--;) {
            sub = subtype(t2.args[i], t1.args[i], cxt);
            if (!(sub.fst && isZero(sub.snd))) {
                return false;
            }
        }
        sub = subtype(t1.result, t2.result, cxt);
        if (!(sub.fst && isZero(sub.snd))) {
            return false;
        }
        if (!((t1.varargs === undefined && t2.varargs === undefined) || (sub = subtype(t2.varargs, t1.varargs, cxt) && sub.fst && isZero(sub.snd)))) {
            return false;
        }
        return true;
    }
    function isArrowEqual(t1, t2, cxt) {
        if (!(t1.args.length === t2.args.length) || !(t1.mandatoryArgs === t2.mandatoryArgs)) {
            return false;
        }
        for (var i = t1.args.length; i--;) {
            if (!(equalTypes(t1.args[i], t2.args[i], cxt))) {
                return false;
            }
        }
        if (!(equalTypes(t1.varargs, t2.varargs, cxt))) {
            return false;
        }
        if (!(equalTypes(t1.result, t2.result, cxt))) {
            return false;
        }
        return true;
    }
    ///////////////////////////////////////////////////////////////////////////////////////////////////////////
    // Main functionality of setting, propagating and checking tags
    // exports:   
    //   shallowTag:           (o: WithRTTI, t: Delta) => WithRTTI 
    //   checkAndTag:          (v: WithRTTI, from: RTTI, to: RTTI) => WithRTTI
    //   readField:            (o: WithRTTI, from: RTTI, f:any) => WithRTTI
    //   writeField:           (o: WithRTTI, from: RTTI, f:any, v:any, tv:RTTI) => WithRTTI 
    //   callMethod:           (o: WithRTTI, from: RTTI, m:any, args:WithRTTI[], argTypes:RTTI[]) => WithRTTI
    //   createArray:          (o: any[], t: RTTI) => WithRTTI
    //   createEmptyIndexMap : (k: RTTI, v: RTTI) => WithRTTI
    ///////////////////////////////////////////////////////////////////////////////////////////////////////////    
    //We use the constant zero for Delta
    var zero = undefined;
    function isZero(d) {
        return d === zero;
    }
    // if t1 = t2 = undefined, it returns true --> some code relies on this fact
    function equalTypes(t1, t2, cxt) {
        var eqflds = function (flds1, flds2) {
            for (var f in flds1) {
                if (!flds2[f]) {
                    return false;
                }
                if (!equalTypes(flds1[f], flds2[f], cxt)) {
                    return false;
                }
            }
            for (var f in flds2) {
                if (!(flds1[f])) {
                    return false;
                }
            }
            return true;
        };
        var eqmethods = function (methods1, methods2) {
            for (var m in methods1) {
                if (!methods2[m]) {
                    return false;
                }
                if (!isArrowEqual(methods1[m], methods2[m], cxt)) {
                    return false;
                }
            }
            for (var m in methods2) {
                if (!(methods1[m])) {
                    return false;
                }
            }
            return true;
        };
        if (t1 === t2) {
            return true;
        }
        if (!(t1.tt === t2.tt)) {
            return false;
        }
        switch (t1.tt) {
            case TT.ARRAY:
                return equalTypes(t1.elt, t2.elt, cxt);
            case TT.INSTANCE:
            case TT.CLASS:
                return t1.name === t2.name;
            case TT.INTERFACE:
                if (t1.name === t2.name) {
                    return true;
                }
                if (inNamedTypeRelationRegistry(t1, t2, NameRelation.EQUALITY).fst) {
                    return true;
                }
                if (inContext(cxt, t1, t2, NameRelation.EQUALITY)) {
                    return true;
                }
                // we know t1 is an interface, and since t1.tt === t2.tt, so is t2
                var b = equalTypes(t1.structuredType, t2.structuredType, extendContext(cxt, t1, t2, NameRelation.EQUALITY));
                if (b) {
                    addToNamedTypeRelationRegistry(t1, t2, NameRelation.EQUALITY, zero);
                }
                return b;
            case TT.INDEX_MAP:
                return equalTypes(t1.key, t1.key, cxt) && equalTypes(t1.value, t1.value, cxt);
            case TT.JUST_TYPE:
                return equalTypes(t1.base, t2.base, cxt);
            case TT.STRUCTURED_TYPE:
                return eqflds(t1.fieldTable, t2.fieldTable)
                    && eqmethods(t1.methodTable, t2.methodTable);
            default:
                throw new Error("Impossible");
        }
    }
    function primitive(t) {
        var k = t.tt;
        return k === TT.NUMBER || k === TT.STRING || k === TT.BOOLEAN || k === TT.VOID;
    }
    function clone(t) {
        var new_flds = {};
        var new_methods = {};
        var key;
        var keys;
        keys = Object.getOwnPropertyNames(t.fieldTable);
        for (var i = keys.length; i--;) {
            key = keys[i];
            new_flds[key] = t.fieldTable[key];
        }
        keys = Object.getOwnPropertyNames(t.methodTable);
        for (var i = keys.length; i--;) {
            key = keys[i];
            new_methods[key] = t.methodTable[key];
        }
        return StructuredType(new_methods, new_flds);
    }
    // if t1 is immutable, it is cloned, else it is modified in place
    // callers should clone beforehand if want no mutation
    function combine(t1, t2) {
        // case when tag of an object is empty, and static type is most precise
        if (t1.tt === TT.ANY) {
            return t2;
        }
        switch (t2.tt) {
            case TT.BOOLEAN:
            case TT.STRING:
            case TT.NUMBER:
            case TT.VOID:
            case TT.INSTANCE:
            case TT.ANY:
            case TT.CLASS:
            case TT.INDEX_MAP:
            case TT.ARRAY:
                return t1;
            case TT.INTERFACE:
                switch (t1.tt) {
                    case TT.INTERFACE:
                        var sub;
                        if (t1.name === t2.name) {
                            return t1;
                        }
                        // in extends list
                        if (t1.extendsList.indexOf(t2.name) !== -1) {
                            return t1;
                        }
                        //can this ever happen ?
                        /*if (!((<InstanceRepr> registry[(<NamedType> t2).name]).extendsList.indexOf((<NamedType> t1).name) === -1)) {
                            return t2;
                        }*/
                        // in relation registry
                        if ((sub = inNamedTypeRelationRegistry(t1, t2, NameRelation.SUBTYPE)) && sub.fst) {
                            return t1;
                        }
                        return combine(t1.structuredType, t2.structuredType);
                    case TT.STRUCTURED_TYPE:
                        return combine(t1, t2.structuredType);
                    case TT.CLASS:
                    case TT.INSTANCE:
                    case TT.STRING:
                        return t1;
                    //case TT.BOOLEAN:
                    //case TT.NUMBER:
                    //case TT.ARRAY:
                    //case TT.INDEX_MAP:
                    //assert(false, "interface type " + (<NamedType>t2).name + " cannot be combined with prims, arrays, and index maps: " + prettyprint_t(t1));
                    //return t1;
                    //case TT.JUST_TYPE:
                    //case TT.VOID:
                    //assert(false, "RTTI cannot be dotted type or void");
                    //return t1;
                    //case TT.ANY: // has been checked at the beginning of the function
                    //return t2;
                    default:
                        throw new Error("Impossible");
                }
                throw new Error("Impossible");
            case TT.STRUCTURED_TYPE:
                switch (t1.tt) {
                    case TT.INSTANCE:
                    case TT.CLASS:
                        return t1; // comb(C, {M;F})
                    case TT.INTERFACE:
                        return combine(t1.structuredType, t2); // comb(I, {M;F})
                    case TT.STRUCTURED_TYPE:
                        if (t1.immutable) {
                            t1 = clone(t1);
                        }
                        var f1 = t1.fieldTable;
                        var f2 = t2.fieldTable;
                        for (var f in f2) {
                            f1[f] = f2[f];
                        }
                        var m1 = t1.methodTable;
                        var m2 = t2.methodTable;
                        for (var m in m2) {
                            if (m1[m]) { // cannot eliminate if, do away with the subtyping check in the final version
                                //assert(isArrowSubtype(m1[m], m2[m], {}), "combine for structured types, invalid method overlap");
                            }
                            else {
                                m1[m] = m2[m];
                            }
                        }
                        return t1; //comb({M1;F1}, {M2;F2})
                    //case TT.NUMBER:
                    //case TT.STRING:
                    //case TT.VOID:
                    //case TT.BOOLEAN:
                    //assert(false, "combine structured type on a primtive type");
                    //return t1;
                    //case TT.ARRAY:
                    //case TT.INDEX_MAP:
                    //assert(false, "combine structured type on arrays or index maps");
                    //return t1;
                    //case TT.JUST_TYPE:
                    //case TT.ANY: // has been checked at the beginning of the function
                    //assert(false, "RTTI cannot be any/just type");
                    //return t1;
                    default:
                        throw new Error("Impossible");
                }
            //case TT.JUST_TYPE:
            //assert(false, "combine with just types is not defined");
            //return t1;
            default:
                throw new Error("Impossible");
        }
        throw new Error("Impossible"); // never reach here
    }
    function shallowTagSwap(t, o) {
        return shallowTag(o, t);
    }
    RT.shallowTagSwap = shallowTagSwap;
    // called at each application of subtyping
    function shallowTag(o, t) {
        if (!o || !t) { //shallowTag (T, undefined, t) = T, undefined, o === null, o === 0, t === zero
            return o;
        }
        var t_o;
        switch (t.tt) {
            case TT.ANY:
            //return o; // shallowTag(T, v, any)
            case TT.INSTANCE:
            //assert(isZeroSubtype(t_o, t), "shallowTag on instance types fails subtyping side-condition");
            //return o; // shallowTag(T, v, C)
            case TT.NUMBER:
            case TT.STRING:
            case TT.BOOLEAN:
            case TT.VOID:
                //assert(t_o.tt === t.tt, "shallowTag on primitive type mismatch");
                return o; // shallowTag(T, v, c)
            case TT.ARRAY:
            case TT.INDEX_MAP:
            case TT.CLASS:
                //t_o = o.__rtti__ || Any;
                //assert(t_o === Any || equalTypes(t_o, t, {}), "shallowTag on array and index map assumes no or same RTTI");
                //(t_o  !== Any) || (o.__rtti__ = t);
                o.__rtti__ = t;
                return o;
            case TT.INTERFACE:
            case TT.STRUCTURED_TYPE:
                t_o = o.__rtti__ || RT.Any;
                if (t_o.tt === TT.INSTANCE || t_o.tt === TT.INTERFACE) { // for class types, no change of tag
                    return o;
                }
                o.__rtti__ = combine(t_o, t);
                return o;
            //case TT.JUST_TYPE:
            //assert(false, "shallowTag with Just types not defined");
            //return o;
            default:
                throw new Error("Impossible");
        }
        throw new Error("Impossible"); // never reach here
    }
    RT.shallowTag = shallowTag;
    function checkInstance(v, to) {
        if (v === undefined || v === null) {
            return { fst: true, snd: v };
        }
        var t_v = v.__rtti__ || RT.Any;
        if (t_v.name == to.name) {
            return { fst: true, snd: v };
        }
        if (v instanceof to.functionObject) {
            return { fst: true, snd: v };
        }
        return { fst: false, snd: undefined };
    }
    RT.checkInstance = checkInstance;
    function checkAndTag(v, from, to) {
        if (v === undefined || v === null) { // setTag(T, undefined, _, _)
            return v;
        }
        var t_v = v.__rtti__ || RT.Any;
        if (from.tt === TT.JUST_TYPE || from.tt === TT.UN) {
            throw new Error("checkAndTag from dot or un");
        }
        // undotted from
        switch (to.tt) {
            case TT.BOOLEAN:
            case TT.NUMBER:
            case TT.STRING:
            case TT.VOID:
                if (t_v !== to) {
                    throw new Error("checkAndTag for primitive types mismatch: " + prettyprint_t(t_v) + " !== " + prettyprint_t(to));
                }
                return v; // setTag(T, v, _, c)
            case TT.ANY:
                // @ts-expect-error MD typecheck error
                if (from.tt === TT.JUST_TYPE) {
                    throw new Error("checkAndTag to any undotted from check failure: " + prettyprint_t(from)); // setTag(T, v, from, any);
                }
                return v;
            case TT.INSTANCE:
                if (t_v.name === to.name) {
                    return v;
                }
                if (!(v instanceof to.functionObject)) {
                    throw new Error("checkAndTag to instance type " + to.name + " instanceof check failed, it's a " + prettyprint_t(t_v));
                }
                return v;
            case TT.ARRAY:
            case TT.CLASS:
            case TT.INDEX_MAP:
                t_v = t_v === RT.Any ? from : t_v; // for these types one of tag or static is precise
                if (!(equalTypes(t_v, to, {}))) {
                    throw new Error("checkAndTag to fixed type failure: " + prettyprint_t(combine(t_v, from)) + " </: " + prettyprint_t(to));
                }
                return v;
            case TT.INTERFACE:
                switch (t_v.tt) {
                    // optimize just for instances and interfaces
                    case TT.INSTANCE:
                        if (!(isZeroSubtype(t_v, to))) {
                            throw new Error("checkAndTag to interface for a class instance must be subtype: " + prettyprint_t(t_v) + " </: " + prettyprint_t(to));
                        }
                        return v;
                    case TT.INTERFACE:
                        var sub;
                        if (t_v.name === to.name) {
                            return v;
                        }
                        // in extends list
                        if (t_v.extendsList.indexOf(to.name) !== -1) {
                            return v;
                        }
                        //TODO: can this ever happen ?
                        /*if (!((<InstanceRepr> registry[(<NamedType> t2).name]).extendsList.indexOf((<NamedType> t1).name) === -1)) {
                            return t2;
                        }*/
                        // in relation registry
                        if ((sub = inNamedTypeRelationRegistry(t_v, to, NameRelation.SUBTYPE)) && sub.fst) {
                            return v;
                        }
                        return checkAndTag(v, from, to.structuredType); // setTag(T, v, _, I)
                    default:
                        return checkAndTag(v, from, to.structuredType); // setTag(T, v, _, I)
                }
                throw new Error("Impossible");
            case TT.STRUCTURED_TYPE:
                var curr = t_v.tt === TT.STRUCTURED_TYPE ? combine(clone(t_v), from) : combine(t_v, from); // clone first
                var sub = subtype(curr, to, {});
                if (sub.fst) { // setTag(T, v, t, {M;F}) when comb(tag_T(v), t) <: {M;F}
                    return shallowTag(v, sub.snd);
                }
                // go deep, will mutate tag of v, setTag(T, v, t, {M;F}), toStruct is defined for instances and classes too, so exclude them
                if ((t_v.tt === TT.INSTANCE) || (t_v.tt === TT.CLASS)) {
                    throw new Error("checkAndTag to structured type from a fixed type failure: " + prettyprint_t(t_v) + " being tagged to: " + prettyprint_t(to));
                }
                var to_flds = to.fieldTable;
                var overlapping_flds = {};
                var new_flds = {};
                for (var f in to_flds) {
                    if (curr.fieldTable[f]) {
                        if (!(equalTypes(curr.fieldTable[f], to_flds[f], {}))) {
                            throw new Error("checkAndTag to structured type field overlapping failure: " + prettyprint_t(curr.fieldTable[f]) + " != " +
                                prettyprint_t(to_flds[f]));
                        }
                        overlapping_flds[f] = to_flds[f];
                    }
                    else {
                        new_flds[f] = to_flds[f];
                    }
                }
                sub = subtype(curr, StructuredType(to.methodTable, overlapping_flds), {});
                if (!(sub.fst)) {
                    throw new Error("checkAndTag to structured type subtyping from combine failure: " + prettyprint_t(curr) + " </: " +
                        StructuredType(to.methodTable, overlapping_flds));
                }
                shallowTag(v, sub.snd);
                v.__rtti__ = combine((v.__rtti__ || RT.Any) /* t_v is stale at this point */, StructuredType({}, new_flds)); // add new_flds in RTTI tentatively
                for (f in new_flds) { // go deep
                    checkAndTag(v[f], RT.Any, new_flds[f]);
                }
                return v;
            case TT.JUST_TYPE:
                return checkAndTag(v, from, to.base);
            default:
                throw new Error("Impossible"); // handles Un
        }
    }
    RT.checkAndTag = checkAndTag;
    function getFieldTypeOptim(t /* RTTI or ArrowType or undefined */, o, f) {
        if (t) {
            //t is not undefined, it better not be an arrow type
            if (t.tt === undefined || t.tt === TT.JUST_TYPE) {
                throw new Error("readFieldOptim reading a method or field with dot type: " + prettyprint_t(t));
            }
            return t;
        }
        else {
            //t is undefined, if o is an index map, need to return the elt type
            t = o.__rtti__;
            if (t.tt === TT.INDEX_MAP) {
                if (t.key.tt === TT.NUMBER) {
                    throw new Error("readFieldOptim index map index is number");
                }
                else {
                    t = t.value;
                    if (t.tt === TT.JUST_TYPE) {
                        throw new Error("readFieldOptim index map value type dotted");
                    }
                    else {
                        return t;
                    }
                }
            }
            else {
                return RT.Any;
            }
        }
    }
    RT.getFieldTypeOptim = getFieldTypeOptim;
    //the translation of a source dynamic read(o:t_o)[f]
    function readField(o, from, f) {
        if (!o) { // this check will fail for 0 too, but read from 0 is not allowed nevertheless
            throw new Error("readField reading from undefined/null");
        }
        var t_o = o.__rtti__ || RT.Any;
        var tt = t_o.tt;
        var t = tt === TT.ANY ? from : t_o;
        var t1;
        var fname = f + "";
        switch (t.tt) {
            //For instance and interface, we need to lookup only t.
            //for instances, t_o is not Any, and so, t = t_o in which case, static type from cannot be any more informative
            //for interfaces, either t = t_o which if an interface is most precise, else, t_o = any and t = from, in which case t_o is already any, hence t is most precise
            case TT.INTERFACE:
            case TT.INSTANCE:
            case TT.CLASS:
                t1 = t.fieldTable[fname];
                if (t1 === undefined) {
                    if (t.methodTable[fname] || RT.objectMethods[fname]) {
                        throw new Error("readField reading method (instance and interface)");
                    }
                    t1 = RT.Any;
                }
                else if (t1.tt === TT.JUST_TYPE || t1.tt === TT.UN) {
                    throw new Error("readField from interface / instance reading dot type/un field");
                }
                return shallowTag(o[fname], t1);
            case TT.STRING:
                if (fname === "length") {
                    return o.length;
                }
                throw new Error("reading a field other than length from string: " + fname);
            //For arrays and index maps, we only need to consider t (either their tag is Any and static is precise, or tag is precise)
            case TT.ARRAY:
                if (fname === "length") {
                    return o.length;
                }
                t1 = t.elt;
                if (t1.tt === TT.JUST_TYPE || t1.tt === TT.UN) {
                    throw new Error("array readField elt type is dotted/un: " + prettyprint_t(t1));
                }
                return shallowTag(o[checkAndTag(f, RT.Any, RT.Num)], t1);
            case TT.STRUCTURED_TYPE:
                t1 = t.fieldTable[fname] || from.fieldTable[fname];
                if (t1 === undefined) {
                    if (t.methodTable[fname] || from.methodTable[fname] || RT.objectMethods[fname]) {
                        throw new Error("readField struct types reading method");
                    }
                    t1 = RT.Any;
                }
                else if (t1.tt === TT.JUST_TYPE || t1.tt === TT.UN) {
                    throw new Error("readField from struct reading dot/un type field");
                }
                return shallowTag(o[fname], t1);
            case TT.ANY:
                return o[fname];
            case TT.INDEX_MAP:
                tt = t.key.tt;
                t1 = t.value;
                if (t1.tt === TT.JUST_TYPE || t1.tt === TT.UN) {
                    throw new Error("indexMap readField value type not a subtype of any: " + prettyprint_t(t1));
                }
                if (tt === TT.NUMBER) {
                    return shallowTag(o[checkAndTag(f, RT.Any, RT.Num)], t1);
                }
                else {
                    if (RT.objectMethods[fname]) {
                        throw new Error("readField for indexMap reading Object method: " + fname);
                    }
                    return shallowTag(o[fname], t1);
                }
        }
        throw new Error("Impossible");
    }
    RT.readField = readField;
    //the translation of a source dynamic write (o:t_o)[f] = (v:t_v)
    function writeField(o, from, f, v, tv) {
        if (!o) { // this check will fail for 0 too, but write to 0 is not allowed nevertheless
            throw new Error("writeField writing to undefined/null");
        }
        var t_o = o.__rtti__ || RT.Any;
        var tt = t_o.tt;
        var t = tt === TT.ANY ? from : t_o;
        var t1;
        var fname = f + "";
        switch (t.tt) {
            //For instance and interface, we need to lookup only t.
            //for instances, t_o is not Any, and so, t = t_o in which case, static type from cannot be any more informative
            //for interfaces, either t = t_o which if an interface is most precise, else, t_o = any and t = from, in which case t_o is already any, hence t is most precise
            case TT.INTERFACE:
            case TT.INSTANCE:
            case TT.CLASS:
                t1 = t.fieldTable[fname];
                if (t1 === undefined) {
                    if (t.methodTable[fname] || RT.objectMethods[fname]) {
                        throw new Error("writeField writing method (instance and interface)");
                    }
                    t1 = RT.Any;
                    //TODO: no need to checkAndTag here as tv is undotted, not un ... confirm
                }
                else if (t1.tt === TT.JUST_TYPE || t1.tt === TT.UN) {
                    throw new Error("readField from interface / instance reading dot/un type field");
                }
                else {
                    v = checkAndTag(v, tv, t1);
                }
                return (o[fname] = v);
            case TT.ARRAY:
                if (fname === "length") {
                    return (o.length = v);
                }
                if (f === undefined || f === null || f.__rtti__ !== RT.Num) {
                    throw new Error("array writeField f can only be Num");
                }
                t1 = t.elt;
                if (t1.tt === TT.JUST_TYPE || t1.tt === TT.UN) {
                    throw new Error("array writeField elt type is dotted/un: " + prettyprint_t(t1));
                }
                else {
                    v = checkAndTag(v, tv, t1);
                }
                return (o[f] = v);
            case TT.STRUCTURED_TYPE:
                t1 = t.fieldTable[fname] || from.fieldTable[fname];
                if (t1 === undefined) {
                    if (t.methodTable[fname] || from.methodTable[fname] || RT.objectMethods[fname]) {
                        throw new Error("writeField struct types writing method");
                    }
                    t1 = RT.Any;
                    //no need to checkAndTag here as tv is undotted/not un ...
                }
                else if (t1.tt === TT.JUST_TYPE || t1.tt === TT.UN) {
                    throw new Error("writeField from struct writing dot/un type field");
                }
                else {
                    v = checkAndTag(v, tv, t1);
                }
                return (o[fname] = v);
            case TT.ANY:
                return (o[fname] = v);
            case TT.INDEX_MAP:
                tt = t.key.tt;
                t1 = t.value;
                if (t1.tt === TT.JUST_TYPE || t1.tt === TT.UN) {
                    throw new Error("indexMap writeField value type is dotted/un: " + prettyprint_t(t1));
                }
                else {
                    v = checkAndTag(v, tv, t1);
                }
                if (tt === TT.NUMBER) {
                    if (f === undefined || f === null || f.__rtti__ !== RT.Num) {
                        throw new Error("Indexmap writeField number index error");
                    }
                    return (o[f] = v);
                }
                else {
                    if (RT.objectMethods[fname]) {
                        throw new Error("writeField for indexMap writing Object method: " + fname);
                    }
                    return (o[fname] = v);
                }
        }
        throw new Error("Impossible");
    }
    RT.writeField = writeField;
    function resolveMethod(o, from, mname) {
        if (!o && (o === null || o === undefined)) {
            throw new Error("resolveMethod for undefined/null");
        }
        var t_o = o.__rtti__ || RT.Any;
        return t_o.methodTable[mname] || RT.objectMethods[mname] || from.methodTable[mname];
    }
    //the translation of a source dynamic method call (o:t_o)[m](args[]:t_args[])
    //assume args.length === argTypes.length
    function callMethod(o, from, m, args, argTypes) {
        //TODO: assume no callMethod on dotted type
        //assert(from.tt !== TT.JUST_TYPE, "RT does not handle callMethod from just types");
        if (!o && (o === null || o === undefined)) {
            throw new Error("callMethod calling from undefined/null");
        }
        var t_o = o.__rtti__ || RT.Any;
        // this variable checks for String, Array, and IndexMap, which have the property that either tag or static type is most precise
        var t = from.tt === TT.ANY ? t_o : from; // take the more precise one of tag and static
        var mname = m + "";
        var t1 = resolveMethod(o, from, mname);
        if (t1 === undefined) {
            return callFunction(readField(o, from, m), RT.Any /* readField gives type Any */, args, argTypes);
        }
        if (t1.result.tt === TT.JUST_TYPE || t1.result.tt === TT.UN) {
            throw new Error("callMethod return type is not a subtype of any: " + prettyprint_t(t1.result));
        }
        // check args
        if (t1.mandatoryArgs === undefined && args.length !== t1.args.length) { // all arguments mandatory
            throw new Error("callMethod did not provide all mandatory arguments");
        }
        else if (args.length < t1.mandatoryArgs) {
            throw new Error("callMethod did not provide all mandatory arguments(2)");
        }
        var i;
        var length = t1.args.length;
        for (i = 0; i < length; ++i) {
            checkAndTag(args[i], argTypes[i], t1.args[i]); // if args array overflows, it will be undefined whose checkAndTag will succeed
        }
        // check optional args
        if (args.length > i) {
            if (t1.varargs === undefined) {
                throw new Error("callMethod extra arguments provided to a non variadic method call");
            }
            for (; i < args.length; ++i) {
                checkAndTag(args[i], argTypes[i], t1.varargs);
            }
        }
        switch (args.length) {
            case 0:
                return shallowTag(o[mname](), t1.result);
            case 1:
                return shallowTag(o[mname](args[0]), t1.result);
            case 2:
                return shallowTag(o[mname](args[0], args[1]), t1.result);
            case 3:
                return shallowTag(o[mname](args[0], args[1], args[2]), t1.result);
            case 4:
                return shallowTag(o[mname](args[0], args[1], args[2], args[3]), t1.result);
            case 5:
                return shallowTag(o[mname](args[0], args[1], args[2], args[3], args[4]), t1.result);
            case 6:
                return shallowTag(o[mname](args[0], args[1], args[2], args[3], args[4], args[5]), t1.result);
            case 7:
                return shallowTag(o[mname](args[0], args[1], args[2], args[3], args[4], args[5], args[6]), t1.result);
            case 8:
                return shallowTag(o[mname](args[0], args[1], args[2], args[3], args[4], args[5], args[6], args[7]), t1.result);
            case 9:
                return shallowTag(o[mname](args[0], args[1], args[2], args[3], args[4], args[5], args[6], args[7], args[8]), t1.result);
            case 10:
                return shallowTag(o[mname](args[0], args[1], args[2], args[3], args[4], args[5], args[6], args[7], args[8], args[9]), t1.result);
            default:
                throw new Error("callMethod only defined for upto 10 arguments");
        }
        throw new Error("Impossible"); // unreachable
    }
    RT.callMethod = callMethod;
    function checkMethodArgs(o, from, m, args, argTypes) {
        if (!o && (o === null || o === undefined)) {
            throw new Error("checkMethodArgs calling from undefined/null");
        }
        var t1 = resolveMethod(o, from, m);
        if (t1 === undefined) {
            return checkFunctionArgs(readField(o, from, m), args, argTypes);
        }
        if (t1.result.tt === TT.JUST_TYPE || t1.result.tt === TT.UN) {
            throw new Error("checkMethodArgs return type is not a subtype of any: " + prettyprint_t(t1.result));
        }
        // check args
        if (t1.mandatoryArgs === undefined && args.length !== t1.args.length) { // all arguments mandatory
            throw new Error("checkMethodArgs did not provide all mandatory arguments");
        }
        else if (args.length < t1.mandatoryArgs) {
            throw new Error("checkMethodArgs did not provide all mandatory arguments(2)");
        }
        var i;
        var length = t1.args.length;
        for (i = 0; i < length; ++i) {
            checkAndTag(args[i], argTypes[i], t1.args[i]); // if args array overflows, it will be undefined whose checkAndTag will succeed
        }
        // check optional args
        if (args.length > i) {
            if (t1.varargs === undefined) {
                throw new Error("checkMethodArgs extra arguments provided to a non variadic method call");
            }
            for (; i < args.length; ++i) {
                checkAndTag(args[i], argTypes[i], t1.varargs);
            }
        }
        return t1.result;
    }
    RT.checkMethodArgs = checkMethodArgs;
    function checkMethodArgs0(o, from, m) {
        var t1 = resolveMethod(o, from, m);
        if (t1 === undefined) {
            return checkFunctionArgs0(readField(o, from, m));
        }
        if (t1.result.tt === TT.JUST_TYPE || t1.result.tt === TT.UN) {
            throw new Error("checkMethodArgs0 return type is not a subtype of any: " + prettyprint_t(t1.result));
        }
        // check args
        if (t1.mandatoryArgs) { // non-zero or not undefined
            throw new Error("checkMethodArgs0 did not provide all mandatory arguments");
        }
        return t1.result;
    }
    RT.checkMethodArgs0 = checkMethodArgs0;
    function checkMethodArgs1(o, from, m, arg1, argType1) {
        var t1 = resolveMethod(o, from, m);
        if (t1 === undefined) {
            return checkFunctionArgs1(readField(o, from, m), arg1, argType1);
        }
        if (t1.result.tt === TT.JUST_TYPE || t1.result.tt === TT.UN) {
            throw new Error("checkMethodArgs1 return type is not a subtype of any: " + prettyprint_t(t1.result));
        }
        // check args
        if (t1.mandatoryArgs > 1) { //undefined > 1 = false
            throw new Error("checkMethodArgs1 did not provide all mandatory arguments");
        }
        if (t1.args.length > 0) {
            checkAndTag(arg1, argType1, t1.args[0]);
        }
        else {
            var varargs_t = t1.varargs;
            if (varargs_t === undefined) {
                throw new Error("checkMethodArgs1 extra arguments provided to a non variadic method call");
            }
            checkAndTag(arg1, argType1, varargs_t);
        }
        return t1.result;
    }
    RT.checkMethodArgs1 = checkMethodArgs1;
    function checkMethodArgs2(o, from, m, arg1, arg2, argType1, argType2) {
        var t1 = resolveMethod(o, from, m);
        if (t1 === undefined) {
            //TODO: readField is reading from m, which means stateful toString on m might fail
            return checkFunctionArgs2(readField(o, from, m), arg1, arg2, argType1, argType2);
        }
        if (t1.result.tt === TT.JUST_TYPE || t1.result.tt === TT.UN) {
            throw new Error("checkMethodArgs2 return type is not a subtype of any: " + prettyprint_t(t1.result));
        }
        // check args
        if (t1.mandatoryArgs > 2) { //undefined > 2 = false
            throw new Error("checkMethodArgs2 did not provide all mandatory arguments");
        }
        var varargs_t;
        switch (t1.args.length) {
            case 0:
                varargs_t = t1.varargs;
                if (varargs_t === undefined) {
                    throw new Error("checkMethodArgs2 extra arguments provided to a non variadic method call");
                }
                checkAndTag(arg1, argType1, varargs_t);
                checkAndTag(arg2, argType2, varargs_t);
                break;
            case 1:
                varargs_t = t1.varargs;
                if (varargs_t === undefined) {
                    throw new Error("checkMethodArgs2 extra arguments provided to a non variadic method call");
                }
                checkAndTag(arg1, argType1, t1.args[0]);
                checkAndTag(arg2, argType2, varargs_t);
                break;
            case 2:
                checkAndTag(arg1, argType1, t1.args[0]);
                checkAndTag(arg2, argType2, t1.args[1]);
                break;
            default:
                throw new Error("Impossible");
        }
        return t1.result;
    }
    RT.checkMethodArgs2 = checkMethodArgs2;
    function checkMethodArgs3(o, from, m, arg1, arg2, arg3, argType1, argType2, argType3) {
        return checkMethodArgs(o, from, m, [arg1, arg2, arg3], [argType1, argType2, argType3]);
    }
    RT.checkMethodArgs3 = checkMethodArgs3;
    function checkMethodArgs4(o, from, m, arg1, arg2, arg3, arg4, argType1, argType2, argType3, argType4) {
        return checkMethodArgs(o, from, m, [arg1, arg2, arg3, arg4], [argType1, argType2, argType3, argType4]);
    }
    RT.checkMethodArgs4 = checkMethodArgs4;
    function checkMethodArgs5(o, from, m, arg1, arg2, arg3, arg4, arg5, argType1, argType2, argType3, argType4, argType5) {
        return checkMethodArgs(o, from, m, [arg1, arg2, arg3, arg4, arg5], [argType1, argType2, argType3, argType4, argType5]);
    }
    RT.checkMethodArgs5 = checkMethodArgs5;
    function checkMethodArgs6(o, from, m, arg1, arg2, arg3, arg4, arg5, arg6, argType1, argType2, argType3, argType4, argType5, argType6) {
        return checkMethodArgs(o, from, m, [arg1, arg2, arg3, arg4, arg5, arg6], [argType1, argType2, argType3, argType4, argType5, argType6]);
    }
    RT.checkMethodArgs6 = checkMethodArgs6;
    function checkFunctionArgs(o, args, argTypes) {
        if (!o && (o === null || o === undefined)) {
            throw new Error("checkFunctionArgs calling from undefined/null");
        }
        var t_o = o.__rtti__ || RT.Any;
        var t1 = t_o.methodTable["<call>"];
        if (t1 === undefined) {
            throw new Error("checkFunctionArgs <call> method not found");
        }
        if (t1.result.tt === TT.JUST_TYPE || t1.result.tt === TT.UN) {
            throw new Error("checkFunctionArgs return type is not a subtype of any: " + prettyprint_t(t1.result));
        }
        // check args
        if (t1.mandatoryArgs === undefined && args.length !== t1.args.length) { // all arguments mandatory
            throw new Error("checkFunctionArgs did not provide all mandatory arguments");
        }
        else if (args.length < t1.mandatoryArgs) {
            throw new Error("checkFunctionArgs did not provide all mandatory arguments(2)");
        }
        var i;
        var length = t1.args.length;
        for (i = 0; i < length; ++i) {
            checkAndTag(args[i], argTypes[i], t1.args[i]); // if args array overflows, it will be undefined whose checkAndTag will succeed
        }
        // check optional args
        if (args.length > i) {
            if (t1.varargs === undefined) {
                throw new Error("checkFunctionArgs extra arguments provided to a non variadic method call");
            }
            for (; i < args.length; ++i) {
                checkAndTag(args[i], argTypes[i], t1.varargs);
            }
        }
        return t1.result;
    }
    RT.checkFunctionArgs = checkFunctionArgs;
    function checkFunctionArgs0(o) {
        return checkFunctionArgs(o, [], []);
    }
    RT.checkFunctionArgs0 = checkFunctionArgs0;
    function checkFunctionArgs1(o, arg1, argType1) {
        return checkFunctionArgs(o, [arg1], [argType1]);
    }
    RT.checkFunctionArgs1 = checkFunctionArgs1;
    function checkFunctionArgs2(o, arg1, arg2, argType1, argType2) {
        return checkFunctionArgs(o, [arg1, arg2], [argType1, argType2]);
    }
    RT.checkFunctionArgs2 = checkFunctionArgs2;
    function checkFunctionArgs3(o, arg1, arg2, arg3, argType1, argType2, argType3) {
        return checkFunctionArgs(o, [arg1, arg2, arg3], [argType1, argType2, argType3]);
    }
    RT.checkFunctionArgs3 = checkFunctionArgs3;
    function checkFunctionArgs4(o, arg1, arg2, arg3, arg4, argType1, argType2, argType3, argType4) {
        return checkFunctionArgs(o, [arg1, arg2, arg3, arg4], [argType1, argType2, argType3, argType4]);
    }
    RT.checkFunctionArgs4 = checkFunctionArgs4;
    function checkFunctionArgs5(o, arg1, arg2, arg3, arg4, arg5, argType1, argType2, argType3, argType4, argType5) {
        return checkFunctionArgs(o, [arg1, arg2, arg3, arg4, arg5], [argType1, argType2, argType3, argType4, argType5]);
    }
    RT.checkFunctionArgs5 = checkFunctionArgs5;
    function checkFunctionArgs6(o, arg1, arg2, arg3, arg4, arg5, arg6, argType1, argType2, argType3, argType4, argType5, argType6) {
        return checkFunctionArgs(o, [arg1, arg2, arg3, arg4, arg5, arg6], [argType1, argType2, argType3, argType4, argType5, argType6]);
    }
    RT.checkFunctionArgs6 = checkFunctionArgs6;
    function callMethod0(o, from, m) {
        var mname = m + "";
        var t1 = resolveMethod(o, from, mname);
        if (t1 === undefined) {
            //TODO: readField is reading from m, which means stateful toString on m might fail
            return callFunction0(readField(o, from, m), RT.Any /* readField gives type Any */);
        }
        if (t1.result.tt === TT.JUST_TYPE || t1.result.tt === TT.UN) {
            throw new Error("callMethod0 return type is not a subtype of any: " + prettyprint_t(t1.result));
        }
        // check args
        if (t1.mandatoryArgs) { // non-zero or not undefined
            throw new Error("callMethod0 did not provide all mandatory arguments");
        }
        return shallowTag(o[mname](), t1.result);
    }
    RT.callMethod0 = callMethod0;
    function callMethod1(o, from, m, arg1, argType1) {
        var mname = m + "";
        var t1 = resolveMethod(o, from, mname);
        if (t1 === undefined) {
            //TODO: readField is reading from m, which means stateful toString on m might fail
            return callFunction1(readField(o, from, m), RT.Any /* readField gives type Any */, arg1, argType1);
        }
        if (t1.result.tt === TT.JUST_TYPE || t1.result.tt === TT.UN) {
            throw new Error("callMethod1 return type is not a subtype of any: " + prettyprint_t(t1.result));
        }
        // check args
        if (t1.mandatoryArgs > 1) { //undefined > 1 = false
            throw new Error("callMethod1 did not provide all mandatory arguments");
        }
        if (t1.args.length > 0) {
            checkAndTag(arg1, argType1, t1.args[0]);
        }
        else {
            var varargs_t = t1.varargs;
            if (varargs_t === undefined) {
                throw new Error("callMethod1 extra arguments provided to a non variadic method call");
            }
            checkAndTag(arg1, argType1, varargs_t);
        }
        return shallowTag(o[mname](arg1), t1.result);
    }
    RT.callMethod1 = callMethod1;
    function callMethod2(o, from, m, arg1, arg2, argType1, argType2) {
        var mname = m + "";
        var t1 = resolveMethod(o, from, mname);
        if (t1 === undefined) {
            //TODO: readField is reading from m, which means stateful toString on m might fail
            return callFunction2(readField(o, from, m), RT.Any /* readField gives type Any */, arg1, arg2, argType1, argType2);
        }
        if (t1.result.tt === TT.JUST_TYPE || t1.result.tt === TT.UN) {
            throw new Error("callMethod2 return type is not a subtype of any: " + prettyprint_t(t1.result));
        }
        // check args
        if (t1.mandatoryArgs > 2) { //undefined > 2 = false
            throw new Error("callMethod2 did not provide all mandatory arguments");
        }
        var varargs_t;
        switch (t1.args.length) {
            case 0:
                varargs_t = t1.varargs;
                if (varargs_t === undefined) {
                    throw new Error("callMethod2 extra arguments provided to a non variadic method call");
                }
                checkAndTag(arg1, argType1, varargs_t);
                checkAndTag(arg2, argType2, varargs_t);
                break;
            case 1:
                varargs_t = t1.varargs;
                if (varargs_t === undefined) {
                    throw new Error("callMethod2 extra arguments provided to a non variadic method call");
                }
                checkAndTag(arg1, argType1, t1.args[0]);
                checkAndTag(arg2, argType2, varargs_t);
                break;
            case 2:
                checkAndTag(arg1, argType1, t1.args[0]);
                checkAndTag(arg2, argType2, t1.args[1]);
                break;
            default:
                throw new Error("Impossible");
        }
        return shallowTag(o[mname](arg1, arg2), t1.result);
    }
    RT.callMethod2 = callMethod2;
    function callMethod3(o, from, m, arg1, arg2, arg3, argType1, argType2, argType3) {
        var mname = m + "";
        var t1 = resolveMethod(o, from, mname);
        if (t1 === undefined) {
            //TODO: readField is reading from m, which means stateful toString on m might fail
            return callFunction3(readField(o, from, m), RT.Any /* readField gives type Any */, arg1, arg2, arg3, argType1, argType2, argType3);
        }
        if (t1.result.tt === TT.JUST_TYPE || t1.result.tt === TT.UN) {
            throw new Error("callMethod3 return type is not a subtype of any: " + prettyprint_t(t1.result));
        }
        // check args
        if (t1.mandatoryArgs > 3) { //undefined > 3 = false
            throw new Error("callMethod3 did not provide all mandatory arguments");
        }
        var varargs_t;
        switch (t1.args.length) {
            case 0:
                varargs_t = t1.varargs;
                if (varargs_t === undefined) {
                    throw new Error("callMethod3 extra arguments provided to a non variadic method call");
                }
                checkAndTag(arg1, argType1, varargs_t);
                checkAndTag(arg2, argType2, varargs_t);
                checkAndTag(arg3, argType3, varargs_t);
                break;
            case 1:
                varargs_t = t1.varargs;
                if (varargs_t === undefined) {
                    throw new Error("callMethod3 extra arguments provided to a non variadic method call");
                }
                checkAndTag(arg1, argType1, t1.args[0]);
                checkAndTag(arg2, argType2, varargs_t);
                checkAndTag(arg3, argType3, varargs_t);
                break;
            case 2:
                varargs_t = t1.varargs;
                if (varargs_t === undefined) {
                    throw new Error("callMethod3 extra arguments provided to a non variadic method call");
                }
                checkAndTag(arg1, argType1, t1.args[0]);
                checkAndTag(arg2, argType2, t1.args[1]);
                checkAndTag(arg3, argType3, varargs_t);
                break;
            case 3:
                checkAndTag(arg1, argType1, t1.args[0]);
                checkAndTag(arg2, argType2, t1.args[1]);
                checkAndTag(arg3, argType3, t1.args[2]);
                break;
            default:
                throw new Error("Impossible");
        }
        return shallowTag(o[mname](arg1, arg2, arg3), t1.result);
    }
    RT.callMethod3 = callMethod3;
    function callMethod4(o, from, m, arg1, arg2, arg3, arg4, argType1, argType2, argType3, argType4) {
        return callMethod(o, from, m, [arg1, arg2, arg3, arg4], [argType1, argType2, argType3, argType4]);
    }
    RT.callMethod4 = callMethod4;
    function callMethod5(o, from, m, arg1, arg2, arg3, arg4, arg5, argType1, argType2, argType3, argType4, argType5) {
        return callMethod(o, from, m, [arg1, arg2, arg3, arg4, arg5], [argType1, argType2, argType3, argType4, argType5]);
    }
    RT.callMethod5 = callMethod5;
    function callMethod6(o, from, m, arg1, arg2, arg3, arg4, arg5, arg6, argType1, argType2, argType3, argType4, argType5, argType6) {
        return callMethod(o, from, m, [arg1, arg2, arg3, arg4, arg5, arg6], [argType1, argType2, argType3, argType4, argType5, argType6]);
    }
    RT.callMethod6 = callMethod6;
    //the translation of a source dynamic call (o:t_o)(args[]:t_args[])
    function callFunction(o, t_o, args, t_args) {
        //TODO: assume no callFunction on dotted type
        //assert(from.tt !== TT.JUST_TYPE, "RT does not handle callFunction from just types");
        if (!o && (o === null || o === undefined)) {
            throw new Error("callFunction calling from undefined/null");
        }
        var t1 = (o.__rtti__ && o.__rtti__.methodTable["<call>"]) || t_o.methodTable["<call>"];
        if (t1 === undefined) {
            throw new Error("callFunction <call> method not found");
        }
        if (t1.result.tt === TT.JUST_TYPE || t1.result.tt === TT.UN) {
            throw new Error("callFunction return type is not a subtype of any: " + prettyprint_t(t1.result));
        }
        // check args
        if (t1.mandatoryArgs === undefined && args.length !== t1.args.length) { // all arguments mandatory
            throw new Error("callFunction did not provide all mandatory arguments");
        }
        else if (args.length < t1.mandatoryArgs) {
            throw new Error("callFunction did not provide all mandatory arguments(2)");
        }
        var i;
        var length = t1.args.length;
        for (i = 0; i < length; ++i) {
            checkAndTag(args[i], t_args[i], t1.args[i]); // if args array overflows, it will be undefined whose checkAndTag will succeed
        }
        // check optional args
        if (args.length > i) {
            if (t1.varargs === undefined) {
                throw new Error("callFunction extra arguments provided to a non variadic method call");
            }
            for (; i < args.length; ++i) {
                checkAndTag(args[i], t_args[i], t1.varargs);
            }
        }
        if (args.length == 0) {
            return shallowTag(o(), t1.result);
        }
        else if (args.length == 1) {
            return shallowTag(o(args[0]), t1.result);
        }
        else if (args.length == 2) {
            return shallowTag(o(args[0], args[1]), t1.result);
        }
        else if (args.length == 3) {
            return shallowTag(o(args[0], args[1], args[2]), t1.result);
        }
        else if (args.length == 4) {
            return shallowTag(o(args[0], args[1], args[2], args[3]), t1.result);
        }
        else if (args.length == 5) {
            return shallowTag(o(args[0], args[1], args[2], args[3], args[4]), t1.result);
        }
        else if (args.length == 6) {
            return shallowTag(o(args[0], args[1], args[2], args[3], args[4], args[5]), t1.result);
        }
        else if (args.length == 7) {
            return shallowTag(o(args[0], args[1], args[2], args[3], args[4], args[5], args[6]), t1.result);
        }
        else if (args.length == 8) {
            return shallowTag(o(args[0], args[1], args[2], args[3], args[4], args[5], args[6], args[7]), t1.result);
        }
        else if (args.length == 9) {
            return shallowTag(o(args[0], args[1], args[2], args[3], args[4], args[5], args[6], args[7], args[8]), t1.result);
        }
        else if (args.length == 10) {
            return shallowTag(o(args[0], args[1], args[2], args[3], args[4], args[5], args[6], args[7], args[8], args[9]), t1.result);
        }
        else {
            throw new Error("callFunction only defined for upto 10 arguments");
        }
        throw new Error("Impossible"); // unreachable
    }
    RT.callFunction = callFunction;
    function callFunction0(o, t_o) {
        if (!o && (o === null || o === undefined)) {
            throw new Error("callFunction0 calling from undefined/null");
        }
        var t1 = (o.__rtti__ && o.__rtti__.methodTable["<call>"]) || t_o.methodTable["<call>"];
        if (t1 === undefined) {
            throw new Error("callFunction0 <call> method not found");
        }
        if (t1.result.tt === TT.JUST_TYPE || t1.result.tt === TT.UN) {
            throw new Error("callFunction0 return type is not a subtype of any: " + prettyprint_t(t1.result));
        }
        // check args
        if (t1.mandatoryArgs) { // non-zero or not undefined
            throw new Error("callFunction0 did not provide all mandatory arguments");
        }
        return shallowTag(o(), t1.result);
    }
    RT.callFunction0 = callFunction0;
    function callFunction1(o, t_o, arg1, argType1) {
        if (!o && (o === null || o === undefined)) {
            throw new Error("callFunction0 calling from undefined/null");
        }
        var t1 = (o.__rtti__ && o.__rtti__.methodTable["<call>"]) || t_o.methodTable["<call>"];
        if (t1 === undefined) {
            throw new Error("callFunction1 <call> method not found");
        }
        if (t1.result.tt === TT.JUST_TYPE || t1.result.tt === TT.UN) {
            throw new Error("callFunction1 return type is not a subtype of any: " + prettyprint_t(t1.result));
        }
        // check args
        if (t1.mandatoryArgs > 1) { //undefined > 1 = false
            throw new Error("callFunction1 did not provide all mandatory arguments");
        }
        if (t1.args.length > 0) {
            checkAndTag(arg1, argType1, t1.args[0]);
        }
        else {
            var varargs_t = t1.varargs;
            if (varargs_t === undefined) {
                throw new Error("callFunction1 extra arguments provided to a non variadic method call");
            }
            checkAndTag(arg1, argType1, varargs_t);
        }
        return shallowTag(o(arg1), t1.result);
    }
    RT.callFunction1 = callFunction1;
    function callFunction2(o, t_o, arg1, arg2, argType1, argType2) {
        if (!o && (o === null || o === undefined)) {
            throw new Error("callFunction0 calling from undefined/null");
        }
        var t1 = (o.__rtti__ && o.__rtti__.methodTable["<call>"]) || t_o.methodTable["<call>"];
        if (t1 === undefined) {
            throw new Error("callFunction1 <call> method not found");
        }
        if (t1.result.tt === TT.JUST_TYPE || t1.result.tt === TT.UN) {
            throw new Error("callFunction1 return type is not a subtype of any: " + prettyprint_t(t1.result));
        }
        // check args
        if (t1.mandatoryArgs > 2) { //undefined > 2 = false
            throw new Error("callMethod2 did not provide all mandatory arguments");
        }
        var varargs_t;
        switch (t1.args.length) {
            case 0:
                varargs_t = t1.varargs;
                if (varargs_t === undefined) {
                    throw new Error("callFunction2 extra arguments provided to a non variadic method call");
                }
                checkAndTag(arg1, argType1, varargs_t);
                checkAndTag(arg2, argType2, varargs_t);
                break;
            case 1:
                varargs_t = t1.varargs;
                if (varargs_t === undefined) {
                    throw new Error("callFunction2 extra arguments provided to a non variadic method call");
                }
                checkAndTag(arg1, argType1, t1.args[0]);
                checkAndTag(arg2, argType2, varargs_t);
                break;
            case 2:
                checkAndTag(arg1, argType1, t1.args[0]);
                checkAndTag(arg2, argType2, t1.args[1]);
                break;
            default:
                throw new Error("Impossible");
        }
        return shallowTag(o(arg1, arg2), t1.result);
    }
    RT.callFunction2 = callFunction2;
    function callFunction3(o, t_o, arg1, arg2, arg3, argType1, argType2, argType3) {
        if (!o && (o === null || o === undefined)) {
            throw new Error("callFunction0 calling from undefined/null");
        }
        var t1 = (o.__rtti__ && o.__rtti__.methodTable["<call>"]) || t_o.methodTable["<call>"];
        if (t1 === undefined) {
            throw new Error("callFunction1 <call> method not found");
        }
        if (t1.result.tt === TT.JUST_TYPE || t1.result.tt === TT.UN) {
            throw new Error("callFunction1 return type is not a subtype of any: " + prettyprint_t(t1.result));
        }
        // check args
        if (t1.mandatoryArgs > 3) { //undefined > 3 = false
            throw new Error("callMethod3 did not provide all mandatory arguments");
        }
        var varargs_t;
        switch (t1.args.length) {
            case 0:
                varargs_t = t1.varargs;
                if (varargs_t === undefined) {
                    throw new Error("callMethod3 extra arguments provided to a non variadic method call");
                }
                checkAndTag(arg1, argType1, varargs_t);
                checkAndTag(arg2, argType2, varargs_t);
                checkAndTag(arg3, argType3, varargs_t);
                break;
            case 1:
                varargs_t = t1.varargs;
                if (varargs_t === undefined) {
                    throw new Error("callMethod3 extra arguments provided to a non variadic method call");
                }
                checkAndTag(arg1, argType1, t1.args[0]);
                checkAndTag(arg2, argType2, varargs_t);
                checkAndTag(arg3, argType3, varargs_t);
                break;
            case 2:
                varargs_t = t1.varargs;
                if (varargs_t === undefined) {
                    throw new Error("callMethod3 extra arguments provided to a non variadic method call");
                }
                checkAndTag(arg1, argType1, t1.args[0]);
                checkAndTag(arg2, argType2, t1.args[1]);
                checkAndTag(arg3, argType3, varargs_t);
                break;
            case 3:
                checkAndTag(arg1, argType1, t1.args[0]);
                checkAndTag(arg2, argType2, t1.args[1]);
                checkAndTag(arg3, argType3, t1.args[2]);
                break;
            default:
                throw new Error("Impossible");
        }
        return shallowTag(o(arg1, arg2, arg3), t1.result);
    }
    RT.callFunction3 = callFunction3;
    function callFunction4(o, from, arg1, arg2, arg3, arg4, argType1, argType2, argType3, argType4) {
        return callFunction(o, from, [arg1, arg2, arg3, arg4], [argType1, argType2, argType3, argType4]);
    }
    RT.callFunction4 = callFunction4;
    function callFunction5(o, from, arg1, arg2, arg3, arg4, arg5, argType1, argType2, argType3, argType4, argType5) {
        return callFunction(o, from, [arg1, arg2, arg3, arg4, arg5], [argType1, argType2, argType3, argType4, argType5]);
    }
    RT.callFunction5 = callFunction5;
    function callFunction6(o, from, arg1, arg2, arg3, arg4, arg5, arg6, argType1, argType2, argType3, argType4, argType5, argType6) {
        return callFunction(o, from, [arg1, arg2, arg3, arg4, arg5, arg6], [argType1, argType2, argType3, argType4, argType5, argType6]);
    }
    RT.callFunction6 = callFunction6;
    function assignmentWithUnaryOp(op, o, from, f) {
        if (!o) {
            throw new Error("assignmentWithUnaryOp on null/undefined/0");
        }
        var t_o = o.__rtti__ || RT.Any;
        var tt = t_o.tt;
        var t = tt === TT.ANY ? from : t_o;
        var t1;
        var fname = f + "";
        switch (t.tt) {
            case TT.ARRAY:
                if (fname === "length") {
                    t1 = RT.Num;
                }
                else {
                    t1 = t.elt;
                    fname = checkAndTag(f, RT.Any, RT.Num);
                }
                break;
            case TT.INSTANCE:
            case TT.INTERFACE:
            case TT.CLASS:
                t1 = t[fname];
                if (t1 === undefined) {
                    if (t.methodTable[fname] || RT.objectMethods[fname]) {
                        throw new Error("assignmentWithUnaryOp field is a method");
                    }
                    t1 = RT.Any;
                }
                break;
            case TT.STRUCTURED_TYPE:
                t1 = t.fieldTable[fname] || from.fieldTable[fname];
                if (t1 === undefined) {
                    if (t.methodTable[fname] || from.methodTable[fname] || RT.objectMethods[fname]) {
                        throw new Error("assignmentWithUnaryOp to structuredtype field is a method");
                    }
                    t1 = RT.Any;
                }
                break;
            case TT.INDEX_MAP:
                tt = t.key.tt;
                t1 = t.value;
                if (tt === TT.NUMBER) {
                    fname = checkAndTag(f, RT.Any, RT.Num);
                }
                else {
                    if (RT.objectMethods[fname]) {
                        throw new Error("assignmentWithUnaryOp to indexMap, field is a method");
                    }
                }
                break;
            default:
                throw new Error("Impossible");
        }
        if (!(t1 === RT.Num || t1 === RT.Any)) {
            throw new Error("assignmentWithUnaryOp field type is non-any and non-number");
        }
        switch (op) {
            case "PreIncrementExpression":
                // @ts-expect-error MD typecheck error
                return ++o[fname];
            case "PreDecrementExpression":
                // @ts-expect-error MD typecheck error
                return --o[fname];
            case "PostIncrementExpression":
                // @ts-expect-error MD typecheck error
                return o[fname]++;
            case "PostDecrementExpression":
                // @ts-expect-error MD typecheck error
                return o[fname]--;
            default:
                throw new Error("Impossible");
        }
    }
    RT.assignmentWithUnaryOp = assignmentWithUnaryOp;
    function assignmentWithOp(op, o, from, f, v) {
        if (!o) {
            throw new Error("assignmentWithUnaryOp on null/undefined/0");
        }
        var t_o = o.__rtti__ || RT.Any;
        var tt = t_o.tt;
        var t = tt === TT.ANY ? from : t_o;
        var t1;
        var fname = f + "";
        switch (t.tt) {
            case TT.ARRAY:
                if (fname === "length") {
                    t1 = RT.Num;
                }
                else {
                    t1 = t.elt;
                    fname = checkAndTag(f, RT.Any, RT.Num);
                }
                break;
            case TT.INSTANCE:
            case TT.INTERFACE:
            case TT.CLASS:
                t1 = t[fname];
                if (t1 === undefined) {
                    if (t.methodTable[fname] || RT.objectMethods[fname]) {
                        throw new Error("assignmentWithUnaryOp field is a method");
                    }
                    t1 = RT.Any;
                }
                break;
            case TT.STRUCTURED_TYPE:
                t1 = t.fieldTable[fname] || from.fieldTable[fname];
                if (t1 === undefined) {
                    if (t.methodTable[fname] || from.methodTable[fname] || RT.objectMethods[fname]) {
                        throw new Error("assignmentWithUnaryOp to structuredtype field is a method");
                    }
                    t1 = RT.Any;
                }
                break;
            case TT.INDEX_MAP:
                tt = t.key.tt;
                t1 = t.value;
                if (tt === TT.NUMBER) {
                    fname = checkAndTag(f, RT.Any, RT.Num);
                }
                else {
                    if (RT.objectMethods[fname]) {
                        throw new Error("assignmentWithUnaryOp to indexMap, field is a method");
                    }
                }
                break;
            default:
                throw new Error("Impossible");
        }
        if (op === "AddAssignmentExpression") {
            var val = o[fname] + v;
            if (t1 === RT.Num) {
                if (val.__rtti__ !== RT.Num) {
                    throw new Error("assignmentWithOp add error, expected a number");
                }
                else {
                    return (o[fname] = val);
                }
            }
            else if (t1 === RT.Str || t1 === RT.Any) {
                return (o[fname] = val);
            }
            else {
                throw new Error("assignmentWithOp add error, field not a number/any/string");
            }
        }
        if (!(t1 === RT.Num || t1 === RT.Any)) {
            throw new Error("assignmentWithOp non-add op field type is not any or number");
        }
        switch (op) {
            case "SubtractAssignmentExpression":
                // @ts-expect-error MD typecheck error
                return (o[fname] -= v);
            case "MultiplyAssignmentExpression":
                // @ts-expect-error MD typecheck error
                return (o[fname] *= v);
            case "DivideAssignmentExpression":
                // @ts-expect-error MD typecheck error
                return (o[fname] /= v);
            case "ModuloAssignmentExpression":
                // @ts-expect-error MD typecheck error
                return (o[fname] %= v);
            case "AndAssignmentExpression":
                // @ts-expect-error MD typecheck error
                return (o[fname] &= v);
            case "ExclusiveOrAssignmentExpression":
                // @ts-expect-error MD typecheck error
                return (o[fname] ^= v);
            case "OrAssignmentExpression":
                // @ts-expect-error MD typecheck error
                return (o[fname] |= v);
            case "LeftShiftAssignmentExpression":
                // @ts-expect-error MD typecheck error
                return (o[fname] <<= v);
            case "SignedRightShiftAssignmentExpression":
                // @ts-expect-error MD typecheck error
                return (o[fname] >>= v);
            case "UnsignedRightShiftAssignmentExpression":
                // @ts-expect-error MD typecheck error
                return (o[fname] >>>= v);
            default:
                throw new Error("assignmentExpression: unidentified op: " + op);
        }
    }
    RT.assignmentWithOp = assignmentWithOp;
    function setTag(v, t) {
        v.__rtti__ = t;
        return v;
    }
    RT.setTag = setTag;
})(RT || (RT = {}));
