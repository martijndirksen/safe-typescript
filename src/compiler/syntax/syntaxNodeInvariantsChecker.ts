// A debug class that we use to make sure a syntax node is valid.  Currently, this simply verifies
// that the same token does not appear in the tree multiple times.  This is important for
// subsystems that want to map between tokens and positions.  If a token shows up multiple times in
// the node, then it will not have a unique position, previous token, etc. etc. and that can screw
// many algorithms.  For this reason, when generating trees, it is important that nodes that are
// reused are cloned before insertion.

import {
  createHashTable,
  defaultHashTableCapacity,
  identityHashCode,
} from '../core/hashTable';
import { SyntaxNode } from './syntaxNode';
import { ISyntaxToken } from './syntaxToken';
import { SyntaxWalker } from './syntaxWalker.generated';

export class SyntaxNodeInvariantsChecker extends SyntaxWalker {
  private tokenTable = createHashTable(
    defaultHashTableCapacity,
    identityHashCode
  );

  public static checkInvariants(node: SyntaxNode): void {
    node.accept(new SyntaxNodeInvariantsChecker());
  }

  public visitToken(token: ISyntaxToken): void {
    // We're calling 'add', so the table will throw if we try to put the same token in multiple
    // times.
    this.tokenTable.add(token, token);
  }
}
