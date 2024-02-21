import { SoundType, TypeName } from '../ast';
import { MkAST, Pair } from '../typecheck/sound/tcUtil';
import {
  Field,
  createField,
  toFieldTable,
  TVar,
  TConstant,
  TIndexMap,
} from '../typecheck/sound/types';

// The spread index determines which element within the tuple type may be repeated 0-n times.
// We allow spreading once, on any index of the tuple.
export class TTuple extends SoundType {
  private readonly fields: Field[];

  constructor(
    elements: SoundType[],
    private readonly spreadIndex?: number
  ) {
    super(TypeName.Tuple);
    this.fields = [
      ...elements.map<Field>((type, i) => createField(`${i}`, type)),
    ];
  }

  public getField(name: string) {
    if (name === 'length') {
      return createField('length', TConstant.Number);
    }

    return this.fields.find((x) => x.name === name);
  }

  public getFields() {
    return [...this.fields];
  }

  public unFree(): boolean {
    return this.fields.every((x) => x.type.unFree());
  }

  public addField(field: Field) {
    this.fields.push(field);
  }

  public toRTTI() {
    if (this.isVirtual()) {
      return MkAST.callRT('JustType', [MkAST.stringConst('tuple type')]);
    }
    var r = MkAST.callExpr(
      MkAST.fieldOfRT('Tuple'),
      [
        toFieldTable(this.fields),
        this.spreadIndex != null
          ? MkAST.numberConst(this.spreadIndex)
          : undefined,
      ].filter((x) => x)
    );
    return r;
  }

  public equals(t: SoundType) {
    if (this === (t as unknown as TTuple)) return true;
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
      case TypeName.Tuple:
        var tt = t as unknown as TTuple;
        var myFields = this.fields;
        var ttFields = tt.getFields();
        return (
          checkFields(myFields, ttFields, false) &&
          checkFields(ttFields, myFields, true)
        );
      default:
        return false;
    }
  }

  public toString() {
    return `[${this.fields
      .map((x, i) =>
        this.spreadIndex === i ? '...' + x.type.toString() : x.type.toString()
      )
      .join(', ')}]`;
  }

  // @ts-ignore
  public subst(s: Pair<TVar, SoundType>[], descend: boolean) {
    const tuple = new TTuple([]);

    for (const field of this.fields) {
      tuple.addField(
        createField(field.name, field.type.subst(s, descend), field.optional)
      );
    }

    return tuple;
  }

  public static createFromFields(fields: Field[]) {
    const tuple = new TTuple([]);
    fields.forEach((x, i) => tuple.addField({ ...x, name: `${i}` }));
    return tuple;
  }
}
