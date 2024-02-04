import {
  AST,
  ArrayType,
  ISeparatedSyntaxList2,
  SoundType,
  TupleElementType,
  TupleType,
} from '../ast';
import { SyntaxKind } from '../syntax/syntaxKind';
import { SoundTypeChecker } from '../typecheck/sound/tc';
import { TcUtil } from '../typecheck/sound/tcUtil';
import { TTuple } from './types';

function isTupleElementType(ast: AST): ast is TupleElementType {
  return ast.kind() === SyntaxKind.TupleElementType;
}

function isTupleType(ast: AST): ast is TupleType {
  return ast.kind() === SyntaxKind.TupleType;
}

function isArrayType(ast: AST): ast is ArrayType {
  return ast.kind() === SyntaxKind.ArrayType;
}

export function computeTupleElementType(
  ast: AST,
  tc: SoundTypeChecker
): SoundType {
  if (!isTupleElementType(ast))
    throw new Error('Unexpected AST for tuple element type');

  // Unwrap arrays
  if (ast.isRestElement) {
    if (!isArrayType(ast.type))
      throw new Error('Rest elements must be an array type');
    return tc.computeType(ast.type.type);
  }

  return tc.computeType(ast.type);
}

export function computeTupleType(ast: AST, tc: SoundTypeChecker): SoundType {
  if (!isTupleType(ast)) throw new Error('Unexpected AST for tuple type');
  const sepList = ast.type as ISeparatedSyntaxList2;
  const soundTypes = TcUtil.mapSepList2(sepList, (element) =>
    tc.computeType(element)
  );

  const tuple = new TTuple(soundTypes, ast.spreadIndex);

  console.log(`compute tuple type ${tuple}`);

  return tuple;
}

export function tcTupleType(ast: AST, tc: SoundTypeChecker) {
  if (!isTupleType(ast)) throw new Error('Unexpected AST for tuple type');
  const sepList = tc.tc(ast.type) as ISeparatedSyntaxList2;
  var soundTypes = TcUtil.mapSepList2(sepList, (a: AST) => a.soundType);

  const tuple = new TTuple(soundTypes, ast.spreadIndex);

  console.log(`tc tuple type ${tuple}`);

  return tc.pkg(ast, ast, tuple);
}
