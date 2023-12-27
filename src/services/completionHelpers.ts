// Copyright (c) Microsoft. All rights reserved. Licensed under the Apache License, Version 2.0.
// See LICENSE.txt in the project root for complete license information.

import { createIntrinsicsObject } from '../compiler/hashTable';
import { stripStartAndEndQuotes } from '../compiler/pathUtils';
import { LanguageVersion } from '../compiler/syntax/languageVersion';
import {
  PositionedElement,
  PositionedToken,
} from '../compiler/syntax/positionedElement';
import { Scanner } from '../compiler/syntax/scanner';
import {
  isEntirelyInsideComment,
  isEntirelyInStringOrRegularExpressionLiteral,
} from '../compiler/syntax/syntax';
import { SyntaxKind } from '../compiler/syntax/syntaxKind';
import { SourceUnitSyntax } from '../compiler/syntax/syntaxNodes.generated';
import { CharacterCodes } from '../compiler/text/characterCodes';
import { fromString } from '../compiler/text/textFactory';
import { PullSymbol } from '../compiler/typecheck/pullSymbols';
import { PullVisibleSymbolsInfo } from '../compiler/typescript';

export class CompletionHelpers {
  public static filterContextualMembersList(
    contextualMemberSymbols: PullSymbol[],
    existingMembers: PullVisibleSymbolsInfo
  ): PullSymbol[] {
    if (
      !existingMembers ||
      !existingMembers.symbols ||
      existingMembers.symbols.length === 0
    ) {
      return contextualMemberSymbols;
    }

    var existingMemberSymbols = existingMembers.symbols;
    var existingMemberNames = createIntrinsicsObject<boolean>();
    for (var i = 0, n = existingMemberSymbols.length; i < n; i++) {
      existingMemberNames[
        stripStartAndEndQuotes(existingMemberSymbols[i].getDisplayName())
      ] = true;
    }

    var filteredMembers: PullSymbol[] = [];
    for (var j = 0, m = contextualMemberSymbols.length; j < m; j++) {
      var contextualMemberSymbol = contextualMemberSymbols[j];
      if (
        !existingMemberNames[
          stripStartAndEndQuotes(contextualMemberSymbol.getDisplayName())
        ]
      ) {
        filteredMembers.push(contextualMemberSymbol);
      }
    }

    return filteredMembers;
  }

  public static isCompletionListBlocker(
    sourceUnit: SourceUnitSyntax,
    position: number
  ): boolean {
    // This method uses Fidelity completelly. Some information can be reached using the AST, but not everything.
    return (
      isEntirelyInsideComment(sourceUnit, position) ||
      isEntirelyInStringOrRegularExpressionLiteral(sourceUnit, position) ||
      CompletionHelpers.isIdentifierDefinitionLocation(sourceUnit, position) ||
      CompletionHelpers.isRightOfIllegalDot(sourceUnit, position)
    );
  }

  public static getContainingObjectLiteralApplicableForCompletion(
    sourceUnit: SourceUnitSyntax,
    position: number
  ): PositionedElement {
    // The locations in an object literal expression that are applicable for completion are property name definition locations.
    var previousToken = CompletionHelpers.getNonIdentifierCompleteTokenOnLeft(
      sourceUnit,
      position
    );

    if (previousToken) {
      var parent = previousToken.parent();

      switch (previousToken.kind()) {
        case SyntaxKind.OpenBraceToken: // var x = { |
        case SyntaxKind.CommaToken: // var x = { a: 0, |
          if (parent && parent.kind() === SyntaxKind.SeparatedList) {
            parent = parent.parent();
          }

          if (parent && parent.kind() === SyntaxKind.ObjectLiteralExpression) {
            return parent;
          }

          break;
      }
    }

    return null;
  }

