import { AST, ISeparatedSyntaxList2, SoundType, TupleType } from '../ast';
import { SyntaxKind } from '../syntax/syntaxKind';
import { SoundTypeChecker } from '../typecheck/sound/tc';
import { TcUtil } from '../typecheck/sound/tcUtil';
import { TTuple } from './types';

function isTupleType(ast: AST): ast is TupleType {
  return ast.kind() === SyntaxKind.TupleType;
}

export function computeTupleType(ast: AST, tc: SoundTypeChecker): SoundType {
  if (!isTupleType(ast)) throw new Error('Unexpected AST for tuple type');
  const sepList = ast.type as ISeparatedSyntaxList2;
  const soundTypes = TcUtil.mapSepList2(sepList, (element) =>
    tc.computeType(element)
  );

  const tuple = new TTuple(soundTypes);

  console.log(`compute tuple type ${tuple}`);

  return tuple;
}

export function tcTupleType(ast: AST, tc: SoundTypeChecker) {
  if (!isTupleType(ast)) throw new Error('Unexpected AST for tuple type');
  const sepList = tc.tc(ast.type) as ISeparatedSyntaxList2;
  var soundTypes = TcUtil.mapSepList2(sepList, (a: AST) => a.soundType);

  const tuple = new TTuple(soundTypes);

  console.log(`tc tuple type ${tuple}`);

  return tc.pkg(ast, ast, tuple);
}
