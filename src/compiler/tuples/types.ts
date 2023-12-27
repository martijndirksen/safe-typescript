import { SoundType, TypeName } from '../ast';
import { MkAST } from '../typecheck/sound/tcUtil';
import { Field, StructuredType, toFieldTable } from '../typecheck/sound/types';

export class TTuple extends StructuredType {
  constructor(elements: SoundType[]) {
    const fields = elements.map<Field>((x, i) => ({
      name: `${i}`,
      type: x,
      mutable: true,
      optional: false,
    }));

    super(TypeName.Record, fields);
  }
  public toRTTI() {
    if (this.isVirtual()) {
      return MkAST.callRT('JustType', [MkAST.stringConst('tuple type')]);
    }
    var r = MkAST.callExpr(MkAST.fieldOfRT('StructuredType'), [
      toFieldTable(this.exposeFields()),
    ]);
    return r;
  }
  public equals(t: SoundType) {
    if (this === t) return true;
    t = t.unfold();
    var checkFields = (fs1: Field[], fs2: Field[], flip: boolean) => {
      return fs1.every((f) => {
        var gs = fs2.filter((f2) => f2.name === f.name);
        return gs.some(
          (g) => flip || (g.mutable === f.mutable && g.type.equals(f.type))
        );
      });
    };
    switch (t.typeName) {
      case TypeName.Record:
        var tt = <TTuple>t;
        var myFields = this.exposeFields();
        var ttFields = tt.exposeFields();
        return (
          checkFields(myFields, ttFields, false) &&
          checkFields(ttFields, myFields, true)
        );
      default:
        return false;
    }
  }
  // @ts-ignore
  public subst(s: Pair<TVar, SoundType>[], descend: boolean) {
    return this.substBase(s, new TTuple([]), descend);
  }
}
