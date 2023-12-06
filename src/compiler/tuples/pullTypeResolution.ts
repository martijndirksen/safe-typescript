import { AST, ISeparatedSyntaxList2, TupleType } from '../ast';
import { DiagnosticCode } from '../resources/diagnosticCode.generated';
import { SyntaxKind } from '../syntax/syntaxKind';
import { PullElementKind } from '../typecheck/pullFlags';
import { SemanticInfoChain } from '../typecheck/pullSemanticInfo';
import { PullErrorTypeSymbol, PullTypeSymbol } from '../typecheck/pullSymbols';
import { PullTypeResolver } from '../typecheck/pullTypeResolution';
import { PullTypeResolutionContext } from '../typecheck/pullTypeResolutionContext';

function isTupleType(term: AST): term is TupleType {
  return term.kind() === SyntaxKind.TupleType;
}

export function getTuplePullTypeSymbolFromAst(
  ctx: {
    pullTypeResolver: PullTypeResolver;
    resolutionContext: PullTypeResolutionContext;
  },
  term: AST
): PullTypeSymbol {
  if (!isTupleType(term)) {
    throw new Error(`Expected a tuple type, but got ${term.kind()}`);
  }

  const seperatedSyntaxList = term.type as ISeparatedSyntaxList2;
  const isZeroTuple = seperatedSyntaxList.width() === 0; // []

  if (isZeroTuple) {
    ctx.resolutionContext.postDiagnostic(
      ctx.pullTypeResolver.semanticInfoChain.diagnosticFromAST(
        term,
        DiagnosticCode.TUPLE_zero_tuple_type
      )
    );
    return ctx.pullTypeResolver.getNewErrorTypeSymbol();
  }

  const pullType = new PullTypeSymbol('tuple', PullElementKind.Tuple);

  for (var i = 0, n = seperatedSyntaxList.nonSeparatorCount(); i < n; i++) {
    const member = ctx.pullTypeResolver.resolveAST(
      seperatedSyntaxList.nonSeparatorAt(i),
      false, // TODO: Do we need support for contextual typing?
      ctx.resolutionContext
    ).type;
    console.log(seperatedSyntaxList.nonSeparatorAt(i));

    console.log(`member ${i}/${n}: ${member}`);

    pullType.addMember(member);
  }

  return pullType;
}
