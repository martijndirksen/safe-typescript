// Copyright (c) Microsoft. All rights reserved. Licensed under the Apache License, Version 2.0.
// See LICENSE.txt in the project root for complete license information.

import { PullDecl } from '../compiler/typecheck/pullDecls';
import { PullElementKind } from '../compiler/typecheck/pullFlags';
import {
  PullSymbol,
  PullContainerSymbol,
  PullAccessorSymbol,
} from '../compiler/typecheck/pullSymbols';

export class FindReferenceHelpers {
  public static compareSymbolsForLexicalIdentity(
    firstSymbol: PullSymbol,
    secondSymbol: PullSymbol
  ): boolean {
    // Unwrap modules so that we're always referring to the variable.
    if (!firstSymbol.isAlias() && firstSymbol.isContainer()) {
      var containerForFirstSymbol = <PullContainerSymbol>firstSymbol;
      if (containerForFirstSymbol.getInstanceSymbol()) {
        firstSymbol = containerForFirstSymbol.getInstanceSymbol();
      }
    }

    if (!secondSymbol.isAlias() && secondSymbol.isContainer()) {
      var containerForSecondSymbol = <PullContainerSymbol>secondSymbol;
      if (containerForSecondSymbol.getInstanceSymbol()) {
        secondSymbol = containerForSecondSymbol.getInstanceSymbol();
      }
    }

    if (firstSymbol.kind === secondSymbol.kind) {
      if (firstSymbol === secondSymbol) {
        return true;
      }

      // If we have two variables and they have the same name and the same parent, then
      // they are the same symbol.
      if (
        firstSymbol.kind === PullElementKind.Variable &&
        firstSymbol.name === secondSymbol.name &&
        firstSymbol.getDeclarations() &&
        firstSymbol.getDeclarations().length >= 1 &&
        secondSymbol.getDeclarations() &&
        secondSymbol.getDeclarations().length >= 1
      ) {
        var firstSymbolDecl = firstSymbol.getDeclarations()[0];
        var secondSymbolDecl = secondSymbol.getDeclarations()[0];

        return (
          firstSymbolDecl.getParentDecl() === secondSymbolDecl.getParentDecl()
        );
      }

      // If we have two properties that belong to an object literal, then we need ot see
      // if they came from teh same object literal ast.
      if (
        firstSymbol.kind === PullElementKind.Property &&
        firstSymbol.name === secondSymbol.name &&
        firstSymbol.getDeclarations() &&
        firstSymbol.getDeclarations().length >= 1 &&
        secondSymbol.getDeclarations() &&
        secondSymbol.getDeclarations().length >= 1
      ) {
        var firstSymbolDecl = firstSymbol.getDeclarations()[0];
        var secondSymbolDecl = secondSymbol.getDeclarations()[0];

        var firstParentDecl = firstSymbolDecl.getParentDecl();
        var secondParentDecl = secondSymbolDecl.getParentDecl();

        if (
          firstParentDecl.kind === PullElementKind.ObjectLiteral &&
          secondParentDecl.kind === PullElementKind.ObjectLiteral
        ) {
          return firstParentDecl.ast() === secondParentDecl.ast();
        }
      }

      return false;
    } else {
      switch (firstSymbol.kind) {
        case PullElementKind.Class: {
          return this.checkSymbolsForDeclarationEquality(
            firstSymbol,
            secondSymbol
          );
        }
        case PullElementKind.Property: {
          if (firstSymbol.isAccessor()) {
            var getterSymbol = (<PullAccessorSymbol>firstSymbol).getGetter();
            var setterSymbol = (<PullAccessorSymbol>firstSymbol).getSetter();

            if (getterSymbol && getterSymbol === secondSymbol) {
              return true;
            }

            if (setterSymbol && setterSymbol === secondSymbol) {
              return true;
            }
          }
          return false;
        }
        case PullElementKind.Function: {
          if (secondSymbol.isAccessor()) {
            var getterSymbol = (<PullAccessorSymbol>secondSymbol).getGetter();
            var setterSymbol = (<PullAccessorSymbol>secondSymbol).getSetter();

            if (getterSymbol && getterSymbol === firstSymbol) {
              return true;
            }

            if (setterSymbol && setterSymbol === firstSymbol) {
              return true;
            }
          }
          return false;
        }
        case PullElementKind.ConstructorMethod: {
          return this.checkSymbolsForDeclarationEquality(
            firstSymbol,
            secondSymbol
          );
        }
      }
    }

    return firstSymbol === secondSymbol;
  }

  private static checkSymbolsForDeclarationEquality(
    firstSymbol: PullSymbol,
    secondSymbol: PullSymbol
  ): boolean {
    var firstSymbolDeclarations: PullDecl[] = firstSymbol.getDeclarations();
    var secondSymbolDeclarations: PullDecl[] = secondSymbol.getDeclarations();
    for (var i = 0, iLen = firstSymbolDeclarations.length; i < iLen; i++) {
      for (var j = 0, jLen = secondSymbolDeclarations.length; j < jLen; j++) {
        if (
          this.declarationsAreSameOrParents(
            firstSymbolDeclarations[i],
            secondSymbolDeclarations[j]
          )
        ) {
          return true;
        }
      }
    }
    return false;
  }

  private static declarationsAreSameOrParents(
    firstDecl: PullDecl,
    secondDecl: PullDecl
  ): boolean {
    var firstParent: PullDecl = firstDecl.getParentDecl();
    var secondParent: PullDecl = secondDecl.getParentDecl();
    if (
      firstDecl === secondDecl ||
      firstDecl === secondParent ||
      firstParent === secondDecl ||
      firstParent === secondParent
    ) {
      return true;
    }
    return false;
  }
}
