// Copyright (c) Microsoft. All rights reserved. Licensed under the Apache License, Version 2.0.
// See LICENSE.txt in the project root for complete license information.

import { Errors } from '../compiler/core/errors';
import { LineMap } from '../compiler/core/lineMap';
import { isDTSFile } from '../compiler/pathUtils';
import {
  PositionedElement,
  PositionedToken,
  PositionedNode,
  PositionedList,
  PositionedSeparatedList,
} from '../compiler/syntax/positionedElement';
import { ISyntaxElement } from '../compiler/syntax/syntaxElement';
import { SyntaxKind } from '../compiler/syntax/syntaxKind';
import { ISyntaxList } from '../compiler/syntax/syntaxList';
import {
  ModuleDeclarationSyntax,
  BlockSyntax,
  ForStatementSyntax,
  BinaryExpressionSyntax,
  ExportAssignmentSyntax,
  ExpressionStatementSyntax,
  ReturnStatementSyntax,
  ThrowStatementSyntax,
  BreakStatementSyntax,
  ContinueStatementSyntax,
  DebuggerStatementSyntax,
  LabeledStatementSyntax,
  ClassDeclarationSyntax,
  FunctionDeclarationSyntax,
  ConstructorDeclarationSyntax,
  MemberFunctionDeclarationSyntax,
  GetAccessorSyntax,
  SetAccessorSyntax,
  FunctionExpressionSyntax,
  VariableDeclaratorSyntax,
  VariableDeclarationSyntax,
  VariableStatementSyntax,
  ParameterSyntax,
  MemberVariableDeclarationSyntax,
  ImportDeclarationSyntax,
  EnumDeclarationSyntax,
  IfStatementSyntax,
  ElseClauseSyntax,
  ForInStatementSyntax,
  WhileStatementSyntax,
  DoStatementSyntax,
  SwitchStatementSyntax,
  CaseSwitchClauseSyntax,
  DefaultSwitchClauseSyntax,
  WithStatementSyntax,
  TryStatementSyntax,
  CatchClauseSyntax,
  FinallyClauseSyntax,
} from '../compiler/syntax/syntaxNodes.generated';
import { SyntaxTree } from '../compiler/syntax/syntaxTree';
import { SyntaxUtilities } from '../compiler/syntax/syntaxUtilities';
import { SpanInfo } from './languageService';

function createBreakpointSpanInfo(
  parentElement: PositionedElement,
  ...childElements: ISyntaxElement[]
): SpanInfo {
  if (!parentElement) {
    return null;
  }

  if (childElements.length == 0) {
    return new SpanInfo(parentElement.start(), parentElement.end());
  }

  var start: number;
  var end: number;
  for (var i = 0; i < childElements.length; i++) {
    var element = childElements[i];
    if (element) {
      if (start == undefined) {
        start = parentElement.childStart(element);
      }
      end = parentElement.childEnd(element);
    }
  }

  return new SpanInfo(start, end);
}

function createBreakpointSpanInfoWithLimChar(
  startElement: PositionedElement,
  limChar: number
): SpanInfo {
  return new SpanInfo(startElement.start(), limChar);
}

class BreakpointResolver {
  constructor(
    private posLine: number,
    private lineMap: LineMap
  ) {}

  private breakpointSpanOfToken(positionedToken: PositionedToken): SpanInfo {
    switch (positionedToken.token().tokenKind) {
      case SyntaxKind.OpenBraceToken:
        return this.breakpointSpanOfOpenBrace(positionedToken);

      case SyntaxKind.CloseBraceToken:
        return this.breakpointSpanOfCloseBrace(positionedToken);

      case SyntaxKind.CommaToken:
        return this.breakpointSpanOfComma(positionedToken);

      case SyntaxKind.SemicolonToken:
      case SyntaxKind.EndOfFileToken:
        return this.breakpointSpanIfStartsOnSameLine(
          positionedToken.previousToken()
        );

      case SyntaxKind.CloseParenToken:
        return this.breakpointSpanOfCloseParen(positionedToken);

      case SyntaxKind.DoKeyword:
        var parentElement = positionedToken.parent();
        if (parentElement && parentElement.kind() == SyntaxKind.DoStatement) {
          return this.breakpointSpanIfStartsOnSameLine(
            positionedToken.nextToken()
          );
        }
        break;
    }

    return this.breakpointSpanOfContainingNode(positionedToken);
  }

