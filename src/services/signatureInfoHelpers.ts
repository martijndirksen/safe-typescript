// Copyright (c) Microsoft. All rights reserved. Licensed under the Apache License, Version 2.0.
// See LICENSE.txt in the project root for complete license information.

///<reference path='typescriptServices.ts' />

import { ICallExpression } from '../compiler/ast';
import { Errors } from '../compiler/core/errors';
import { PositionedToken } from '../compiler/syntax/positionedElement';
import {
  getAncestorOfKind,
  hasAncestorOfKind,
  isEntirelyInsideComment,
} from '../compiler/syntax/syntax';
import { SyntaxKind } from '../compiler/syntax/syntaxKind';
import {
  SourceUnitSyntax,
  ObjectCreationExpressionSyntax,
} from '../compiler/syntax/syntaxNodes.generated';
import { SyntaxTree } from '../compiler/syntax/syntaxTree';
import {
  PullSymbol,
  PullSignatureSymbol,
  PullTypeSymbol,
} from '../compiler/typecheck/pullSymbols';
import { MemberName } from '../compiler/types';
import { LanguageServiceCompiler } from './compilerState';
import {
  FormalSignatureItemInfo,
  FormalTypeParameterInfo,
  FormalParameterInfo,
  ActualSignatureInfo,
} from './languageService';

export interface IPartiallyWrittenTypeArgumentListInformation {
  genericIdentifer: PositionedToken;
  lessThanToken: PositionedToken;
  argumentIndex: number;
}

export class SignatureInfoHelpers {
  // A partially written generic type expression is not guaranteed to have the correct syntax tree. the expression could be parsed as less than/greater than expression or a comma expression
  // or some other combination depending on what the user has typed so far. For the purposes of signature help we need to consider any location after "<" as a possible generic type reference.
  // To do this, the method will back parse the expression starting at the position required. it will try to parse the current expression as a generic type expression, if it did succeed it
  // will return the generic identifier that started the expression (e.g. "foo" in "foo<any, |"). It is then up to the caller to ensure that this is a valid generic expression through
  // looking up the type. The method will also keep track of the parameter index inside the expression.
  public static isInPartiallyWrittenTypeArgumentList(
    syntaxTree: SyntaxTree,
    position: number
  ): IPartiallyWrittenTypeArgumentListInformation | null {
    var token = syntaxTree
      .sourceUnit()
      .findTokenOnLeft(position, /*includeSkippedTokens*/ true);

    if (token && hasAncestorOfKind(token, SyntaxKind.TypeParameterList)) {
      // We are in the wrong generic list. bail out
      return null;
    }

    var stack = 0;
    var argumentIndex = 0;

    whileLoop: while (token) {
      switch (token.kind()) {
        case SyntaxKind.LessThanToken:
          if (stack === 0) {
            // Found the beginning of the generic argument expression
            var lessThanToken = token;
            token = token.previousToken(/*includeSkippedTokens*/ true);
            if (!token || token.kind() !== SyntaxKind.IdentifierName) {
              break whileLoop;
            }

            // Found the name, return the data
            return {
              genericIdentifer: token,
              lessThanToken: lessThanToken,
              argumentIndex: argumentIndex,
            };
          } else if (stack < 0) {
            // Seen one too many less than tokens, bail out
            break whileLoop;
          } else {
            stack--;
          }

          break;

        case SyntaxKind.GreaterThanGreaterThanGreaterThanToken:
          stack++;

        // Intentaion fall through
        case SyntaxKind.GreaterThanToken:
          stack++;
          break;

        case SyntaxKind.CommaToken:
          if (stack == 0) {
            argumentIndex++;
          }

          break;

        case SyntaxKind.CloseBraceToken:
          // This can be object type, skip untill we find the matching open brace token
          var unmatchedOpenBraceTokens = 0;

          // Skip untill the matching open brace token
          token = SignatureInfoHelpers.moveBackUpTillMatchingTokenKind(
            token,
            SyntaxKind.CloseBraceToken,
            SyntaxKind.OpenBraceToken
          );
          if (!token) {
            // No matching token was found. bail out
            break whileLoop;
          }

          break;

        case SyntaxKind.EqualsGreaterThanToken:
          // This can be a function type or a constructor type. In either case, we want to skip the function defintion
          token = token.previousToken(/*includeSkippedTokens*/ true);

          if (token && token.kind() === SyntaxKind.CloseParenToken) {
            // Skip untill the matching open paren token
            token = SignatureInfoHelpers.moveBackUpTillMatchingTokenKind(
              token,
              SyntaxKind.CloseParenToken,
              SyntaxKind.OpenParenToken
            );

            if (token && token.kind() === SyntaxKind.GreaterThanToken) {
              // Another generic type argument list, skip it\
              token = SignatureInfoHelpers.moveBackUpTillMatchingTokenKind(
                token,
                SyntaxKind.GreaterThanToken,
                SyntaxKind.LessThanToken
              );
            }

            if (token && token.kind() === SyntaxKind.NewKeyword) {
              // In case this was a constructor type, skip the new keyword
              token = token.previousToken(/*includeSkippedTokens*/ true);
            }

            if (!token) {
              // No matching token was found. bail out
              break whileLoop;
            }
          } else {
            // This is not a funtion type. exit the main loop
            break whileLoop;
          }

          break;

        case SyntaxKind.IdentifierName:
        case SyntaxKind.AnyKeyword:
        case SyntaxKind.NumberKeyword:
        case SyntaxKind.StringKeyword:
        case SyntaxKind.VoidKeyword:
        case SyntaxKind.BooleanKeyword:
        case SyntaxKind.DotToken:
        case SyntaxKind.OpenBracketToken:
        case SyntaxKind.CloseBracketToken:
          // Valid tokens in a type name. Skip.
          break;

        default:
          break whileLoop;
      }

      token = token.previousToken(/*includeSkippedTokens*/ true);
    }

    return null;
  }

