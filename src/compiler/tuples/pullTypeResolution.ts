import {
  AST,
  ArrayLiteralExpression,
  ISeparatedSyntaxList2,
  TupleType,
} from '../ast';
import { IBitMatrix } from '../core/bitMatrix';
import { DiagnosticCode } from '../resources/diagnosticCode.generated';
import { SyntaxKind } from '../syntax/syntaxKind';
import { PullElementKind } from '../typecheck/pullFlags';
import {
  PullErrorTypeSymbol,
  PullSymbol,
  PullTypeSymbol,
} from '../typecheck/pullSymbols';
import {
  PullTypeResolver,
  TypeComparisonInfo,
} from '../typecheck/pullTypeResolution';
import { PullTypeResolutionContext } from '../typecheck/pullTypeResolutionContext';

function isTupleType(term: AST): term is TupleType {
  return term.kind() === SyntaxKind.TupleType;
}

function isArrayLiteralExpression(term: AST): term is ArrayLiteralExpression {
  return term.kind() === SyntaxKind.ArrayLiteralExpression;
}

export function getTuplePullTypeSymbolFromAst(
  pullTypeResolver: PullTypeResolver,
  resolutionContext: PullTypeResolutionContext,
  term: AST
): PullTypeSymbol {
  if (!isTupleType(term)) {
    throw new Error(`Expected a tuple type, but got ${term.kind()}`);
  }

  const seperatedSyntaxList = term.type as ISeparatedSyntaxList2;
  const isZeroTuple = seperatedSyntaxList.width() === 0; // []

  if (isZeroTuple) {
    resolutionContext.postDiagnostic(
      pullTypeResolver.semanticInfoChain.diagnosticFromAST(
        term,
        DiagnosticCode.TUPLE_zero_tuple_type
      )
    );
    return pullTypeResolver.getNewErrorTypeSymbol();
  }

  const pullType = new PullTypeSymbol('tuple', PullElementKind.Tuple);

  for (const astMember of seperatedSyntaxList.members) {
    const member = pullTypeResolver.resolveTypeReference(
      astMember,
      resolutionContext
    );
    if (member instanceof PullErrorTypeSymbol) {
      return member;
    }
    pullType.addMember(member);
  }

  return pullType;
}

export function sourceIsRelatableToTargetTuple(
  ctx: PullTypeResolver,
  source: PullTypeSymbol,
  target: PullTypeSymbol,
  assignableTo: boolean,
  comparisonCache: IBitMatrix,
  ast: AST,
  context: PullTypeResolutionContext,
  comparisonInfo: TypeComparisonInfo,
  isComparingInstantiatedSignatures: boolean
): boolean {
  if (!target.isTuple())
    throw new Error(
      'This procedure is only allowed when the target is a tuple'
    );

  if (!target.type.hasMembers())
    throw new Error('A tuple must have at lease one element');

  const targetMembers = target.type.getMembers();

  if (isArrayLiteralExpression(ast)) {
    // Width subtyping is not allowed
    if (ast.expressions.members.length !== targetMembers.length) return false;

    const elementsToCheck: [AST, PullSymbol][] = ast.expressions.members.map(
      (x, i) => [x, targetMembers[i]]
    );

    // Depth subtyping
    for (const [ast, target] of elementsToCheck) {
      const source = ctx.resolveAST(ast, true, context);

      if (!source) throw new Error('Unable to resolve PullSymbol from AST');

      const isIdentical = ctx.typesAreIdentical(source.type, target.type);

      console.log(
        'Checking ',
        SyntaxKind[ast.kind()],
        PullElementKind[target.kind],
        isIdentical
      );

      if (!isIdentical) return false;
    }
  }
  // else if array reference...

  //if (!source.type.hasMembers()) return false;

  // const sourceMembers = source.type.getMembers();
  // const targetMembers = target.type.getMembers();

  // console.log(
  //   ast.kind(),
  //   targetMembers.map((x) => x.name)
  // );

  // // Width subtyping is not allowed
  // if (sourceMembers.length !== targetMembers.length) return false;

  return true;
}