  private breakpointSpanOfOpenBrace(openBraceToken: PositionedToken): SpanInfo {
    var container = openBraceToken.containingNode();
    if (container) {
      var originalContainer = container;
      if (container && container.kind() == SyntaxKind.Block) {
        // We have to check the parent and decide what to do with the breakpoint
        container = container.containingNode();
        if (!container) {
          container = originalContainer;
        }
      }

      switch (container.kind()) {
        case SyntaxKind.Block:
          if (!this.canHaveBreakpointInBlock(container)) {
            return null();
          }
          return this.breakpointSpanOfFirstStatementInBlock(container);
          break;

        case SyntaxKind.ModuleDeclaration:
        case SyntaxKind.ClassDeclaration:
        case SyntaxKind.FunctionDeclaration:
        case SyntaxKind.ConstructorDeclaration:
        case SyntaxKind.MemberFunctionDeclaration:
        case SyntaxKind.GetAccessor:
        case SyntaxKind.SetAccessor:
        case SyntaxKind.FunctionExpression:
          if (!this.canHaveBreakpointInDeclaration(container)) {
            return null;
          }
          if (
            this.posLine !=
            this.lineMap.getLineNumberFromPosition(container.start())
          ) {
            return this.breakpointSpanOfFirstChildOfSyntaxList(
              this.getSyntaxListOfDeclarationWithElements(container)
            );
          } else {
            return this.breakpointSpanOf(container);
          }

        case SyntaxKind.EnumDeclaration:
          if (!this.canHaveBreakpointInDeclaration(container)) {
            return null;
          }
          if (
            this.posLine !=
            this.lineMap.getLineNumberFromPosition(container.start())
          ) {
            return this.breakpointSpanOfFirstEnumElement(container);
          } else {
            return this.breakpointSpanOf(container);
          }

        case SyntaxKind.IfStatement:
        case SyntaxKind.ForInStatement:
        case SyntaxKind.WhileStatement:
        case SyntaxKind.CatchClause:
          if (
            this.posLine !=
            this.lineMap.getLineNumberFromPosition(container.start())
          ) {
            return this.breakpointSpanOfFirstStatementInBlock(
              originalContainer
            );
          } else {
            return this.breakpointSpanOf(container);
          }

        case SyntaxKind.DoStatement:
          return this.breakpointSpanOfFirstStatementInBlock(originalContainer);

        case SyntaxKind.ForStatement:
          if (
            this.posLine !=
            this.lineMap.getLineNumberFromPosition(container.start())
          ) {
            return this.breakpointSpanOfFirstStatementInBlock(
              originalContainer
            );
          } else {
            return this.breakpointSpanOf(openBraceToken.previousToken());
          }

        case SyntaxKind.ElseClause:
        case SyntaxKind.CaseSwitchClause:
        case SyntaxKind.DefaultSwitchClause:
        case SyntaxKind.WithStatement:
        case SyntaxKind.TryStatement:
        case SyntaxKind.FinallyClause:
          return this.breakpointSpanOfFirstStatementInBlock(originalContainer);

        case SyntaxKind.SwitchStatement:
          if (
            this.posLine !=
            this.lineMap.getLineNumberFromPosition(container.start())
          ) {
            return this.breakpointSpanOfFirstStatementOfFirstCaseClause(
              container
            );
          } else {
            return this.breakpointSpanOf(container);
          }
      }
    }

    return null;
  }

  private breakpointSpanOfCloseBrace(
    closeBraceToken: PositionedToken
  ): SpanInfo {
    var container = closeBraceToken.containingNode();
    if (container) {
      var originalContainer = container;
      if (container.kind() == SyntaxKind.Block) {
        // We have to check the parent and decide what to do with the breakpoint
        container = container.containingNode();
        if (!container) {
          container = originalContainer;
        }
      }

      switch (container.kind()) {
        case SyntaxKind.Block:
          if (!this.canHaveBreakpointInBlock(container)) {
            return null();
          }
          return this.breakpointSpanOfLastStatementInBlock(container);
          break;

        case SyntaxKind.ModuleDeclaration:
          if (!this.canHaveBreakpointInDeclaration(container)) {
            return null;
          }
          var moduleSyntax = <ModuleDeclarationSyntax>container.node();
          if (
            moduleSyntax.moduleElements &&
            moduleSyntax.moduleElements.childCount() > 0
          ) {
            return createBreakpointSpanInfo(closeBraceToken);
          } else {
            return null;
          }

        case SyntaxKind.ClassDeclaration:
        case SyntaxKind.FunctionDeclaration:
        case SyntaxKind.ConstructorDeclaration:
        case SyntaxKind.MemberFunctionDeclaration:
        case SyntaxKind.GetAccessor:
        case SyntaxKind.SetAccessor:
        case SyntaxKind.FunctionExpression:
          if (!this.canHaveBreakpointInDeclaration(container)) {
            return null;
          }
          return createBreakpointSpanInfo(closeBraceToken);

        case SyntaxKind.EnumDeclaration:
          if (!this.canHaveBreakpointInDeclaration(container)) {
            return null;
          }
          return createBreakpointSpanInfo(closeBraceToken);

        case SyntaxKind.IfStatement:
        case SyntaxKind.ElseClause:
        case SyntaxKind.ForInStatement:
        case SyntaxKind.ForStatement:
        case SyntaxKind.WhileStatement:
        case SyntaxKind.DoStatement:
        case SyntaxKind.CaseSwitchClause:
        case SyntaxKind.DefaultSwitchClause:
        case SyntaxKind.WithStatement:
        case SyntaxKind.TryStatement:
        case SyntaxKind.CatchClause:
        case SyntaxKind.FinallyClause:
          return this.breakpointSpanOfLastStatementInBlock(originalContainer);

        case SyntaxKind.SwitchStatement:
          return this.breakpointSpanOfLastStatementOfLastCaseClause(container);
      }
    }

    return null;
  }

  private breakpointSpanOfComma(commaToken: PositionedToken): SpanInfo {
    var commaParent = commaToken.parent();
    if (commaParent && commaParent.element().isSeparatedList()) {
      var grandParent = commaParent.parent();
      if (grandParent) {
        switch (grandParent.kind()) {
          case SyntaxKind.VariableDeclaration:
          case SyntaxKind.EnumDeclaration:
          case SyntaxKind.ParameterList:
            var index = commaParent.childIndex(commaToken.token());
            // Use the previous child
            if (index > 0) {
              var child = commaParent.childAt(index - 1);
              return this.breakpointSpanOf(child);
            }

            // If we cant set breakpoint on enum element, just dont set breakpoint
            if (grandParent.kind() == SyntaxKind.EnumDeclaration) {
              return null;
            }
            break;
        }
      }
    }

    return this.breakpointSpanOfContainingNode(commaToken);
  }

  private breakpointSpanOfCloseParen(
    closeParenToken: PositionedToken
  ): SpanInfo {
    var closeParenParent = closeParenToken.parent();
    if (closeParenParent) {
      switch (closeParenParent.kind()) {
        case SyntaxKind.ForStatement:
        case SyntaxKind.ParameterList:
          return this.breakpointSpanOf(closeParenToken.previousToken());
      }
    }

    return this.breakpointSpanOfContainingNode(closeParenToken);
  }

