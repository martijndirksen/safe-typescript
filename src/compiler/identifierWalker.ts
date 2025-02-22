import { IIndexable } from './hashTable';
import { ISyntaxToken } from './syntax/syntaxToken';
import { SyntaxWalker } from './syntax/syntaxWalker.generated';

export class IdentifierWalker extends SyntaxWalker {
  constructor(public list: IIndexable<boolean>) {
    super();
  }

  public visitToken(token: ISyntaxToken): void {
    this.list[token.text()] = true;
  }
}
