import {
  AST,
  ArrayLiteralExpression,
  ArrayType,
  ISeparatedSyntaxList2,
  SoundType,
  TupleElementType,
  TupleType,
  TypeName,
} from '../ast';
import { DiagnosticCode } from '../resources/diagnosticCode.generated';
import { SyntaxKind } from '../syntax/syntaxKind';
import { SoundTypeChecker } from '../typecheck/sound/tc';
import { TcEnv } from '../typecheck/sound/tcEnv';
import { TcUtil } from '../typecheck/sound/tcUtil';
import { TConstant } from '../typecheck/sound/types';
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

export function isArrayLiteralExpression(
  ast: AST
): ast is ArrayLiteralExpression {
  return ast.kind() === SyntaxKind.ArrayLiteralExpression;
}

export function computeTupleElementType(
  ast: AST,
  tc: SoundTypeChecker
): SoundType {
  if (!isTupleElementType(ast))
    throw new Error('Unexpected AST for tuple element type');

  // Unwrap arrays
  if (ast.isRestElement) {
    if (!isArrayType(ast.type)) {
      TcUtil.Logger.error(
        DiagnosticCode.TUPLE_rest_element_not_an_array,
        [],
        ast
      );
      return TConstant.Any;
    }
    return (ast.soundType = tc.computeType(ast.type.type));
  }

  return (ast.soundType = tc.computeType(ast.type));
}

export function isTTuple(soundType: SoundType): soundType is TTuple {
  return soundType.typeName === TypeName.Tuple;
}

function createTTuple(ast: AST, soundTypes: SoundType[]): TTuple {
  if (!isTupleType(ast)) throw new Error('Unexpected AST for tuple type');

  const sepList = ast.type as ISeparatedSyntaxList2;

  let spreadIndex: number | undefined = undefined;

  for (const [member, i] of sepList.members.map(
    (x, i): [TupleElementType, number] => [x as TupleElementType, i]
  )) {
    if (member.isRestElement) {
      if (spreadIndex != null) {
        TcUtil.Logger.error(
          DiagnosticCode.TUPLE_multiple_spread_not_allowed,
          [],
          member
        );
      } else {
        spreadIndex = i;
      }
    }
  }

  return new TTuple(soundTypes, spreadIndex);
}

export function computeTupleType(ast: AST, tc: SoundTypeChecker): SoundType {
  if (!isTupleType(ast)) throw new Error('Unexpected AST for tuple type');
  const sepList = ast.type as ISeparatedSyntaxList2;
  const soundTypes = TcUtil.mapSepList2(sepList, (element) =>
    tc.computeType(element)
  );

  const soundType = createTTuple(ast, soundTypes);

  ast.soundType = soundType;

  return soundType;
}

export function tcTupleType(ast: AST, tc: SoundTypeChecker) {
  if (!isTupleType(ast)) throw new Error('Unexpected AST for tuple type');
  const sepList = tc.tc(ast.type) as ISeparatedSyntaxList2;
  var soundTypes = TcUtil.mapSepList2(sepList, (a: AST) => a.soundType);

  const tuple = createTTuple(ast, soundTypes);
  ast.soundType = tuple;

  console.log(`tc tuple type ${tuple}`);

  return tc.pkg(ast, ast, tuple);
}

export function tcArrayLiteralExpressionForTuple(
  ast: AST,
  tc: SoundTypeChecker
) {
  if (!isArrayLiteralExpression(ast))
    throw new Error('Unexpected AST for array literal');

  const soundTypes = ast.expressions.members.map((x) => tc.computeType(x));

  return new TTuple(soundTypes);
}

export function tcArrayLiteralExpressionForArray(
  ast: AST,
  tc: SoundTypeChecker,
  tcenv: TcEnv
) {
  if (!isArrayLiteralExpression(ast))
    throw new Error('Unexpected AST for array literal');

  // MD: Ideally we would use the inferred type to easily determine the common type,
  // but this proved difficult. Instead we just take the first element type.
  if (ast.expressions.members.length > 0) {
    const elementType = tc.computeType(ast.expressions.members[0]);

    return TcUtil.mkArrayType(tcenv, elementType);
  }

  return undefined;
}