  private canHaveBreakpointInBlock(blockNode: PositionedNode) {
    if (!blockNode || SyntaxUtilities.isAmbientDeclarationSyntax(blockNode)) {
      return false;
    }

    var blockSyntax = <BlockSyntax>blockNode.node();
    return blockSyntax.statements && blockSyntax.statements.childCount() != 0;
  }

  private breakpointSpanOfFirstStatementInBlock(
    blockNode: PositionedNode
  ): SpanInfo {
    if (!blockNode) {
      return null;
    }

    var blockSyntax = <BlockSyntax>blockNode.node();
    var statementsNode = blockNode.getPositionedChild(blockSyntax.statements);
    if (!statementsNode || statementsNode.childCount() == 0) {
      return null;
    }

    var firstStatement = statementsNode.childAt(0);
    if (firstStatement && firstStatement.kind() == SyntaxKind.Block) {
      if (this.canHaveBreakpointInBlock(<PositionedNode>firstStatement)) {
        return this.breakpointSpanOfFirstStatementInBlock(
          <PositionedNode>firstStatement
        );
      }
      return null;
    } else {
      return this.breakpointSpanOf(firstStatement);
    }
  }

  private breakpointSpanOfLastStatementInBlock(
    blockNode: PositionedNode
  ): SpanInfo {
    if (!blockNode) {
      return null;
    }

    var blockSyntax = <BlockSyntax>blockNode.node();
    var statementsNode = blockNode.getPositionedChild(blockSyntax.statements);
    if (!statementsNode || statementsNode.childCount() == 0) {
      return null;
    }

    var lastStatement = statementsNode.childAt(statementsNode.childCount() - 1);
    if (lastStatement && lastStatement.kind() == SyntaxKind.Block) {
      if (this.canHaveBreakpointInBlock(<PositionedNode>lastStatement)) {
        return this.breakpointSpanOfLastStatementInBlock(
          <PositionedNode>lastStatement
        );
      }
      return null;
    } else {
      return this.breakpointSpanOf(lastStatement);
    }
  }

  private breakpointSpanOfFirstChildOfSyntaxList(
    positionedList: PositionedList
  ): SpanInfo {
    if (!positionedList) {
      return null;
    }

    // Find the first syntax element
    var listSyntax = positionedList.list();
    if (listSyntax.childCount() == 0) {
      return null;
    }

    var firstStatement = positionedList.childAt(0);
    if (firstStatement && firstStatement.kind() == SyntaxKind.Block) {
      if (this.canHaveBreakpointInBlock(<PositionedNode>firstStatement)) {
        return this.breakpointSpanOfFirstStatementInBlock(
          <PositionedNode>firstStatement
        );
      }

      return null;
    } else {
      return this.breakpointSpanOf(firstStatement);
    }
  }

  private breakpointSpanOfLastChildOfSyntaxList(
    positionedList: PositionedList
  ): SpanInfo {
    if (!positionedList) {
      return null;
    }

    // Find the first syntax element
    var listSyntax = positionedList.list();
    if (listSyntax.childCount() == 0) {
      return null;
    }
    var lastStatement = positionedList.childAt(0);
    if (lastStatement && lastStatement.kind() == SyntaxKind.Block) {
      if (this.canHaveBreakpointInBlock(<PositionedNode>lastStatement)) {
        return this.breakpointSpanOfLastStatementInBlock(
          <PositionedNode>lastStatement
        );
      }
      return null;
    } else {
      return this.breakpointSpanOf(lastStatement);
    }
  }

  private breakpointSpanOfNode(positionedNode: PositionedNode): SpanInfo {
    var node = positionedNode.node();
    switch (node.kind()) {
      // Declarations with elements
      case SyntaxKind.ModuleDeclaration:
      case SyntaxKind.ClassDeclaration:
      case SyntaxKind.FunctionDeclaration:
      case SyntaxKind.ConstructorDeclaration:
      case SyntaxKind.MemberFunctionDeclaration:
      case SyntaxKind.GetAccessor:
      case SyntaxKind.SetAccessor:
        return this.breakpointSpanOfDeclarationWithElements(positionedNode);

      // Var, parameter and member variable declaration syntax
      case SyntaxKind.VariableDeclarator:
        return this.breakpointSpanOfVariableDeclarator(positionedNode);

      case SyntaxKind.VariableDeclaration:
        return this.breakpointSpanOfVariableDeclaration(positionedNode);

      case SyntaxKind.VariableStatement:
        return this.breakpointSpanOfVariableStatement(positionedNode);

      case SyntaxKind.Parameter:
        return this.breakpointSpanOfParameter(positionedNode);

      case SyntaxKind.MemberVariableDeclaration:
        return this.breakpointSpanOfMemberVariableDeclaration(positionedNode);

      case SyntaxKind.ImportDeclaration:
        return this.breakpointSpanOfImportDeclaration(positionedNode);

      case SyntaxKind.EnumDeclaration:
        return this.breakpointSpanOfEnumDeclaration(positionedNode);

      case SyntaxKind.EnumElement:
        return this.breakpointSpanOfEnumElement(positionedNode);

      // Statements
      case SyntaxKind.IfStatement:
        return this.breakpointSpanOfIfStatement(positionedNode);
      case SyntaxKind.ElseClause:
        return this.breakpointSpanOfElseClause(positionedNode);
      case SyntaxKind.ForInStatement:
        return this.breakpointSpanOfForInStatement(positionedNode);
      case SyntaxKind.ForStatement:
        return this.breakpointSpanOfForStatement(positionedNode);
      case SyntaxKind.WhileStatement:
        return this.breakpointSpanOfWhileStatement(positionedNode);
      case SyntaxKind.DoStatement:
        return this.breakpointSpanOfDoStatement(positionedNode);
      case SyntaxKind.SwitchStatement:
        return this.breakpointSpanOfSwitchStatement(positionedNode);
      case SyntaxKind.CaseSwitchClause:
        return this.breakpointSpanOfCaseSwitchClause(positionedNode);
      case SyntaxKind.DefaultSwitchClause:
        return this.breakpointSpanOfDefaultSwitchClause(positionedNode);
      case SyntaxKind.WithStatement:
        return this.breakpointSpanOfWithStatement(positionedNode);
      case SyntaxKind.TryStatement:
        return this.breakpointSpanOfTryStatement(positionedNode);
      case SyntaxKind.CatchClause:
        return this.breakpointSpanOfCatchClause(positionedNode);
      case SyntaxKind.FinallyClause:
        return this.breakpointSpanOfFinallyClause(positionedNode);

      // Expressions or statements
      default:
        if (node.isStatement()) {
          return this.breakpointSpanOfStatement(positionedNode);
        } else {
          return this.breakpointOfExpression(positionedNode);
        }
    }
  }