  public static getSignatureInfoFromSignatureSymbol(
    symbol: PullSymbol,
    signatures: PullSignatureSymbol[],
    enclosingScopeSymbol: PullSymbol,
    compilerState: LanguageServiceCompiler
  ) {
    var signatureGroup: FormalSignatureItemInfo[] = [];

    var hasOverloads = signatures.length > 1;

    for (var i = 0, n = signatures.length; i < n; i++) {
      var signature = signatures[i];

      // filter out the definition signature if there are overloads
      if (hasOverloads && signature.isDefinition()) {
        continue;
      }

      var signatureGroupInfo = new FormalSignatureItemInfo();
      var paramIndexInfo: number[] = [];
      var functionName = signature
        .getScopedNameEx(enclosingScopeSymbol)
        .toString();
      if (
        !functionName &&
        (!symbol.isType() || (<PullTypeSymbol>symbol).isNamedTypeSymbol())
      ) {
        functionName = symbol.getScopedNameEx(enclosingScopeSymbol).toString();
      }

      var signatureMemberName = signature.getSignatureTypeNameEx(
        functionName,
        /*shortform*/ false,
        /*brackets*/ false,
        enclosingScopeSymbol,
        /*getParamMarkerInfo*/ true,
        /*getTypeParameterMarkerInfo*/ true
      );
      signatureGroupInfo.signatureInfo = MemberName.memberNameToString(
        signatureMemberName,
        paramIndexInfo
      );
      signatureGroupInfo.docComment = signature.docComments();

      var parameterMarkerIndex = 0;

      if (signature.isGeneric()) {
        var typeParameters = signature.getTypeParameters();
        for (var j = 0, m = typeParameters.length; j < m; j++) {
          var typeParameter = typeParameters[j];
          var signatureTypeParameterInfo = new FormalTypeParameterInfo();
          signatureTypeParameterInfo.name = typeParameter.getDisplayName();
          signatureTypeParameterInfo.docComment = typeParameter.docComments();
          signatureTypeParameterInfo.minChar =
            paramIndexInfo[2 * parameterMarkerIndex];
          signatureTypeParameterInfo.limChar =
            paramIndexInfo[2 * parameterMarkerIndex + 1];
          parameterMarkerIndex++;
          signatureGroupInfo.typeParameters.push(signatureTypeParameterInfo);
        }
      }

      var parameters = signature.parameters;
      for (var j = 0, m = parameters.length; j < m; j++) {
        var parameter = parameters[j];
        var signatureParameterInfo = new FormalParameterInfo();
        signatureParameterInfo.isVariable =
          signature.hasVarArgs && j === parameters.length - 1;
        signatureParameterInfo.name = parameter.getDisplayName();
        signatureParameterInfo.docComment = parameter.docComments();
        signatureParameterInfo.minChar =
          paramIndexInfo[2 * parameterMarkerIndex];
        signatureParameterInfo.limChar =
          paramIndexInfo[2 * parameterMarkerIndex + 1];
        parameterMarkerIndex++;
        signatureGroupInfo.parameters.push(signatureParameterInfo);
      }

      signatureGroup.push(signatureGroupInfo);
    }

    return signatureGroup;
  }

