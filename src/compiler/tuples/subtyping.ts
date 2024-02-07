import { SoundTypeChecker } from '../typecheck/sound/tc';
import { Pair, TcUtil, pair } from '../typecheck/sound/tcUtil';
import { TypeRelations } from '../typecheck/sound/treln';
import { NamedType } from '../typecheck/sound/types';
import { TTuple } from './types';

const success = (delta: TcUtil.Delta) => pair(true, delta);
const zero: TcUtil.Delta = undefined;
const fail: Pair<boolean, TcUtil.Delta> = {
  fst: false,
  snd: undefined,
};

export function tupleSubtyping(
  t1: TTuple,
  t2: TTuple,
  fc: TcUtil.fc,
  cycles: Pair<NamedType, NamedType>[] = []
): Pair<boolean, TcUtil.Delta> {
  const f1s = t1.getFields();
  const f2s = t2.getFields();

  const isSubType = f2s.every((f2) => {
    const f1 = f1s.find((f1) => f1.name === f2.name);
    if (f1) {
      if (f1.optional && !f2.optional) return false;
      if (f1.mutable !== f2.mutable) return false;
      return TypeRelations.isSubtype(f1.type, f2.type, fc, cycles);
    } else {
      return f2.optional && fc.fresh;
    }
  });

  const missingFields = f1s.filter(
    (f1) => !f2s.some((f2) => f2.name === f1.name)
  );

  if (!isSubType) return fail;

  const isZeroDelta =
    !missingFields.length ||
    SoundTypeChecker.compilationSettings.tsstarTagging();
  const delta = isZeroDelta ? zero : TTuple.createFromFields(missingFields);

  return success(delta);
}