  private isInitializerOfForStatement(expressionNode: PositionedNode): boolean {
    if (!expressionNode) {
      return false;
    }

    var expressionParent = expressionNode.parent();
    if (
      expressionParent &&
      expressionParent.kind() == SyntaxKind.ForStatement
    ) {
      var expression = expressionNode.element();
      var forStatement = <ForStatementSyntax>expressionParent.element();
      var initializer = expressionParent.getPositionedChild(
        forStatement.initializer
      );
      return initializer && initializer.element() == expression;
    } else if (
      expressionParent &&
      expressionParent.kind() == SyntaxKind.CommaExpression
    ) {
      return this.isInitializerOfForStatement(<PositionedNode>expressionParent);
    }

    return false;
  }

  private isConditionOfForStatement(expressionNode: PositionedNode): boolean {
    if (!expressionNode) {
      return false;
    }

    var expressionParent = expressionNode.parent();
    if (
      expressionParent &&
      expressionParent.kind() == SyntaxKind.ForStatement
    ) {
      var expression = expressionNode.element();
      var forStatement = <ForStatementSyntax>expressionParent.element();
      var condition = expressionParent.getPositionedChild(
        forStatement.condition
      );
      return condition && condition.element() == expression;
    } else if (
      expressionParent &&
      expressionParent.kind() == SyntaxKind.CommaExpression
    ) {
      return this.isConditionOfForStatement(<PositionedNode>expressionParent);
    }

    return false;
  }

  private isIncrememtorOfForStatement(expressionNode: PositionedNode): boolean {
    if (!expressionNode) {
      return false;
    }

    var expressionParent = expressionNode.parent();
    if (
      expressionParent &&
      expressionParent.kind() == SyntaxKind.ForStatement
    ) {
      var expression = expressionNode.element();
      var forStatement = <ForStatementSyntax>expressionParent.element();
      var incrementor = expressionParent.getPositionedChild(
        forStatement.incrementor
      );
      return incrementor && incrementor.element() == expression;
    } else if (
      expressionParent &&
      expressionParent.kind() == SyntaxKind.CommaExpression
    ) {
      return this.isIncrememtorOfForStatement(<PositionedNode>expressionParent);
    }

    return false;
  }

  private breakpointOfLeftOfCommaExpression(
    commaExpressionNode: PositionedNode
  ): SpanInfo {
    var commaExpression = <BinaryExpressionSyntax>commaExpressionNode.node();
    return this.breakpointSpanOf(
      commaExpressionNode.getPositionedChild(commaExpression.left)
    );
  }

  private breakpointOfExpression(expressionNode: PositionedNode): SpanInfo {
    if (
      this.isInitializerOfForStatement(expressionNode) ||
      this.isConditionOfForStatement(expressionNode) ||
      this.isIncrememtorOfForStatement(expressionNode)
    ) {
      if (expressionNode.kind() == SyntaxKind.CommaExpression) {
        return this.breakpointOfLeftOfCommaExpression(expressionNode);
      }
      return createBreakpointSpanInfo(expressionNode);
    }

    if (expressionNode.kind() == SyntaxKind.ExportAssignment) {
      var exportAssignmentSyntax = <ExportAssignmentSyntax>(
        expressionNode.node()
      );
      return createBreakpointSpanInfo(
        expressionNode,
        exportAssignmentSyntax.exportKeyword,
        exportAssignmentSyntax.equalsToken,
        exportAssignmentSyntax.identifier
      );
    }

    return this.breakpointSpanOfContainingNode(expressionNode);
  }

