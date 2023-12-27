//
// Copyright (c) Microsoft Corporation.  All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//

import { SyntaxKind } from '../../compiler/syntax/syntaxKind';
import { TokenRange } from './tokenRange';

export class RuleDescriptor {
  constructor(
    public LeftTokenRange: TokenRange,
    public RightTokenRange: TokenRange
  ) {}

  public toString(): string {
    return (
      '[leftRange=' +
      this.LeftTokenRange +
      ',' +
      'rightRange=' +
      this.RightTokenRange +
      ']'
    );
  }

  static create1(left: SyntaxKind, right: SyntaxKind): RuleDescriptor {
    return RuleDescriptor.create4(
      TokenRange.FromToken(left),
      TokenRange.FromToken(right)
    );
  }

  static create2(left: TokenRange, right: SyntaxKind): RuleDescriptor {
    return RuleDescriptor.create4(left, TokenRange.FromToken(right));
  }

  static create3(left: SyntaxKind, right: TokenRange): RuleDescriptor {
    //: this(TokenRange.FromToken(left), right)
    return RuleDescriptor.create4(TokenRange.FromToken(left), right);
  }

  static create4(left: TokenRange, right: TokenRange): RuleDescriptor {
    return new RuleDescriptor(left, right);
  }
}