  public static getSignatureInfoFromGenericSymbol(
    symbol: PullSymbol,
    enclosingScopeSymbol: PullSymbol,
    compilerState: LanguageServiceCompiler
  ) {
    var signatureGroupInfo = new FormalSignatureItemInfo();

    var paramIndexInfo: number[] = [];
    var symbolName = symbol.getScopedNameEx(
      enclosingScopeSymbol,
      /*skipTypeParametersInName*/ false,
      /*useConstaintInName*/ true,
      /*getPrettyTypeName*/ false,
      /*getTypeParamMarkerInfo*/ true
    );

    signatureGroupInfo.signatureInfo = MemberName.memberNameToString(
      symbolName,
      paramIndexInfo
    );
    signatureGroupInfo.docComment = symbol.docComments();

    var parameterMarkerIndex = 0;

    var typeSymbol = symbol.type;

    var typeParameters = typeSymbol.getTypeParameters();
    for (var i = 0, n = typeParameters.length; i < n; i++) {
      var typeParameter = typeParameters[i];
      var signatureTypeParameterInfo = new FormalTypeParameterInfo();
      signatureTypeParameterInfo.name = typeParameter.getDisplayName();
      signatureTypeParameterInfo.docComment = typeParameter.docComments();
      signatureTypeParameterInfo.minChar = paramIndexInfo[2 * i];
      signatureTypeParameterInfo.limChar = paramIndexInfo[2 * i + 1];
      signatureGroupInfo.typeParameters.push(signatureTypeParameterInfo);
    }

    return [signatureGroupInfo];
  }