  private breakpointSpanOfStatement(statementNode: PositionedNode): SpanInfo {
    var statement = statementNode.node();
    if (statement.kind() == SyntaxKind.EmptyStatement) {
      return null;
    }

    var containingNode = statementNode.containingNode();
    if (containingNode && containingNode.node().isStatement()) {
      // Check if not the declarations and the compound statements
      var useNodeForBreakpoint = false;
      switch (containingNode.kind()) {
        // Declarations
        case SyntaxKind.ModuleDeclaration:
        case SyntaxKind.ClassDeclaration:
        case SyntaxKind.FunctionDeclaration:
        case SyntaxKind.ConstructorDeclaration:
        case SyntaxKind.MemberFunctionDeclaration:
        case SyntaxKind.GetAccessor:
        case SyntaxKind.SetAccessor:
        case SyntaxKind.Block:

        // Compound Statements
        case SyntaxKind.IfStatement:
        case SyntaxKind.ElseClause:
        case SyntaxKind.ForInStatement:
        case SyntaxKind.ForStatement:
        case SyntaxKind.WhileStatement:
        case SyntaxKind.DoStatement:
        case SyntaxKind.SwitchStatement:
        case SyntaxKind.CaseSwitchClause:
        case SyntaxKind.DefaultSwitchClause:
        case SyntaxKind.WithStatement:
        case SyntaxKind.TryStatement:
        case SyntaxKind.CatchClause:
        case SyntaxKind.FinallyClause:
        case SyntaxKind.Block:
          useNodeForBreakpoint = true;
      }

      if (!useNodeForBreakpoint) {
        return this.breakpointSpanOfContainingNode(statementNode);
      }
    }

    switch (statement.kind()) {
      case SyntaxKind.ExpressionStatement:
        var expressionSyntax = <ExpressionStatementSyntax>statement;
        return createBreakpointSpanInfo(
          statementNode.getPositionedChild(expressionSyntax.expression)
        );

      case SyntaxKind.ReturnStatement:
        var returnStatementSyntax = <ReturnStatementSyntax>statement;
        return createBreakpointSpanInfo(
          statementNode,
          returnStatementSyntax.returnKeyword,
          returnStatementSyntax.expression
        );

      case SyntaxKind.ThrowStatement:
        var throwStatementSyntax = <ThrowStatementSyntax>statement;
        return createBreakpointSpanInfo(
          statementNode,
          throwStatementSyntax.throwKeyword,
          throwStatementSyntax.expression
        );

      case SyntaxKind.BreakStatement:
        var breakStatementSyntax = <BreakStatementSyntax>statement;
        return createBreakpointSpanInfo(
          statementNode,
          breakStatementSyntax.breakKeyword,
          breakStatementSyntax.identifier
        );

      case SyntaxKind.ContinueStatement:
        var continueStatementSyntax = <ContinueStatementSyntax>statement;
        return createBreakpointSpanInfo(
          statementNode,
          continueStatementSyntax.continueKeyword,
          continueStatementSyntax.identifier
        );

      case SyntaxKind.DebuggerStatement:
        var debuggerStatementSyntax = <DebuggerStatementSyntax>statement;
        return createBreakpointSpanInfo(
          statementNode.getPositionedChild(
            debuggerStatementSyntax.debuggerKeyword
          )
        );

      case SyntaxKind.LabeledStatement:
        var labeledStatementSyntax = <LabeledStatementSyntax>statement;
        return this.breakpointSpanOf(
          statementNode.getPositionedChild(labeledStatementSyntax.statement)
        );
    }

    return null;
  }

  private getSyntaxListOfDeclarationWithElements(
    positionedNode: PositionedNode
  ) {
    var node = positionedNode.node();
    var elementsList: ISyntaxList;
    var block: BlockSyntax;
    switch (node.kind()) {
      case SyntaxKind.ModuleDeclaration:
        elementsList = (<ModuleDeclarationSyntax>node).moduleElements;
        break;

      case SyntaxKind.ClassDeclaration:
        elementsList = (<ClassDeclarationSyntax>node).classElements;
        break;

      case SyntaxKind.FunctionDeclaration:
        block = (<FunctionDeclarationSyntax>node).block;
        break;

      case SyntaxKind.ConstructorDeclaration:
        block = (<ConstructorDeclarationSyntax>node).block;
        break;

      case SyntaxKind.MemberFunctionDeclaration:
        block = (<MemberFunctionDeclarationSyntax>node).block;
        break;

      case SyntaxKind.GetAccessor:
        block = (<GetAccessorSyntax>node).block;
        break;

      case SyntaxKind.SetAccessor:
        block = (<SetAccessorSyntax>node).block;
        break;

      case SyntaxKind.FunctionExpression:
        block = (<FunctionExpressionSyntax>node).block;
        break;

      default:
        throw Errors.argument(
          'positionNode',
          'unknown node kind in getSyntaxListOfDeclarationWithElements'
        );
    }

    var parentElement: PositionedElement = positionedNode;
    if (block) {
      parentElement = positionedNode.getPositionedChild(block);
      elementsList = block.statements;
    }

    return <PositionedList>parentElement.getPositionedChild(elementsList);
  }

  private canHaveBreakpointInDeclaration(positionedNode: PositionedNode) {
    return (
      positionedNode &&
      !SyntaxUtilities.isAmbientDeclarationSyntax(positionedNode)
    );
  }

  private breakpointSpanOfDeclarationWithElements(
    positionedNode: PositionedNode
  ): SpanInfo {
    if (!this.canHaveBreakpointInDeclaration(positionedNode)) {
      return null;
    }

    // If inside another module the whole declaration is debuggable
    var node = positionedNode.node();
    var moduleSyntax = <ModuleDeclarationSyntax>positionedNode.node();
    if (
      (node.isModuleElement() &&
        positionedNode.containingNode().kind() != SyntaxKind.SourceUnit) ||
      node.isClassElement() ||
      (moduleSyntax.kind() == SyntaxKind.ModuleDeclaration &&
        moduleSyntax.name &&
        moduleSyntax.name.kind() == SyntaxKind.QualifiedName)
    ) {
      return createBreakpointSpanInfo(positionedNode);
    } else {
      // Try to get the breakpoint in first element declaration
      return this.breakpointSpanOfFirstChildOfSyntaxList(
        this.getSyntaxListOfDeclarationWithElements(positionedNode)
      );
    }
  }

  private canHaveBreakpointInVariableDeclarator(
    varDeclaratorNode: PositionedNode
  ) {
    if (
      !varDeclaratorNode ||
      SyntaxUtilities.isAmbientDeclarationSyntax(varDeclaratorNode)
    ) {
      return false;
    }

    var varDeclaratorSyntax = <VariableDeclaratorSyntax>(
      varDeclaratorNode.node()
    );
    return !!varDeclaratorSyntax.equalsValueClause;
  }

