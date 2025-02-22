import { ISyntaxElement } from './syntaxElement';
import { ISyntaxToken } from './syntaxToken';
import { SyntaxWalker } from './syntaxWalker.generated';

export class PositionTrackingWalker extends SyntaxWalker {
  private _position: number = 0;

  public visitToken(token: ISyntaxToken): void {
    this._position += token.fullWidth();
  }

  public position(): number {
    return this._position;
  }

  public skip(element: ISyntaxElement): void {
    this._position += element.fullWidth();
  }
}