  public static isIdentifierDefinitionLocation(
    sourceUnit: SourceUnitSyntax,
    position: number
  ): boolean {
    var positionedToken = CompletionHelpers.getNonIdentifierCompleteTokenOnLeft(
      sourceUnit,
      position
    );

    if (positionedToken) {
      var containingNodeKind =
        positionedToken.containingNode() &&
        positionedToken.containingNode().kind();
      switch (positionedToken.kind()) {
        case SyntaxKind.CommaToken:
          return (
            containingNodeKind === SyntaxKind.ParameterList ||
            containingNodeKind === SyntaxKind.VariableDeclaration ||
            containingNodeKind === SyntaxKind.EnumDeclaration
          ); // enum { foo, |

        case SyntaxKind.OpenParenToken:
          return (
            containingNodeKind === SyntaxKind.ParameterList ||
            containingNodeKind === SyntaxKind.CatchClause
          );

        case SyntaxKind.OpenBraceToken:
          return containingNodeKind === SyntaxKind.EnumDeclaration; // enum { |

        case SyntaxKind.PublicKeyword:
        case SyntaxKind.PrivateKeyword:
        case SyntaxKind.StaticKeyword:
        case SyntaxKind.DotDotDotToken:
          return containingNodeKind === SyntaxKind.Parameter;

        case SyntaxKind.ClassKeyword:
        case SyntaxKind.ModuleKeyword:
        case SyntaxKind.EnumKeyword:
        case SyntaxKind.InterfaceKeyword:
        case SyntaxKind.FunctionKeyword:
        case SyntaxKind.VarKeyword:
        case SyntaxKind.GetKeyword:
        case SyntaxKind.SetKeyword:
          return true;
      }

      // Previous token may have been a keyword that was converted to an identifier.
      switch (positionedToken.token().text()) {
        case 'class':
        case 'interface':
        case 'enum':
        case 'module':
          return true;
      }
    }

    return false;
  }

  public static getNonIdentifierCompleteTokenOnLeft(
    sourceUnit: SourceUnitSyntax,
    position: number
  ): PositionedToken {
    var positionedToken = sourceUnit.findCompleteTokenOnLeft(
      position,
      /*includeSkippedTokens*/ true
    );

    if (
      positionedToken &&
      position === positionedToken.end() &&
      positionedToken.kind() == SyntaxKind.EndOfFileToken
    ) {
      // EndOfFile token is not intresting, get the one before it
      positionedToken = positionedToken.previousToken(
        /*includeSkippedTokens*/ true
      );
    }

    if (
      positionedToken &&
      position === positionedToken.end() &&
      positionedToken.kind() === SyntaxKind.IdentifierName
    ) {
      // The caret is at the end of an identifier, the decession to provide completion depends on the previous token
      positionedToken = positionedToken.previousToken(
        /*includeSkippedTokens*/ true
      );
    }

    return positionedToken;
  }

  public static isRightOfIllegalDot(
    sourceUnit: SourceUnitSyntax,
    position: number
  ): boolean {
    var positionedToken = CompletionHelpers.getNonIdentifierCompleteTokenOnLeft(
      sourceUnit,
      position
    );

    if (positionedToken) {
      switch (positionedToken.kind()) {
        case SyntaxKind.DotToken:
          var leftOfDotPositionedToken = positionedToken.previousToken(
            /*includeSkippedTokens*/ true
          );
          return (
            leftOfDotPositionedToken &&
            leftOfDotPositionedToken.kind() === SyntaxKind.NumericLiteral
          );

        case SyntaxKind.NumericLiteral:
          var text = positionedToken.token().text();
          return text.charAt(text.length - 1) === '.';
      }
    }

    return false;
  }

  public static getValidCompletionEntryDisplayName(
    displayName: string
  ): string {
    if (displayName && displayName.length > 0) {
      var firstChar = displayName.charCodeAt(0);
      if (
        firstChar === CharacterCodes.singleQuote ||
        firstChar === CharacterCodes.doubleQuote
      ) {
        // If the user entered name for the symbol was quoted, removing the quotes is not enough, as the name could be an
        // invalid identifer name. We need to check if whatever was inside the quotes is actually a valid identifier name.
        displayName = stripStartAndEndQuotes(displayName);

        if (
          Scanner.isValidIdentifier(
            fromString(displayName),
            LanguageVersion.EcmaScript5
          )
        ) {
          return displayName;
        }
      } else {
        return displayName;
      }
    }

    return null;
  }
}