  private breakpointSpanOfVariableDeclarator(
    varDeclaratorNode: PositionedNode
  ): SpanInfo {
    if (!this.canHaveBreakpointInVariableDeclarator(varDeclaratorNode)) {
      return null;
    }

    var container = varDeclaratorNode.containingNode();
    if (container && container.kind() == SyntaxKind.VariableDeclaration) {
      var parentDeclaratorsList = <PositionedSeparatedList>(
        varDeclaratorNode.parent()
      );
      // If this is the first declarator in the list use the declaration instead
      if (
        parentDeclaratorsList &&
        parentDeclaratorsList.list().childAt(0) == varDeclaratorNode.node()
      ) {
        return this.breakpointSpanOfVariableDeclaration(container);
      }

      // Create breakpoint on this var declarator
      if (this.canHaveBreakpointInVariableDeclarator(varDeclaratorNode)) {
        return createBreakpointSpanInfo(varDeclaratorNode);
      } else {
        return null;
      }
    } else if (container) {
      // Member Variable syntax
      return this.breakpointSpanOfMemberVariableDeclaration(container);
    }

    return null;
  }

  private canHaveBreakpointInVariableDeclaration(
    varDeclarationNode: PositionedNode
  ) {
    if (
      !varDeclarationNode ||
      SyntaxUtilities.isAmbientDeclarationSyntax(varDeclarationNode)
    ) {
      return false;
    }

    var varDeclarationSyntax = <VariableDeclarationSyntax>(
      varDeclarationNode.node()
    );
    var containerChildren = varDeclarationNode.getPositionedChild(
      varDeclarationSyntax.variableDeclarators
    );
    if (!containerChildren || containerChildren.childCount() == 0) {
      return false;
    }

    var child = containerChildren.childAt(0);
    if (child && child.element().isNode()) {
      return this.canHaveBreakpointInVariableDeclarator(
        <PositionedNode>containerChildren.childAt(0)
      );
    }

    return false;
  }

  private breakpointSpanOfVariableDeclaration(
    varDeclarationNode: PositionedNode
  ): SpanInfo {
    if (!this.canHaveBreakpointInDeclaration(varDeclarationNode)) {
      return null;
    }

    var container = varDeclarationNode.containingNode();
    var varDeclarationSyntax = <VariableDeclarationSyntax>(
      varDeclarationNode.node()
    );
    var varDeclarators = varDeclarationNode.getPositionedChild(
      varDeclarationSyntax.variableDeclarators
    );
    var varDeclaratorsCount = varDeclarators.childCount(); // varDeclarators has to be non null because its checked in canHaveBreakpoint

    if (container && container.kind() == SyntaxKind.VariableStatement) {
      return this.breakpointSpanOfVariableStatement(container);
    }

    if (this.canHaveBreakpointInVariableDeclaration(varDeclarationNode)) {
      return createBreakpointSpanInfoWithLimChar(
        varDeclarationNode,
        varDeclarators.childEndAt(0)
      );
    } else {
      return null;
    }
  }

  private canHaveBreakpointInVariableStatement(
    varStatementNode: PositionedNode
  ) {
    if (
      !varStatementNode ||
      SyntaxUtilities.isAmbientDeclarationSyntax(varStatementNode)
    ) {
      return false;
    }

    var variableStatement = <VariableStatementSyntax>varStatementNode.node();
    return this.canHaveBreakpointInVariableDeclaration(
      <PositionedNode>(
        varStatementNode.getPositionedChild(
          variableStatement.variableDeclaration
        )
      )
    );
  }

  private breakpointSpanOfVariableStatement(
    varStatementNode: PositionedNode
  ): SpanInfo {
    if (!this.canHaveBreakpointInVariableStatement(varStatementNode)) {
      return null;
    }

    var variableStatement = <VariableStatementSyntax>varStatementNode.node();
    var variableDeclaration = <PositionedNode>(
      varStatementNode.getPositionedChild(variableStatement.variableDeclaration)
    );
    var varDeclarationSyntax = <VariableDeclarationSyntax>(
      variableDeclaration.node()
    );
    var varDeclarators = variableDeclaration.getPositionedChild(
      varDeclarationSyntax.variableDeclarators
    );
    return createBreakpointSpanInfoWithLimChar(
      varStatementNode,
      varDeclarators.childEndAt(0)
    );
  }

  private breakpointSpanOfParameter(parameterNode: PositionedNode): SpanInfo {
    if (SyntaxUtilities.isAmbientDeclarationSyntax(parameterNode)) {
      return null;
    }

    var parameterSyntax = <ParameterSyntax>parameterNode.node();
    if (
      parameterSyntax.dotDotDotToken ||
      parameterSyntax.equalsValueClause ||
      parameterSyntax.modifiers.childCount() > 0
    ) {
      return createBreakpointSpanInfo(parameterNode);
    } else {
      return null;
    }
  }

  private breakpointSpanOfMemberVariableDeclaration(
    memberVarDeclarationNode: PositionedNode
  ): SpanInfo {
    if (SyntaxUtilities.isAmbientDeclarationSyntax(memberVarDeclarationNode)) {
      return null;
    }

    var memberVariableDeclaration = <MemberVariableDeclarationSyntax>(
      memberVarDeclarationNode.node()
    );
    if (
      this.canHaveBreakpointInVariableDeclarator(
        <PositionedNode>(
          memberVarDeclarationNode.getPositionedChild(
            memberVariableDeclaration.variableDeclarator
          )
        )
      )
    ) {
      return createBreakpointSpanInfo(
        memberVarDeclarationNode,
        memberVariableDeclaration.modifiers,
        memberVariableDeclaration.variableDeclarator
      );
    } else {
      return null;
    }
  }