  public static getActualSignatureInfoFromCallExpression(
    ast: ICallExpression,
    caretPosition: number,
    typeParameterInformation: IPartiallyWrittenTypeArgumentListInformation
  ): ActualSignatureInfo | null {
    if (!ast) {
      return null;
    }

    var result = new ActualSignatureInfo();

    // The expression is not guaranteed to be complete, we need to populate the min and lim with the most accurate information we have about
    // type argument and argument lists
    var parameterMinChar = caretPosition;
    var parameterLimChar = caretPosition;

    if (ast.argumentList.typeArgumentList) {
      parameterMinChar = Math.min(ast.argumentList.typeArgumentList.start());
      parameterLimChar = Math.max(
        Math.max(
          ast.argumentList.typeArgumentList.start(),
          ast.argumentList.typeArgumentList.end() +
            ast.argumentList.typeArgumentList.trailingTriviaWidth()
        )
      );
    }

    if (ast.argumentList.args) {
      parameterMinChar = Math.min(
        parameterMinChar,
        ast.argumentList.args.start()
      );
      parameterLimChar = Math.max(
        parameterLimChar,
        Math.max(
          ast.argumentList.args.start(),
          ast.argumentList.args.end() +
            ast.argumentList.args.trailingTriviaWidth()
        )
      );
    }

    result.parameterMinChar = parameterMinChar;
    result.parameterLimChar = parameterLimChar;
    result.currentParameterIsTypeParameter = false;
    result.currentParameter = -1;

    if (typeParameterInformation) {
      result.currentParameterIsTypeParameter = true;
      result.currentParameter = typeParameterInformation.argumentIndex;
    } else if (
      ast.argumentList.args &&
      ast.argumentList.args.nonSeparatorCount() > 0
    ) {
      result.currentParameter = 0;
      for (
        var index = 0;
        index < ast.argumentList.args.nonSeparatorCount();
        index++
      ) {
        if (
          caretPosition >
          ast.argumentList.args.nonSeparatorAt(index).end() +
            ast.argumentList.args.nonSeparatorAt(index).trailingTriviaWidth()
        ) {
          result.currentParameter++;
        }
      }
    }

    return result;
  }

  public static getActualSignatureInfoFromPartiallyWritenGenericExpression(
    caretPosition: number,
    typeParameterInformation: IPartiallyWrittenTypeArgumentListInformation
  ): ActualSignatureInfo {
    var result = new ActualSignatureInfo();

    result.parameterMinChar = typeParameterInformation.lessThanToken.start();
    result.parameterLimChar = Math.max(
      typeParameterInformation.lessThanToken.fullEnd(),
      caretPosition
    );
    result.currentParameterIsTypeParameter = true;
    result.currentParameter = typeParameterInformation.argumentIndex;

    return result;
  }

  public static isSignatureHelpBlocker(
    sourceUnit: SourceUnitSyntax,
    position: number
  ): boolean {
    // We shouldn't be getting a possition that is outside the file because
    // isEntirelyInsideComment can't handle when the position is out of bounds,
    // callers should be fixed, however we should be resiliant to bad inputs
    // so we return true (this position is a blocker for getting signature help)
    if (position < 0 || position > sourceUnit.fullWidth()) {
      return true;
    }

    return isEntirelyInsideComment(sourceUnit, position);
  }

  public static isTargetOfObjectCreationExpression(
    positionedToken: PositionedToken
  ): boolean {
    var positionedParent = getAncestorOfKind(
      positionedToken,
      SyntaxKind.ObjectCreationExpression
    );
    if (positionedParent) {
      var objectCreationExpression = <ObjectCreationExpressionSyntax>(
        positionedParent.element()
      );
      var expressionRelativeStart =
        objectCreationExpression.newKeyword.fullWidth();
      var tokenRelativeStart =
        positionedToken.fullStart() - positionedParent.fullStart();
      return (
        tokenRelativeStart >= expressionRelativeStart &&
        tokenRelativeStart <=
          expressionRelativeStart +
            objectCreationExpression.expression.fullWidth()
      );
    }

    return false;
  }

  private static moveBackUpTillMatchingTokenKind(
    token: PositionedToken,
    tokenKind: SyntaxKind,
    matchingTokenKind: SyntaxKind
  ): PositionedToken | null {
    if (!token || token.kind() !== tokenKind) {
      throw Errors.invalidOperation();
    }

    // Skip the current token
    token = token.previousToken(/*includeSkippedTokens*/ true);

    var stack = 0;

    while (token) {
      if (token.kind() === matchingTokenKind) {
        if (stack === 0) {
          // Found the matching token, return
          return token;
        } else if (stack < 0) {
          // tokens overlapped.. bail out.
          break;
        } else {
          stack--;
        }
      } else if (token.kind() === tokenKind) {
        stack++;
      }

      // Move back
      token = token.previousToken(/*includeSkippedTokens*/ true);
    }

    // Did not find matching token
    return null;
  }
}
