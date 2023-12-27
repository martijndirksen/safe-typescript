import { ISyntaxElement } from './syntaxElement';
import { ISyntaxTriviaList } from './syntaxTriviaList';
import { ISyntaxVisitor } from './syntaxVisitor.generated';

export interface ISyntaxNodeOrToken extends ISyntaxElement {
  withLeadingTrivia(leadingTrivia: ISyntaxTriviaList): ISyntaxNodeOrToken;
  withTrailingTrivia(trailingTrivia: ISyntaxTriviaList): ISyntaxNodeOrToken;

  accept(visitor: ISyntaxVisitor): any;
}