  private breakpointSpanOfImportDeclaration(
    importDeclarationNode: PositionedNode
  ): SpanInfo {
    if (SyntaxUtilities.isAmbientDeclarationSyntax(importDeclarationNode)) {
      return null;
    }

    var importSyntax = <ImportDeclarationSyntax>importDeclarationNode.node();
    return createBreakpointSpanInfo(
      importDeclarationNode,
      importSyntax.modifiers,
      importSyntax.importKeyword,
      importSyntax.identifier,
      importSyntax.equalsToken,
      importSyntax.moduleReference
    );
  }

  private breakpointSpanOfEnumDeclaration(
    enumDeclarationNode: PositionedNode
  ): SpanInfo {
    if (!this.canHaveBreakpointInDeclaration(enumDeclarationNode)) {
      return null;
    }

    return createBreakpointSpanInfo(enumDeclarationNode);
  }

  private breakpointSpanOfFirstEnumElement(
    enumDeclarationNode: PositionedNode
  ): SpanInfo {
    var enumDeclarationSyntax = <EnumDeclarationSyntax>(
      enumDeclarationNode.node()
    );
    var enumElements = enumDeclarationNode.getPositionedChild(
      enumDeclarationSyntax.enumElements
    );
    if (enumElements && enumElements.childCount()) {
      return this.breakpointSpanOf(enumElements.childAt(0));
    }

    return null;
  }

  private breakpointSpanOfEnumElement(
    enumElementNode: PositionedNode
  ): SpanInfo {
    if (SyntaxUtilities.isAmbientDeclarationSyntax(enumElementNode)) {
      return null;
    }

    return createBreakpointSpanInfo(enumElementNode);
  }

  private breakpointSpanOfIfStatement(
    ifStatementNode: PositionedNode
  ): SpanInfo {
    var ifStatement = <IfStatementSyntax>ifStatementNode.node();
    return createBreakpointSpanInfo(
      ifStatementNode,
      ifStatement.ifKeyword,
      ifStatement.openParenToken,
      ifStatement.condition,
      ifStatement.closeParenToken
    );
  }

  private breakpointSpanOfElseClause(elseClauseNode: PositionedNode): SpanInfo {
    var elseClause = <ElseClauseSyntax>elseClauseNode.node();
    return this.breakpointSpanOf(
      elseClauseNode.getPositionedChild(elseClause.statement)
    );
  }

  private breakpointSpanOfForInStatement(
    forInStatementNode: PositionedNode
  ): SpanInfo {
    var forInStatement = <ForInStatementSyntax>forInStatementNode.node();
    return createBreakpointSpanInfo(
      forInStatementNode,
      forInStatement.forKeyword,
      forInStatement.openParenToken,
      forInStatement.variableDeclaration,
      forInStatement.left,
      forInStatement.inKeyword,
      forInStatement.expression,
      forInStatement.closeParenToken
    );
  }

  private breakpointSpanOfForStatement(
    forStatementNode: PositionedNode
  ): SpanInfo {
    var forStatement = <ForStatementSyntax>forStatementNode.node();
    return this.breakpointSpanOf(
      forStatementNode.getPositionedChild(
        forStatement.variableDeclaration
          ? forStatement.variableDeclaration
          : forStatement.initializer
      )
    );
  }

  private breakpointSpanOfWhileStatement(
    whileStatementNode: PositionedNode
  ): SpanInfo {
    var whileStatement = <WhileStatementSyntax>whileStatementNode.node();
    return createBreakpointSpanInfo(
      whileStatementNode,
      whileStatement.whileKeyword,
      whileStatement.openParenToken,
      whileStatement.condition,
      whileStatement.closeParenToken
    );
  }

  private breakpointSpanOfDoStatement(
    doStatementNode: PositionedNode
  ): SpanInfo {
    var doStatement = <DoStatementSyntax>doStatementNode.node();
    return createBreakpointSpanInfo(
      doStatementNode,
      doStatement.whileKeyword,
      doStatement.openParenToken,
      doStatement.condition,
      doStatement.closeParenToken
    );
  }

  private breakpointSpanOfSwitchStatement(
    switchStatementNode: PositionedNode
  ): SpanInfo {
    var switchStatement = <SwitchStatementSyntax>switchStatementNode.node();
    return createBreakpointSpanInfo(
      switchStatementNode,
      switchStatement.switchKeyword,
      switchStatement.openParenToken,
      switchStatement.expression,
      switchStatement.closeParenToken
    );
  }

  private breakpointSpanOfFirstStatementOfFirstCaseClause(
    switchStatementNode: PositionedNode
  ): SpanInfo {
    var switchStatement = <SwitchStatementSyntax>switchStatementNode.node();
    if (
      switchStatement.switchClauses &&
      switchStatement.switchClauses.childCount() == 0
    ) {
      return null;
    }

    var switchClauses = <PositionedList>(
      switchStatementNode.getPositionedChild(switchStatement.switchClauses)
    );
    if (switchClauses.childCount() == 0) {
      return null;
    }

    var firstCaseClause = <PositionedNode>switchClauses.childAt(0);
    var statements: ISyntaxList = null;
    if (
      firstCaseClause &&
      firstCaseClause.kind() == SyntaxKind.CaseSwitchClause
    ) {
      var caseClause = <CaseSwitchClauseSyntax>firstCaseClause.node();
      statements = caseClause.statements;
    } else if (
      firstCaseClause &&
      firstCaseClause.kind() == SyntaxKind.DefaultSwitchClause
    ) {
      var defaultClause = <CaseSwitchClauseSyntax>firstCaseClause.node();
      statements = defaultClause.statements;
    } else {
      return null;
    }

    return this.breakpointSpanOfFirstChildOfSyntaxList(
      <PositionedList>firstCaseClause.getPositionedChild(statements)
    );
  }

