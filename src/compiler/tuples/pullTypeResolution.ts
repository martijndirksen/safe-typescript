import { AST, ISeparatedSyntaxList2, TupleType } from '../ast';
import { DiagnosticCode } from '../resources/diagnosticCode.generated';
import { SyntaxKind } from '../syntax/syntaxKind';
import { SemanticInfoChain } from '../typecheck/pullSemanticInfo';
import { PullErrorTypeSymbol, PullTypeSymbol } from '../typecheck/pullSymbols';
import { PullTypeResolutionContext } from '../typecheck/pullTypeResolutionContext';

function isTupleType(term: AST): term is TupleType {
  return term.kind() === SyntaxKind.TupleType;
}

function getErrorTypeSymbol(semanticInfoChain: SemanticInfoChain) {
  return new PullErrorTypeSymbol(semanticInfoChain.anyTypeSymbol, null);
}

export function getPullTypeSymbolFromAst(
  context: PullTypeResolutionContext,
  semanticInfoChain: SemanticInfoChain,
  term: AST
): PullTypeSymbol {
  if (!isTupleType(term)) {
    throw new Error(`Expected a tuple type, but got ${term.kind()}`);
  }

  const seperatedSyntaxList = term.type as ISeparatedSyntaxList2;
  const isZeroTuple = seperatedSyntaxList.width() === 0; // []

  if (isZeroTuple) {
    context.postDiagnostic(
      semanticInfoChain.diagnosticFromAST(
        term,
        DiagnosticCode.TUPLE_zero_tuple_type
      )
    );
    return getErrorTypeSymbol(semanticInfoChain);
  }

  console.log('tuple term', term);

  return semanticInfoChain.anyTypeSymbol; // TODO: be more specific
}
