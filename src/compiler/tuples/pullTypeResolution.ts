import { AST, ISeparatedSyntaxList2, TupleType } from '../ast';
import { DiagnosticCode } from '../resources/diagnosticCode.generated';
import { SyntaxKind } from '../syntax/syntaxKind';
import { PullElementKind } from '../typecheck/pullFlags';
import { PullErrorTypeSymbol, PullTypeSymbol } from '../typecheck/pullSymbols';
import { PullTypeResolver } from '../typecheck/pullTypeResolution';
import { PullTypeResolutionContext } from '../typecheck/pullTypeResolutionContext';

function isTupleType(term: AST): term is TupleType {
  return term.kind() === SyntaxKind.TupleType;
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