  private breakpointSpanOfLastStatementOfLastCaseClause(
    switchStatementNode: PositionedNode
  ): SpanInfo {
    var switchStatement = <SwitchStatementSyntax>switchStatementNode.node();
    if (
      switchStatement.switchClauses &&
      switchStatement.switchClauses.childCount() == 0
    ) {
      return null;
    }

    var switchClauses = <PositionedList>(
      switchStatementNode.getPositionedChild(switchStatement.switchClauses)
    );
    if (switchClauses.childCount() == 0) {
      return null;
    }

    var lastClauseNode = <PositionedNode>(
      switchClauses.childAt(switchClauses.childCount() - 1)
    );
    var statements: ISyntaxList = null;
    if (
      lastClauseNode &&
      lastClauseNode.kind() == SyntaxKind.CaseSwitchClause
    ) {
      var caseClause = <CaseSwitchClauseSyntax>lastClauseNode.node();
      statements = caseClause.statements;
    } else if (
      lastClauseNode &&
      lastClauseNode.kind() == SyntaxKind.DefaultSwitchClause
    ) {
      var defaultClause = <CaseSwitchClauseSyntax>lastClauseNode.node();
      statements = defaultClause.statements;
    } else {
      return null;
    }

    return this.breakpointSpanOfLastChildOfSyntaxList(
      <PositionedList>lastClauseNode.getPositionedChild(statements)
    );
  }

  private breakpointSpanOfCaseSwitchClause(
    caseClauseNode: PositionedNode
  ): SpanInfo {
    var caseSwitchClause = <CaseSwitchClauseSyntax>caseClauseNode.node();
    return this.breakpointSpanOfFirstChildOfSyntaxList(
      <PositionedList>(
        caseClauseNode.getPositionedChild(caseSwitchClause.statements)
      )
    );
  }

  private breakpointSpanOfDefaultSwitchClause(
    defaultSwithClauseNode: PositionedNode
  ): SpanInfo {
    var defaultSwitchClause = <DefaultSwitchClauseSyntax>(
      defaultSwithClauseNode.node()
    );
    return this.breakpointSpanOfFirstChildOfSyntaxList(
      <PositionedList>(
        defaultSwithClauseNode.getPositionedChild(
          defaultSwitchClause.statements
        )
      )
    );
  }

  private breakpointSpanOfWithStatement(
    withStatementNode: PositionedNode
  ): SpanInfo {
    var withStatement = <WithStatementSyntax>withStatementNode.node();
    return this.breakpointSpanOf(
      withStatementNode.getPositionedChild(withStatement.statement)
    );
  }

  private breakpointSpanOfTryStatement(
    tryStatementNode: PositionedNode
  ): SpanInfo {
    var tryStatement = <TryStatementSyntax>tryStatementNode.node();
    return this.breakpointSpanOfFirstStatementInBlock(
      <PositionedNode>tryStatementNode.getPositionedChild(tryStatement.block)
    );
  }

  private breakpointSpanOfCatchClause(
    catchClauseNode: PositionedNode
  ): SpanInfo {
    var catchClause = <CatchClauseSyntax>catchClauseNode.node();
    return createBreakpointSpanInfo(
      catchClauseNode,
      catchClause.catchKeyword,
      catchClause.openParenToken,
      catchClause.identifier,
      catchClause.typeAnnotation,
      catchClause.closeParenToken
    );
  }

  private breakpointSpanOfFinallyClause(
    finallyClauseNode: PositionedNode
  ): SpanInfo {
    var finallyClause = <FinallyClauseSyntax>finallyClauseNode.node();
    return this.breakpointSpanOfFirstStatementInBlock(
      <PositionedNode>finallyClauseNode.getPositionedChild(finallyClause.block)
    );
  }

  private breakpointSpanOfContainingNode(
    positionedElement: PositionedElement
  ): SpanInfo {
    return this.breakpointSpanOf(positionedElement.containingNode());
  }

  private breakpointSpanIfStartsOnSameLine(
    positionedElement: PositionedElement
  ): SpanInfo {
    if (
      positionedElement &&
      this.posLine ==
        this.lineMap.getLineNumberFromPosition(positionedElement.start())
    ) {
      return this.breakpointSpanOf(positionedElement);
    }

    return null;
  }

  public breakpointSpanOf(positionedElement: PositionedElement): SpanInfo {
    if (!positionedElement) {
      return null;
    }

    for (
      var containingNode = positionedElement.containingNode();
      containingNode != null;
      containingNode = containingNode.containingNode()
    ) {
      if (containingNode.kind() == SyntaxKind.TypeAnnotation) {
        return this.breakpointSpanIfStartsOnSameLine(containingNode);
      }
    }

    var element = positionedElement.element();

    // Syntax node
    if (element.isNode()) {
      return this.breakpointSpanOfNode(<PositionedNode>positionedElement);
    }

    // Token
    if (element.isToken()) {
      return this.breakpointSpanOfToken(<PositionedToken>positionedElement);
    }

    // List
    // Separated List
    return this.breakpointSpanOfContainingNode(positionedElement);
  }
}

export function getBreakpointLocation(
  syntaxTree: SyntaxTree,
  askedPos: number
): SpanInfo {
  // Cannot set breakpoint in dts file
  if (isDTSFile(syntaxTree.fileName())) {
    return null;
  }

  var sourceUnit = syntaxTree.sourceUnit();
  var positionedToken = sourceUnit.findToken(askedPos);

  var lineMap = syntaxTree.lineMap();
  var posLine = lineMap.getLineNumberFromPosition(askedPos);
  var tokenStartLine = lineMap.getLineNumberFromPosition(
    positionedToken.start()
  );
  if (posLine < tokenStartLine) {
    return null;
  }

  var breakpointResolver = new BreakpointResolver(posLine, lineMap);
  return breakpointResolver.breakpointSpanOf(positionedToken);
}
