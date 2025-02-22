import { CheckedArray } from '../../runtime/rt';
import { ArrayUtilities } from '../core/arrayUtilities';
import { Debug } from '../core/debug';
import { Errors } from '../core/errors';
import {
  createHashTable,
  defaultHashTableCapacity,
  identityHashCode,
} from '../core/hashTable';
import {
  IFormattingOptions,
  createFormattingOptions,
} from './formattingOptions';
import {
  columnForStartOfToken as columnForStartOfTokenFn,
  columnForEndOfToken as columnForEndOfTokenFn,
  indentTrivia,
  columnForStartOfFirstTokenInLineContainingToken,
} from './indentation';
import { separatedList } from './separatedSyntaxList';
import {
  assignmentExpression,
  stringLiteralExpression,
  identifierName,
  isSuperInvocationExpressionStatement,
  trueExpression,
  numericLiteralExpression,
  isSuperMemberAccessExpression,
  isSuperInvocationExpression,
  isSuperMemberAccessInvocationExpression,
} from './syntax';
import { SyntaxDedenter } from './syntaxDedenter';
import {
  ISyntaxNode,
  IModuleElementSyntax,
  INameSyntax,
  IArrowFunctionExpressionSyntax,
  IExpressionSyntax,
  IStatementSyntax,
  IClassElementSyntax,
} from './syntaxElement';
import { IFactory, normalModeFactory } from './syntaxFactory.generated';
import { SyntaxFacts } from './syntaxFacts';
import { SyntaxIndenter } from './syntaxIndenter';
import { SyntaxInformationMap } from './syntaxInformationMap';
import { SyntaxKind } from './syntaxKind';
import { ISyntaxList, emptyList, list } from './syntaxList';
import { SyntaxNode } from './syntaxNode';
import { SyntaxNodeInvariantsChecker } from './syntaxNodeInvariantsChecker';
import { ISyntaxNodeOrToken } from './syntaxNodeOrToken';
import {
  ArgumentListSyntax,
  BinaryExpressionSyntax,
  BlockSyntax,
  CallSignatureSyntax,
  CastExpressionSyntax,
  ClassDeclarationSyntax,
  ConstructorDeclarationSyntax,
  ElementAccessExpressionSyntax,
  EnumDeclarationSyntax,
  EnumElementSyntax,
  ExpressionStatementSyntax,
  FunctionDeclarationSyntax,
  FunctionExpressionSyntax,
  HeritageClauseSyntax,
  IfStatementSyntax,
  InterfaceDeclarationSyntax,
  InvocationExpressionSyntax,
  MemberAccessExpressionSyntax,
  MemberFunctionDeclarationSyntax,
  MemberVariableDeclarationSyntax,
  MethodSignatureSyntax,
  ModuleDeclarationSyntax,
  ObjectLiteralExpressionSyntax,
  ParameterListSyntax,
  ParameterSyntax,
  ParenthesizedArrowFunctionExpressionSyntax,
  ParenthesizedExpressionSyntax,
  QualifiedNameSyntax,
  ReturnStatementSyntax,
  SimpleArrowFunctionExpressionSyntax,
  SimplePropertyAssignmentSyntax,
  SourceUnitSyntax,
  TypeParameterListSyntax,
  VariableDeclaratorSyntax,
  VariableStatementSyntax,
} from './syntaxNodes.generated';
import { SyntaxRewriter } from './syntaxRewriter.generated';
import { ISyntaxToken, identifier as identifierFn, token } from './syntaxToken';
import { carriageReturnLineFeedTrivia } from './syntaxTrivia';
import {
  ISyntaxTriviaList,
  emptyTriviaList,
  spaceTriviaList,
  triviaList as triviaListFn,
} from './syntaxTriviaList';

function callSignature(parameter: ParameterSyntax): CallSignatureSyntax {
  return CallSignatureSyntax.create1().withParameterList(
    ParameterListSyntax.create1().withParameter(parameter)
  );
}

// Class that makes sure we're not reusing tokens in a tree
class EnsureTokenUniquenessRewriter extends SyntaxRewriter {
  private tokenTable = createHashTable(
    defaultHashTableCapacity,
    identityHashCode
  );

  public visitToken(token: ISyntaxToken): ISyntaxToken {
    if (this.tokenTable.containsKey(token)) {
      // already saw this token.  so clone it and return a new one. so that the tree stays
      // unique/
      return token.clone();
    }

    this.tokenTable.add(token, token);
    return token;
  }
}

class EmitterImpl extends SyntaxRewriter {
  private syntaxInformationMap: SyntaxInformationMap;
  private options: IFormattingOptions;
  private space: ISyntaxTriviaList;
  private newLine: ISyntaxTriviaList;
  private factory: IFactory = normalModeFactory;

  constructor(
    syntaxInformationMap: SyntaxInformationMap,
    options?: IFormattingOptions
  ) {
    super();

    this.syntaxInformationMap = syntaxInformationMap;
    this.options = options ?? createFormattingOptions();

    // TODO: use proper new line based on options.
    this.space = spaceTriviaList;
    this.newLine = triviaListFn([carriageReturnLineFeedTrivia]);
  }

  private columnForStartOfToken(token: ISyntaxToken): number {
    return columnForStartOfTokenFn(
      token,
      this.syntaxInformationMap,
      this.options
    );
  }

  private columnForEndOfToken(token: ISyntaxToken): number {
    return columnForEndOfTokenFn(
      token,
      this.syntaxInformationMap,
      this.options
    );
  }

  private indentationTrivia(column: number): ISyntaxTriviaList {
    var triviaArray =
      column === 0 ? null : [indentTrivia(column, this.options)];
    return triviaListFn(triviaArray);
  }

  private indentationTriviaForStartOfNode(
    node: ISyntaxNodeOrToken
  ): ISyntaxTriviaList {
    var column = this.columnForStartOfToken(node.firstToken());
    return this.indentationTrivia(column);
  }

  private changeIndentation(
    node: ISyntaxNode,
    changeFirstToken: boolean,
    indentAmount: number
  ): ISyntaxNode {
    if (indentAmount === 0) {
      return node;
    } else if (indentAmount > 0) {
      return SyntaxIndenter.indentNode(
        node,
        /*indentFirstToken:*/ changeFirstToken,
        /*indentAmount:*/ indentAmount,
        this.options
      );
    } else {
      // Dedent the node.  But don't allow it go before the minimum indent amount.
      return SyntaxDedenter.dedentNode(
        node,
        /*dedentFirstToken:*/ changeFirstToken,
        /*dedentAmount:*/ -indentAmount,
        /*minimumColumn:*/ this.options.indentSpaces,
        this.options
      );
    }
  }

  private withNoTrivia(token: ISyntaxToken): ISyntaxToken {
    return token
      .withLeadingTrivia(emptyTriviaList)
      .withTrailingTrivia(emptyTriviaList);
  }

  public visitSourceUnit(node: SourceUnitSyntax): SourceUnitSyntax {
    return node.withModuleElements(
      list(this.convertModuleElements(node.moduleElements))
    );
  }

  private convertModuleElements(list: ISyntaxList): IModuleElementSyntax[] {
    var moduleElements: IModuleElementSyntax[] = [];

    for (var i = 0, n = list.childCount(); i < n; i++) {
      var moduleElement = list.childAt(i);

      var converted = this.visitNode(<SyntaxNode>moduleElement);
      if (converted !== null) {
        if (ArrayUtilities.isArray(converted)) {
          moduleElements.push(
            ...(converted as unknown as IModuleElementSyntax[])
          );
        } else {
          moduleElements.push(<IModuleElementSyntax>converted);
        }
      }
    }

    return moduleElements;
  }

  private static splitModuleName(name: INameSyntax): ISyntaxToken[] {
    var result: ISyntaxToken[] = [];
    while (true) {
      if (name.kind() === SyntaxKind.IdentifierName) {
        result.unshift(<ISyntaxToken>name);
        return result;
      } else if (name.kind() === SyntaxKind.QualifiedName) {
        var qualifiedName = <QualifiedNameSyntax>name;
        result.unshift(qualifiedName.right);
        name = qualifiedName.left;
      } else {
        throw Errors.invalidOperation();
      }
    }
  }

  private leftmostName(name: INameSyntax): ISyntaxToken {
    while (name.kind() === SyntaxKind.QualifiedName) {
      name = (<QualifiedNameSyntax>name).left;
    }

    return <ISyntaxToken>name;
  }

  private rightmostName(name: INameSyntax): ISyntaxToken {
    if (name.kind() === SyntaxKind.QualifiedName) {
      return (<QualifiedNameSyntax>name).right;
    }

    return <ISyntaxToken>name;
  }

  private containsToken(list: ISyntaxList, kind: SyntaxKind): boolean {
    for (var i = 0, n = list.childCount(); i < n; i++) {
      if (list.childAt(i).kind() === kind) {
        return true;
      }
    }

    return false;
  }

  private exportModuleElement(
    moduleIdentifier: ISyntaxToken,
    moduleElement: IModuleElementSyntax,
    elementIdentifier: ISyntaxToken
  ): ExpressionStatementSyntax {
    elementIdentifier = this.withNoTrivia(elementIdentifier);

    // M1.e = e;
    return ExpressionStatementSyntax.create1(
      this.factory.binaryExpression(
        SyntaxKind.AssignmentExpression,
        MemberAccessExpressionSyntax.create1(
          this.withNoTrivia(moduleIdentifier),
          elementIdentifier.withTrailingTrivia(spaceTriviaList)
        ),
        token(SyntaxKind.EqualsToken).withTrailingTrivia(this.space),
        elementIdentifier
      )
    )
      .withLeadingTrivia(this.indentationTriviaForStartOfNode(moduleElement))
      .withTrailingTrivia(this.newLine);
  }

  private handleExportedModuleElement(
    parentModule: ISyntaxToken,
    moduleElement: IModuleElementSyntax,
    elements: IModuleElementSyntax[]
  ): void {
    if (moduleElement.kind() === SyntaxKind.VariableStatement) {
      var variableStatement = <VariableStatementSyntax>moduleElement;
      if (
        this.containsToken(
          variableStatement.modifiers,
          SyntaxKind.ExportKeyword
        )
      ) {
        var declarators =
          variableStatement.variableDeclaration.variableDeclarators;
        for (var i = 0, n = declarators.nonSeparatorCount(); i < n; i++) {
          var declarator = <VariableDeclaratorSyntax>(
            declarators.nonSeparatorAt(i)
          );
          elements.push(
            this.exportModuleElement(
              parentModule,
              moduleElement,
              declarator.propertyName
            )
          );
        }
      }
    } else if (moduleElement.kind() === SyntaxKind.FunctionDeclaration) {
      var functionDeclaration = <FunctionDeclarationSyntax>moduleElement;
      if (
        this.containsToken(
          functionDeclaration.modifiers,
          SyntaxKind.ExportKeyword
        )
      ) {
        elements.push(
          this.exportModuleElement(
            parentModule,
            moduleElement,
            functionDeclaration.identifier
          )
        );
      }
    } else if (moduleElement.kind() === SyntaxKind.ClassDeclaration) {
      var classDeclaration = <ClassDeclarationSyntax>moduleElement;
      if (
        this.containsToken(classDeclaration.modifiers, SyntaxKind.ExportKeyword)
      ) {
        elements.push(
          this.exportModuleElement(
            parentModule,
            moduleElement,
            classDeclaration.identifier
          )
        );
      }
    } else if (moduleElement.kind() === SyntaxKind.ModuleDeclaration) {
      var childModule = <ModuleDeclarationSyntax>moduleElement;
      if (this.containsToken(childModule.modifiers, SyntaxKind.ExportKeyword)) {
        elements.push(
          this.exportModuleElement(
            parentModule,
            moduleElement,
            this.leftmostName(childModule.name)
          )
        );
      }
    }
  }

  public visitModuleDeclaration(
    node: ModuleDeclarationSyntax
  ): IModuleElementSyntax[] {
    var _this = this;

    // Recurse downwards and get the rewritten children.
    var moduleElements = this.convertModuleElements(node.moduleElements);

    if (this.mustCaptureThisInModule(node)) {
      // TODO: determine the right column for the 'this capture' statment.
      moduleElements.unshift(this.generateThisCaptureStatement(0));
    }

    // Handle the case where the child is an export.
    var parentModule = this.rightmostName(node.name);
    for (var i = 0, n = node.moduleElements.childCount(); i < n; i++) {
      this.handleExportedModuleElement(
        parentModule,
        <IModuleElementSyntax>node.moduleElements.childAt(i),
        moduleElements
      );
    }

    // Break up the dotted name into pieces.
    var names = EmitterImpl.splitModuleName(node.name);

    // Then, for all the names left of that name, wrap what we've created in a larger module.
    for (var nameIndex = names.length - 1; nameIndex >= 0; nameIndex--) {
      moduleElements = this.convertModuleDeclaration(
        node,
        names[nameIndex],
        moduleElements,
        nameIndex === 0
      );

      if (nameIndex > 0) {
        // We're popping out and generate each outer module.  As we do so, we have to
        // indent whatever we've created so far appropriately.
        moduleElements.push(
          this.exportModuleElement(names[nameIndex - 1], node, names[nameIndex])
        );

        moduleElements = <IModuleElementSyntax[]>(
          ArrayUtilities.select(moduleElements, (e) =>
            _this.changeIndentation(
              e,
              /*indentFirstToken:*/ true,
              _this.options.indentSpaces
            )
          )
        );
      }
    }

    return moduleElements;
  }

  private initializedVariable(name: ISyntaxToken): BinaryExpressionSyntax {
    return this.factory.binaryExpression(
      SyntaxKind.LogicalOrExpression,
      name,
      token(SyntaxKind.BarBarToken),
      ParenthesizedExpressionSyntax.create1(
        assignmentExpression(
          name,
          token(SyntaxKind.EqualsToken),
          ObjectLiteralExpressionSyntax.create1()
        )
      )
    );
  }

  private convertModuleDeclaration(
    moduleDeclaration: ModuleDeclarationSyntax,
    moduleName: ISyntaxToken,
    moduleElements: IModuleElementSyntax[],
    outermost: boolean
  ): IModuleElementSyntax[] {
    moduleName = moduleName
      .withLeadingTrivia(emptyTriviaList)
      .withTrailingTrivia(emptyTriviaList);
    var moduleIdentifier = moduleName;

    var moduleIndentation =
      this.indentationTriviaForStartOfNode(moduleDeclaration);
    var leadingTrivia = outermost
      ? moduleDeclaration.leadingTrivia()
      : moduleIndentation;

    // var M;
    var variableStatement = VariableStatementSyntax.create1(
      this.factory.variableDeclaration(
        token(SyntaxKind.VarKeyword).withTrailingTrivia(this.space),
        separatedList([VariableDeclaratorSyntax.create(moduleIdentifier)])
      )
    )
      .withLeadingTrivia(leadingTrivia)
      .withTrailingTrivia(this.newLine);

    // function(M) { ... }
    var functionExpression = FunctionExpressionSyntax.create1()
      .withCallSignature(
        callSignature(
          ParameterSyntax.create(moduleIdentifier)
        ).withTrailingTrivia(this.space)
      )
      .withBlock(
        this.factory.block(
          token(SyntaxKind.OpenBraceToken).withTrailingTrivia(this.newLine),
          list(moduleElements),
          token(SyntaxKind.CloseBraceToken).withLeadingTrivia(moduleIndentation)
        )
      );

    // (function(M) { ... })(M||(M={}));
    var expressionStatement = ExpressionStatementSyntax.create1(
      this.factory.invocationExpression(
        ParenthesizedExpressionSyntax.create1(functionExpression),
        ArgumentListSyntax.create1().withArg(
          this.initializedVariable(moduleName)
        )
      )
    )
      .withLeadingTrivia(moduleIndentation)
      .withTrailingTrivia(this.newLine);

    return [<IModuleElementSyntax>variableStatement, expressionStatement];
  }

  public visitExpressionStatement(
    node: ExpressionStatementSyntax
  ): ExpressionStatementSyntax {
    // Can't have an expression statement with an anonymous function expression in it.
    var rewritten: ExpressionStatementSyntax = super.visitExpressionStatement(
      node
    );

    // convert: function() { ... };  to (function() { ... });
    if (rewritten.expression.kind() === SyntaxKind.FunctionExpression) {
      // Wasn a function expression
      var functionExpression = <FunctionExpressionSyntax>rewritten.expression;
      if (functionExpression.identifier === null) {
        // Was anonymous.

        // Remove the leading trivia from the function keyword.  We'll put it on the open paren
        // token instead.

        // Now, wrap the function expression in parens to make it legal in javascript.
        var parenthesizedExpression = ParenthesizedExpressionSyntax.create1(
          functionExpression.withLeadingTrivia(emptyTriviaList)
        ).withLeadingTrivia(functionExpression.leadingTrivia());

        return rewritten.withExpression(parenthesizedExpression);
      }
    }

    return rewritten;
  }

  public visitSimpleArrowFunctionExpression(
    node: SimpleArrowFunctionExpressionSyntax
  ): FunctionExpressionSyntax {
    return FunctionExpressionSyntax.create1()
      .withCallSignature(
        callSignature(
          ParameterSyntax.create(this.withNoTrivia(node.identifier))
        ).withTrailingTrivia(this.space)
      )
      .withBlock(this.convertArrowFunctionBody(node))
      .withLeadingTrivia(node.leadingTrivia());
  }

  public visitParenthesizedArrowFunctionExpression(
    node: ParenthesizedArrowFunctionExpressionSyntax
  ): FunctionExpressionSyntax {
    return FunctionExpressionSyntax.create1()
      .withCallSignature(
        CallSignatureSyntax.create(
          node.callSignature.parameterList.accept(this)
        )
      )
      .withBlock(this.convertArrowFunctionBody(node))
      .withLeadingTrivia(node.leadingTrivia());
  }

  private convertArrowFunctionBody(
    arrowFunction: IArrowFunctionExpressionSyntax
  ): BlockSyntax {
    var rewrittenBody = arrowFunction.block
      ? this.visitNode(arrowFunction.block)
      : this.visitNodeOrToken(arrowFunction.expression);

    if (rewrittenBody.kind() === SyntaxKind.Block) {
      return <BlockSyntax>rewrittenBody;
    }

    var arrowToken = arrowFunction.equalsGreaterThanToken;

    // first, attach the expression to the return statement
    var returnStatement = this.factory
      .returnStatement(
        token(SyntaxKind.ReturnKeyword, {
          trailingTrivia: arrowToken.trailingTrivia().toArray(),
        }),
        <IExpressionSyntax>rewrittenBody,
        token(SyntaxKind.SemicolonToken)
      )
      .withTrailingTrivia(this.newLine);

    // We want to adjust the indentation of the expression so that is aligns as it
    // did before.  For example, if we started with:
    //
    //          a => foo().bar()
    //                    .baz()
    //
    // Then we want to end up with:
    //
    //          return foo().bar()
    //                      .baz()
    //
    // To do this we look at where the previous token (=>) used to end and where the new pevious
    // token (return) ends.  The difference (in this case '2') is our offset.

    var difference = 0;
    if (arrowToken.hasTrailingNewLine()) {
      // The expression is on the next line.  i.e.
      //
      //      foo =>
      //          expr
      //
      // So we want it to immediately follow the return statement. i.e.:
      //
      //      return
      //          expr;
      //
      // and we adjust based on the column difference between the start of the arrow function
      // and the start of the expr.
      var arrowFunctionStart = this.columnForStartOfToken(
        arrowFunction.firstToken()
      );
      difference = -arrowFunctionStart;
    } else {
      // the expression immediately follows the arrow. i.e.:
      //
      //      foo => expr
      //
      // So we want it to immediately follow the return statement. i.e.:
      //
      //      return expr;
      //
      // and we adjust based on the column difference between the end of the arrow token and
      // the end of the return statement.
      var arrowEndColumn = this.columnForEndOfToken(arrowToken);
      var returnKeywordEndColumn = returnStatement.returnKeyword.width();
      difference = returnKeywordEndColumn - arrowEndColumn;
    }

    returnStatement = <ReturnStatementSyntax>(
      this.changeIndentation(
        returnStatement,
        /*changeFirstToken:*/ false,
        difference
      )
    );

    // Next, indent the return statement.  It's going in a block, so it needs to be properly
    // indented.  Note we do this *after* we've ensured the expression aligns properly.

    returnStatement = <ReturnStatementSyntax>(
      this.changeIndentation(
        returnStatement,
        /*indentFirstToken:*/ true,
        this.options.indentSpaces
      )
    );

    // Now wrap the return statement in a block.
    var block = this.factory.block(
      token(SyntaxKind.OpenBraceToken).withTrailingTrivia(this.newLine),
      list([returnStatement] as CheckedArray<ReturnStatementSyntax>),
      token(SyntaxKind.CloseBraceToken)
    );

    // Note: if we started with something like:
    //
    //      var v = a => 1;
    //
    // Then we want to convert that to:
    //
    //      var v = function(a) {
    //          return 1;
    //      };
    //
    // However, right now what we've created is:
    //
    // {
    //     return 1;
    // }
    //
    // So we need to indent the block with our current column indent so that it aligns with the
    // parent structure.  Note: we don't wan to adjust the leading brace as that's going to go
    // after the function sigature.

    return <BlockSyntax>(
      this.changeIndentation(
        block,
        /*indentFirstToken:*/ false,
        columnForStartOfFirstTokenInLineContainingToken(
          arrowFunction.firstToken(),
          this.syntaxInformationMap,
          this.options
        )
      )
    );
  }

  private static methodSignatureDefaultParameters(
    signature: MethodSignatureSyntax
  ): ParameterSyntax[] {
    return EmitterImpl.callSignatureDefaultParameters(signature.callSignature);
  }

  private static callSignatureDefaultParameters(
    callSignature: CallSignatureSyntax
  ): ParameterSyntax[] {
    return EmitterImpl.parameterListDefaultParameters(
      callSignature.parameterList
    );
  }

  private static parameterListDefaultParameters(
    parameterList: ParameterListSyntax
  ): ParameterSyntax[] {
    return ArrayUtilities.where(
      <ParameterSyntax[]>parameterList.parameters.toNonSeparatorArray(),
      (p) => p.equalsValueClause !== null
    );
  }

  private generatePropertyAssignmentStatement(
    parameter: ParameterSyntax
  ): ExpressionStatementSyntax {
    var identifier = this.withNoTrivia(parameter.identifier);

    // this.foo = foo;
    return ExpressionStatementSyntax.create1(
      assignmentExpression(
        MemberAccessExpressionSyntax.create1(
          token(SyntaxKind.ThisKeyword),
          identifier.withTrailingTrivia(spaceTriviaList)
        ),
        token(SyntaxKind.EqualsToken).withTrailingTrivia(this.space),
        identifier
      )
    ).withTrailingTrivia(this.newLine);
  }

  private generateDefaultValueAssignmentStatement(
    parameter: ParameterSyntax
  ): IfStatementSyntax {
    var identifierName = this.withNoTrivia(
      parameter.identifier
    ).withTrailingTrivia(this.space);

    // typeof foo === 'undefined'
    var condition = this.factory.binaryExpression(
      SyntaxKind.EqualsExpression,
      this.factory.typeOfExpression(
        token(SyntaxKind.TypeOfKeyword).withTrailingTrivia(this.space),
        identifierName
      ),
      token(SyntaxKind.EqualsEqualsEqualsToken).withTrailingTrivia(this.space),
      stringLiteralExpression('"undefined"')
    );

    // foo = expr;
    var assignmentStatement = ExpressionStatementSyntax.create1(
      assignmentExpression(
        identifierName,
        token(SyntaxKind.EqualsToken).withTrailingTrivia(this.space),
        parameter.equalsValueClause.value.accept(this)
      )
    ).withTrailingTrivia(this.space);

    var block = this.factory
      .block(
        token(SyntaxKind.OpenBraceToken).withTrailingTrivia(this.space),
        list([assignmentStatement] as CheckedArray<ExpressionStatementSyntax>),
        token(SyntaxKind.CloseBraceToken)
      )
      .withTrailingTrivia(this.newLine);

    // if (typeof foo === 'undefined') { foo = expr; }
    return this.factory.ifStatement(
      token(SyntaxKind.IfKeyword).withTrailingTrivia(this.space),
      token(SyntaxKind.OpenParenToken),
      condition,
      token(SyntaxKind.CloseParenToken).withTrailingTrivia(this.space),
      block,
      null
    );
  }

  public visitFunctionDeclaration(
    node: FunctionDeclarationSyntax
  ): FunctionDeclarationSyntax {
    if (node.block === null) {
      // Function overloads aren't emitted.
      return null;
    }

    var rewritten = <FunctionDeclarationSyntax>(
      super.visitFunctionDeclaration(node)
    );
    var parametersWithDefaults = EmitterImpl.callSignatureDefaultParameters(
      node.callSignature
    );

    if (parametersWithDefaults.length !== 0) {
      var defaultValueAssignmentStatements = ArrayUtilities.select(
        parametersWithDefaults,
        (p) => this.generateDefaultValueAssignmentStatement(p)
      );

      var statementColumn =
        this.columnForStartOfToken(node.firstToken()) +
        this.options.indentSpaces;
      var statements = <IStatementSyntax[]>(
        ArrayUtilities.select(defaultValueAssignmentStatements, (s) =>
          this.changeIndentation(s, /*indentFirstToken:*/ true, statementColumn)
        )
      );

      // Capture _this if necessary
      if (this.mustCaptureThisInFunction(node)) {
        statements.push(this.generateThisCaptureStatement(statementColumn));
      }

      // @ts-expect-error MD: Oopsie in type?
      statements.push.apply(statements, rewritten.block.statements.toArray());

      rewritten = rewritten.withBlock(
        rewritten.block.withStatements(
          list(statements as CheckedArray<ISyntaxNodeOrToken>)
        )
      );
    }

    return rewritten
      .withModifiers(emptyList)
      .withLeadingTrivia(rewritten.leadingTrivia());
  }

  public visitParameter(node: ParameterSyntax): ParameterSyntax {
    // transfer the trivia from the first token to the the identifier.
    return ParameterSyntax.create(node.identifier)
      .withLeadingTrivia(node.leadingTrivia())
      .withTrailingTrivia(node.trailingTrivia());
  }

  // MD: renamed static to isStatic to avoid conflict with static keyword
  private generatePropertyAssignment(
    classDeclaration: ClassDeclarationSyntax,
    isStatic: boolean,
    memberDeclaration: MemberVariableDeclarationSyntax
  ): ExpressionStatementSyntax {
    var isStatic = this.containsToken(
      memberDeclaration.modifiers,
      SyntaxKind.StaticKeyword
    );
    var declarator = memberDeclaration.variableDeclarator;
    if (isStatic !== isStatic || declarator.equalsValueClause === null) {
      return null;
    }

    // this.foo = expr;
    var receiver = MemberAccessExpressionSyntax.create1(
      isStatic
        ? <IExpressionSyntax>this.withNoTrivia(classDeclaration.identifier)
        : token(SyntaxKind.ThisKeyword),
      this.withNoTrivia(declarator.propertyName)
    ).withTrailingTrivia(spaceTriviaList);

    return ExpressionStatementSyntax.create1(
      assignmentExpression(
        receiver,
        token(SyntaxKind.EqualsToken).withTrailingTrivia(this.space),
        declarator.equalsValueClause.value
          .accept(this)
          .withTrailingTrivia(emptyTriviaList)
      )
    )
      .withLeadingTrivia(memberDeclaration.leadingTrivia())
      .withTrailingTrivia(this.newLine);
  }

  // MD: renamed static to isStatic to avoid conflict with static keyword
  private generatePropertyAssignments(
    classDeclaration: ClassDeclarationSyntax,
    isStatic: boolean
  ): ExpressionStatementSyntax[] {
    var result: ExpressionStatementSyntax[] = [];

    // TODO: handle alignment here.
    for (
      var i = 0, n = classDeclaration.classElements.childCount();
      i < n;
      i++
    ) {
      var classElement = classDeclaration.classElements.childAt(i);

      if (classElement.kind() === SyntaxKind.MemberVariableDeclaration) {
        var statement = this.generatePropertyAssignment(
          classDeclaration,
          isStatic,
          <MemberVariableDeclarationSyntax>classElement
        );
        if (statement !== null) {
          result.push(statement);
        }
      }
    }

    return result;
  }

  private createDefaultConstructorDeclaration(
    classDeclaration: ClassDeclarationSyntax
  ): FunctionDeclarationSyntax {
    var classIndentationColumn = this.columnForStartOfToken(
      classDeclaration.firstToken()
    );
    var statementIndentationColumn =
      classIndentationColumn + this.options.indentSpaces;

    var statements: IStatementSyntax[] = [];
    if (classDeclaration.heritageClauses.childCount() > 0) {
      statements.push(
        ExpressionStatementSyntax.create1(
          this.factory.invocationExpression(
            MemberAccessExpressionSyntax.create1(
              identifierName('_super'),
              identifierName('apply')
            ),
            ArgumentListSyntax.create1().withArgs(
              separatedList([
                token(SyntaxKind.ThisKeyword),
                token(SyntaxKind.CommaToken).withTrailingTrivia(this.space),
                identifierName('args'),
              ])
            )
          )
        )
          .withLeadingTrivia(this.indentationTrivia(statementIndentationColumn))
          .withTrailingTrivia(this.newLine)
      );
    }

    if (this.mustCaptureThisInClass(classDeclaration)) {
      statements.push(
        this.generateThisCaptureStatement(statementIndentationColumn)
      );
    }

    statements.push.apply(
      statements,
      this.generatePropertyAssignments(classDeclaration, /*static:*/ false)
    );

    var indentationTrivia = this.indentationTrivia(classIndentationColumn);

    var functionDeclaration = FunctionDeclarationSyntax.create(
      token(SyntaxKind.FunctionKeyword)
        .withLeadingTrivia(indentationTrivia)
        .withTrailingTrivia(this.space),
      this.withNoTrivia(classDeclaration.identifier),
      CallSignatureSyntax.create1().withTrailingTrivia(this.space)
    )
      .withBlock(
        this.factory.block(
          token(SyntaxKind.OpenBraceToken).withTrailingTrivia(this.newLine),
          list(statements as CheckedArray<IStatementSyntax>),
          token(SyntaxKind.CloseBraceToken).withLeadingTrivia(indentationTrivia)
        )
      )
      .withTrailingTrivia(this.newLine);

    return <FunctionDeclarationSyntax>(
      this.changeIndentation(
        functionDeclaration,
        /*indentFirstToken:*/ true,
        this.options.indentSpaces
      )
    );
  }

  private convertConstructorDeclaration(
    classDeclaration: ClassDeclarationSyntax,
    constructorDeclaration: ConstructorDeclarationSyntax
  ): FunctionDeclarationSyntax {
    if (constructorDeclaration.block === null) {
      return null;
    }

    var i: number;
    var identifier = this.withNoTrivia(classDeclaration.identifier);

    var constructorIndentationColumn = this.columnForStartOfToken(
      constructorDeclaration.firstToken()
    );
    var originalParameterListindentation = this.columnForStartOfToken(
      constructorDeclaration.parameterList.firstToken()
    );

    // The original indent + "function" + <space> + "ClassName"
    var newParameterListIndentation =
      constructorIndentationColumn +
      SyntaxFacts.getText(SyntaxKind.FunctionKeyword).length +
      1 +
      identifier.width();

    var parameterList = constructorDeclaration.parameterList.accept(this);
    parameterList = this.changeIndentation(
      parameterList,
      /*changeFirstToken:*/ false,
      newParameterListIndentation - originalParameterListindentation
    );

    var block = constructorDeclaration.block;
    var allStatements = <SyntaxNode[]>block.statements.toArray();

    var normalStatements: IStatementSyntax[] = ArrayUtilities.select<any, any>(
      ArrayUtilities.where(
        allStatements,
        (s) => !isSuperInvocationExpressionStatement(s)
      ),
      (s) => s.accept(this)
    );

    var instanceAssignments = this.generatePropertyAssignments(
      classDeclaration,
      /*static:*/ false
    );

    for (i = instanceAssignments.length - 1; i >= 0; i--) {
      normalStatements.unshift(
        <ExpressionStatementSyntax>(
          this.changeIndentation(
            instanceAssignments[i],
            /*changeFirstToken:*/ true,
            this.options.indentSpaces
          )
        )
      );
    }

    var parameterPropertyAssignments = <ExpressionStatementSyntax[]>(
      ArrayUtilities.select(
        ArrayUtilities.where(
          <ParameterSyntax[]>(
            constructorDeclaration.parameterList.parameters.toNonSeparatorArray()
          ),
          (p) => p.modifiers.childCount() > 0
        ),
        (p) => this.generatePropertyAssignmentStatement(p)
      )
    );

    for (i = parameterPropertyAssignments.length - 1; i >= 0; i--) {
      normalStatements.unshift(
        <IStatementSyntax>(
          this.changeIndentation(
            parameterPropertyAssignments[i],
            /*changeFirstToken:*/ true,
            this.options.indentSpaces + constructorIndentationColumn
          )
        )
      );
    }

    var superStatements: IStatementSyntax[] = ArrayUtilities.select<any, any>(
      ArrayUtilities.where(allStatements, (s) =>
        isSuperInvocationExpressionStatement(s)
      ),
      (s) => s.accept(this)
    );

    normalStatements.unshift.apply(normalStatements, superStatements);

    // TODO: use typecheck to determine if 'this' needs to be captured.
    if (this.mustCaptureThisInConstructor(constructorDeclaration)) {
      normalStatements.unshift(
        this.generateThisCaptureStatement(
          this.options.indentSpaces + constructorIndentationColumn
        )
      );
    }

    var defaultValueAssignments = <IfStatementSyntax[]>(
      ArrayUtilities.select(
        EmitterImpl.parameterListDefaultParameters(
          constructorDeclaration.parameterList
        ),
        (p) => this.generateDefaultValueAssignmentStatement(p)
      )
    );

    for (i = defaultValueAssignments.length - 1; i >= 0; i--) {
      normalStatements.unshift(
        <IStatementSyntax>(
          this.changeIndentation(
            defaultValueAssignments[i],
            /*changeFirstToken:*/ true,
            this.options.indentSpaces + constructorIndentationColumn
          )
        )
      );
    }

    // function C(...) { ... }
    return FunctionDeclarationSyntax.create(
      token(SyntaxKind.FunctionKeyword).withTrailingTrivia(this.space),
      identifier,
      CallSignatureSyntax.create(parameterList)
    )
      .withBlock(
        block.withStatements(
          list(normalStatements as CheckedArray<ISyntaxNodeOrToken>)
        )
      )
      .withLeadingTrivia(constructorDeclaration.leadingTrivia());
  }

  private convertMemberFunctionDeclaration(
    classDeclaration: ClassDeclarationSyntax,
    functionDeclaration: MemberFunctionDeclarationSyntax
  ): ExpressionStatementSyntax {
    var _this = this;
    if (functionDeclaration.block === null) {
      return null;
    }

    var classIdentifier = this.withNoTrivia(classDeclaration.identifier);
    var functionIdentifier = this.withNoTrivia(
      functionDeclaration.propertyName
    );

    var receiver: IExpressionSyntax = classIdentifier.withLeadingTrivia(
      functionDeclaration.leadingTrivia()
    );

    receiver = this.containsToken(
      functionDeclaration.modifiers,
      SyntaxKind.StaticKeyword
    )
      ? receiver
      : MemberAccessExpressionSyntax.create1(
          receiver,
          identifierName('prototype')
        );

    receiver = MemberAccessExpressionSyntax.create1(
      receiver,
      functionIdentifier.withTrailingTrivia(spaceTriviaList)
    );

    var block: BlockSyntax = functionDeclaration.block.accept(this);
    var blockTrailingTrivia = block.trailingTrivia();

    block = block.withTrailingTrivia(emptyTriviaList);

    var defaultValueAssignments = <IStatementSyntax[]>(
      ArrayUtilities.select(
        EmitterImpl.callSignatureDefaultParameters(
          functionDeclaration.callSignature
        ),
        (p) => _this.generateDefaultValueAssignmentStatement(p)
      )
    );

    var functionColumn = this.columnForStartOfToken(
      functionDeclaration.firstToken()
    );

    var blockStatements = block.statements.toArray();
    for (var i = defaultValueAssignments.length - 1; i >= 0; i--) {
      blockStatements.unshift(
        this.changeIndentation(
          defaultValueAssignments[i],
          /*changeFirstToken:*/ true,
          functionColumn + this.options.indentSpaces
        )
      );
    }

    var callSignatureParameterList = <ParameterListSyntax>(
      functionDeclaration.callSignature.parameterList.accept(this)
    );
    if (!callSignatureParameterList.hasTrailingTrivia()) {
      callSignatureParameterList = <ParameterListSyntax>(
        callSignatureParameterList.withTrailingTrivia(spaceTriviaList)
      );
    }

    // C.prototype.f = function (p1, p2) { ...  };
    return ExpressionStatementSyntax.create1(
      assignmentExpression(
        receiver,
        token(SyntaxKind.EqualsToken).withTrailingTrivia(this.space),
        FunctionExpressionSyntax.create1()
          .withCallSignature(
            CallSignatureSyntax.create(callSignatureParameterList)
          )
          .withBlock(block.withStatements(list(blockStatements)))
      )
    ).withTrailingTrivia(blockTrailingTrivia);
  }

  private convertMemberAccessor(
    memberAccessor: SyntaxNode
  ): SimplePropertyAssignmentSyntax {
    var propertyName =
      memberAccessor.kind() === SyntaxKind.GetAccessor ? 'get' : 'set';

    var parameterList = <ParameterListSyntax>(
      (<any>memberAccessor).parameterList.accept(this)
    );
    if (!parameterList.hasTrailingTrivia()) {
      parameterList = parameterList.withTrailingTrivia(spaceTriviaList);
    }

    return this.factory
      .simplePropertyAssignment(
        identifierFn(propertyName),
        token(SyntaxKind.ColonToken).withTrailingTrivia(this.space),
        FunctionExpressionSyntax.create(
          token(SyntaxKind.FunctionKeyword),
          CallSignatureSyntax.create(parameterList),
          (<any>memberAccessor).block
            .accept(this)
            .withTrailingTrivia(emptyTriviaList)
        )
      )
      .withLeadingTrivia(this.indentationTriviaForStartOfNode(memberAccessor));
  }

  private convertMemberAccessorDeclaration(
    classDeclaration: ClassDeclarationSyntax,
    memberAccessor: SyntaxNode,
    classElements: IClassElementSyntax[]
  ): IStatementSyntax {
    var name = (<any>memberAccessor).propertyName.valueText();
    var i: number;

    // Find all the accessors with that name.
    var accessors: any[] = [memberAccessor];

    for (i = classElements.length - 1; i >= 0; i--) {
      var element = classElements[i];
      if (
        element.kind() === SyntaxKind.GetAccessor ||
        element.kind() === SyntaxKind.SetAccessor
      ) {
        var otherAccessor = <SyntaxNode>element;
        if (
          (<any>otherAccessor).propertyName.value() === name &&
          (<any>otherAccessor).block !== null
        ) {
          accessors.push(otherAccessor);
          classElements.splice(i, 1);
        }
      }
    }

    // MD: Renamed from arguments to argumentList to avoid conflict with arguments keyword
    var argumentList = [
      <any>(
        MemberAccessExpressionSyntax.create1(
          this.withNoTrivia(classDeclaration.identifier),
          identifierName('prototype')
        )
      ),
      token(SyntaxKind.CommaToken).withTrailingTrivia(this.space),
      stringLiteralExpression(
        '"' + (<any>memberAccessor).propertyName.text() + '"'
      ),
      token(SyntaxKind.CommaToken).withTrailingTrivia(this.space),
    ];

    var propertyAssignments: ISyntaxNodeOrToken[] = [];
    for (i = 0; i < accessors.length; i++) {
      var converted = this.convertMemberAccessor(accessors[i]);
      converted = <SimplePropertyAssignmentSyntax>(
        this.changeIndentation(
          converted,
          /*changeFirstToken:*/ true,
          this.options.indentSpaces
        )
      );
      propertyAssignments.push(converted);
      propertyAssignments.push(
        token(SyntaxKind.CommaToken).withTrailingTrivia(this.newLine)
      );
    }

    var accessorColumn = this.columnForStartOfToken(
      memberAccessor.firstToken()
    );
    var accessorTrivia = this.indentationTrivia(accessorColumn);
    var propertyTrivia = this.indentationTrivia(
      accessorColumn + this.options.indentSpaces
    );

    propertyAssignments.push(
      this.factory
        .simplePropertyAssignment(
          identifierFn('enumerable'),
          token(SyntaxKind.ColonToken).withTrailingTrivia(this.space),
          trueExpression()
        )
        .withLeadingTrivia(propertyTrivia)
    );
    propertyAssignments.push(
      token(SyntaxKind.CommaToken).withTrailingTrivia(this.newLine)
    );

    propertyAssignments.push(
      this.factory
        .simplePropertyAssignment(
          identifierFn('configurable'),
          token(SyntaxKind.ColonToken).withTrailingTrivia(this.space),
          trueExpression()
        )
        .withLeadingTrivia(propertyTrivia)
        .withTrailingTrivia(this.newLine)
    );

    argumentList.push(
      this.factory.objectLiteralExpression(
        token(SyntaxKind.OpenBraceToken).withTrailingTrivia(this.newLine),
        separatedList(propertyAssignments),
        token(SyntaxKind.CloseBraceToken).withLeadingTrivia(accessorTrivia)
      )
    );

    return ExpressionStatementSyntax.create1(
      this.factory.invocationExpression(
        MemberAccessExpressionSyntax.create1(
          identifierName('Object'),
          identifierName('defineProperty')
        ),
        ArgumentListSyntax.create1().withArgs(separatedList(argumentList))
      )
    )
      .withLeadingTrivia(memberAccessor.leadingTrivia())
      .withTrailingTrivia(this.newLine);
  }

  private convertClassElements(
    classDeclaration: ClassDeclarationSyntax
  ): IStatementSyntax[] {
    var result: IStatementSyntax[] = [];

    var classElements = <IClassElementSyntax[]>(
      classDeclaration.classElements.toArray()
    );
    while (classElements.length > 0) {
      var classElement = classElements.shift();

      var converted: IStatementSyntax = null;
      if (classElement.kind() === SyntaxKind.MemberFunctionDeclaration) {
        converted = this.convertMemberFunctionDeclaration(
          classDeclaration,
          <MemberFunctionDeclarationSyntax>classElement
        );
      } else if (classElement.kind() === SyntaxKind.MemberVariableDeclaration) {
        converted = this.generatePropertyAssignment(
          classDeclaration,
          /*static:*/ true,
          <MemberVariableDeclarationSyntax>classElement
        );
      } else if (
        classElement.kind() === SyntaxKind.GetAccessor ||
        classElement.kind() === SyntaxKind.SetAccessor
      ) {
        converted = this.convertMemberAccessorDeclaration(
          classDeclaration,
          <SyntaxNode>classElement,
          classElements
        );
      }

      if (converted !== null) {
        result.push(converted);
      }
    }

    return result;
  }

  public visitClassDeclaration(
    node: ClassDeclarationSyntax
  ): VariableStatementSyntax {
    var identifier = this.withNoTrivia(node.identifier);

    var statements: IStatementSyntax[] = [];
    var statementIndentation = this.indentationTrivia(
      this.options.indentSpaces + this.columnForStartOfToken(node.firstToken())
    );

    if (node.heritageClauses.childCount() > 0) {
      // __extends(C, _super);
      statements.push(
        ExpressionStatementSyntax.create1(
          this.factory.invocationExpression(
            identifierName('__extends'),
            ArgumentListSyntax.create1().withArgs(
              separatedList([
                <ISyntaxNodeOrToken>identifier,
                token(SyntaxKind.CommaToken).withTrailingTrivia(this.space),
                identifierName('_super'),
              ])
            )
          )
        )
          .withLeadingTrivia(statementIndentation)
          .withTrailingTrivia(this.newLine)
      );
    }

    var constructorDeclaration = <ConstructorDeclarationSyntax>(
      ArrayUtilities.firstOrDefault(
        node.classElements.toArray(),
        (c) => c.kind() === SyntaxKind.ConstructorDeclaration
      )
    );

    var constructorFunctionDeclaration =
      constructorDeclaration === null
        ? this.createDefaultConstructorDeclaration(node)
        : this.convertConstructorDeclaration(node, constructorDeclaration);

    if (constructorFunctionDeclaration !== null) {
      statements.push(constructorFunctionDeclaration);
    }

    statements.push.apply(statements, this.convertClassElements(node));

    // return C;
    statements.push(
      this.factory
        .returnStatement(
          token(SyntaxKind.ReturnKeyword).withTrailingTrivia(this.space),
          identifier,
          token(SyntaxKind.SemicolonToken)
        )
        .withLeadingTrivia(statementIndentation)
        .withTrailingTrivia(this.newLine)
    );

    var block = this.factory.block(
      token(SyntaxKind.OpenBraceToken).withTrailingTrivia(this.newLine),
      list(statements as CheckedArray<IStatementSyntax>),
      token(SyntaxKind.CloseBraceToken).withLeadingTrivia(
        this.indentationTriviaForStartOfNode(node)
      )
    );

    var callParameters: ParameterSyntax[] = [];
    if (node.heritageClauses.childCount() > 0) {
      callParameters.push(ParameterSyntax.create(identifierFn('_super')));
    }

    var callSignature = CallSignatureSyntax.create(
      ParameterListSyntax.create1().withParameters(
        separatedList(callParameters)
      )
    ).withTrailingTrivia(this.space);

    var invocationParameters: ISyntaxNodeOrToken[] = [];
    if (node.heritageClauses.childCount() > 0) {
      var heritageClause = <HeritageClauseSyntax>(
        node.heritageClauses.childAt(0)
      );
      if (heritageClause.typeNames.nonSeparatorCount() > 0) {
        invocationParameters.push(
          heritageClause.typeNames
            .nonSeparatorAt(0)
            .withLeadingTrivia(emptyTriviaList)
            .withTrailingTrivia(emptyTriviaList)
        );
      }
    }

    // (function(_super) { ... })(BaseType)
    var invocationExpression = this.factory.invocationExpression(
      ParenthesizedExpressionSyntax.create1(
        FunctionExpressionSyntax.create1()
          .withCallSignature(callSignature)
          .withBlock(block)
      ),
      ArgumentListSyntax.create1().withArgs(separatedList(invocationParameters))
    );

    // C = (function(_super) { ... })(BaseType)
    var variableDeclarator = VariableDeclaratorSyntax.create(
      identifier.withTrailingTrivia(spaceTriviaList)
    ).withEqualsValueClause(
      this.factory.equalsValueClause(
        token(SyntaxKind.EqualsToken).withTrailingTrivia(this.space),
        invocationExpression
      )
    );

    // var C = (function(_super) { ... })(BaseType);
    return VariableStatementSyntax.create1(
      this.factory.variableDeclaration(
        token(SyntaxKind.VarKeyword).withTrailingTrivia(this.space),
        separatedList([variableDeclarator])
      )
    )
      .withLeadingTrivia(node.leadingTrivia())
      .withTrailingTrivia(this.newLine);
  }

  public visitVariableDeclarator(
    node: VariableDeclaratorSyntax
  ): VariableDeclaratorSyntax {
    var result: VariableDeclaratorSyntax = super.visitVariableDeclarator(node);
    if (result.typeAnnotation === null) {
      return result;
    }

    var newTrailingTrivia = result.propertyName
      .trailingTrivia()
      .concat(result.typeAnnotation.trailingTrivia());

    return result
      .withTypeAnnotation(null)
      .withPropertyName(
        result.propertyName.withTrailingTrivia(newTrailingTrivia)
      );
  }

  public visitCallSignature(node: CallSignatureSyntax): CallSignatureSyntax {
    var result: CallSignatureSyntax = super.visitCallSignature(node);
    if (result.typeAnnotation === null) {
      return result;
    }

    var newTrailingTrivia = result.parameterList
      .trailingTrivia()
      .concat(result.typeAnnotation.trailingTrivia());

    return result
      .withTypeAnnotation(null)
      .withTrailingTrivia(newTrailingTrivia);
  }

  public visitCastExpression(node: CastExpressionSyntax): IExpressionSyntax {
    var result: CastExpressionSyntax = super.visitCastExpression(node);

    var subExpression = result.expression;
    var totalTrivia = result
      .leadingTrivia()
      .concat(subExpression.leadingTrivia());

    return subExpression.withLeadingTrivia(totalTrivia);
  }

  public visitInterfaceDeclaration(
    node: InterfaceDeclarationSyntax
  ): InterfaceDeclarationSyntax {
    // TODO: transfer trivia if important.
    return null;
  }

  public visitTypeParameterList(
    node: TypeParameterListSyntax
  ): TypeParameterListSyntax {
    return null;
  }

  private generateEnumValueExpression(
    enumDeclaration: EnumDeclarationSyntax,
    enumElement: EnumElementSyntax,
    assignDefaultValues: boolean,
    index: number
  ): IExpressionSyntax {
    if (enumElement.equalsValueClause !== null) {
      // Use the value if one is provided.
      return enumElement.equalsValueClause.value
        .accept(this)
        .withTrailingTrivia(emptyTriviaList);
    }

    // Didn't have a value.  Synthesize one if we're doing that, or use the previous item's value
    // (plus one).
    if (assignDefaultValues) {
      return numericLiteralExpression(index.toString());
    }

    // Add one to the previous value.
    var enumIdentifier = this.withNoTrivia(enumDeclaration.identifier);
    var previousEnumElement = <EnumElementSyntax>(
      enumDeclaration.enumElements.nonSeparatorAt(index - 1)
    );
    var variableIdentifier = this.withNoTrivia(
      previousEnumElement.propertyName
    );

    var receiver =
      variableIdentifier.kind() === SyntaxKind.StringLiteral
        ? ElementAccessExpressionSyntax.create1(
            enumIdentifier,
            variableIdentifier
          )
        : <IExpressionSyntax>(
            MemberAccessExpressionSyntax.create1(
              enumIdentifier,
              variableIdentifier
            )
          );

    return this.factory.binaryExpression(
      SyntaxKind.PlusExpression,
      receiver.withTrailingTrivia(spaceTriviaList),
      token(SyntaxKind.PlusToken).withTrailingTrivia(this.space),
      numericLiteralExpression('1')
    );
  }

  private generateEnumFunctionExpression(
    node: EnumDeclarationSyntax
  ): FunctionExpressionSyntax {
    var identifier = this.withNoTrivia(node.identifier);

    var enumColumn = this.columnForStartOfToken(node.firstToken());

    var statements: IStatementSyntax[] = [];

    var initIndentationColumn = enumColumn + this.options.indentSpaces;
    var initIndentationTrivia = this.indentationTrivia(initIndentationColumn);

    if (node.enumElements.nonSeparatorCount() > 0) {
      var assignDefaultValues = { value: true };
      for (var i = 0, n = node.enumElements.nonSeparatorCount(); i < n; i++) {
        var enumElement = <EnumElementSyntax>(
          node.enumElements.nonSeparatorAt(i)
        );
        var variableIdentifier = this.withNoTrivia(enumElement.propertyName);

        assignDefaultValues.value =
          assignDefaultValues.value && enumElement.equalsValueClause === null;

        // "E.Foo = 1" or "E['A B'] = 1"
        var left =
          variableIdentifier.kind() === SyntaxKind.StringLiteral
            ? ElementAccessExpressionSyntax.create1(
                identifier,
                variableIdentifier
              )
            : <IExpressionSyntax>(
                MemberAccessExpressionSyntax.create1(
                  identifier,
                  variableIdentifier
                )
              );
        var innerAssign = assignmentExpression(
          left.withTrailingTrivia(this.space),
          token(SyntaxKind.EqualsToken).withTrailingTrivia(this.space),
          this.generateEnumValueExpression(
            node,
            enumElement,
            assignDefaultValues.value,
            i
          )
        );

        // E[E.Foo = 1]
        var elementAccessExpression = ElementAccessExpressionSyntax.create1(
          identifier,
          innerAssign
        )
          .withLeadingTrivia(enumElement.leadingTrivia())
          .withTrailingTrivia(this.space);

        // E[E.Foo = 1] = "Foo"
        var outerAssign = assignmentExpression(
          elementAccessExpression,
          token(SyntaxKind.EqualsToken).withTrailingTrivia(this.space),
          variableIdentifier.kind() === SyntaxKind.StringLiteral
            ? variableIdentifier
            : stringLiteralExpression('"' + variableIdentifier.text() + '"')
        );

        var expressionStatement = ExpressionStatementSyntax.create1(
          outerAssign
        ).withTrailingTrivia(this.newLine);

        statements.push(expressionStatement);
      }
    }

    var block = this.factory.block(
      token(SyntaxKind.OpenBraceToken).withTrailingTrivia(this.newLine),
      list(statements as CheckedArray<IStatementSyntax>),
      token(SyntaxKind.CloseBraceToken).withLeadingTrivia(
        this.indentationTrivia(enumColumn)
      )
    );

    var parameterList = ParameterListSyntax.create1()
      .withParameter(ParameterSyntax.create1(identifier))
      .withTrailingTrivia(this.space);

    return FunctionExpressionSyntax.create1()
      .withCallSignature(CallSignatureSyntax.create(parameterList))
      .withBlock(block);
  }

  public visitEnumDeclaration(node: EnumDeclarationSyntax): IStatementSyntax[] {
    var identifier = this.withNoTrivia(node.identifier);

    // Copy existing leading trivia of the enum declaration to this node.
    // var E;
    var variableStatement: IStatementSyntax = VariableStatementSyntax.create1(
      this.factory.variableDeclaration(
        token(SyntaxKind.VarKeyword).withTrailingTrivia(this.space),
        separatedList([VariableDeclaratorSyntax.create(identifier)])
      )
    )
      .withLeadingTrivia(node.leadingTrivia())
      .withTrailingTrivia(this.newLine);

    // (function(E) { E[E.e1 = ... })(E||(E={}));
    var expressionStatement: IStatementSyntax =
      ExpressionStatementSyntax.create1(
        this.factory.invocationExpression(
          ParenthesizedExpressionSyntax.create1(
            this.generateEnumFunctionExpression(node)
          ),
          ArgumentListSyntax.create1().withArg(
            this.initializedVariable(identifier)
          )
        )
      )
        .withLeadingTrivia(this.indentationTriviaForStartOfNode(node))
        .withTrailingTrivia(this.newLine);

    return [variableStatement, expressionStatement];
  }

  private convertSuperInvocationExpression(
    node: InvocationExpressionSyntax
  ): InvocationExpressionSyntax {
    var result: InvocationExpressionSyntax = super.visitInvocationExpression(
      node
    );

    var expression = MemberAccessExpressionSyntax.create1(
      identifierName('_super'),
      identifierName('call')
    );

    // MD: Renamed from arguments to argumentList to avoid conflict with arguments keyword
    // @ts-expect-error arguments does not exist on argumentList?
    var argumentList = result.argumentList.arguments.toArray();
    if (argumentList.length > 0) {
      argumentList.unshift(
        token(SyntaxKind.CommaToken).withTrailingTrivia(this.space)
      );
    }

    argumentList.unshift(token(SyntaxKind.ThisKeyword));

    return result
      .withExpression(expression)
      .withArgumentList(
        result.argumentList.withArgs(separatedList(argumentList))
      )
      .withLeadingTrivia(result.leadingTrivia());
  }

  private convertSuperMemberAccessInvocationExpression(
    node: InvocationExpressionSyntax
  ): InvocationExpressionSyntax {
    var result: InvocationExpressionSyntax = super.visitInvocationExpression(
      node
    );

    // MD: Renamed from arguments to argumentList to avoid conflict with arguments keyword
    // @ts-expect-error arguments does not exist on argumentList?
    var argumentList = result.argumentList.arguments.toArray();
    if (argumentList.length > 0) {
      argumentList.unshift(
        token(SyntaxKind.CommaToken).withTrailingTrivia(this.space)
      );
    }

    argumentList.unshift(token(SyntaxKind.ThisKeyword));

    var expression = MemberAccessExpressionSyntax.create1(
      result.expression,
      identifierName('call')
    );
    return result
      .withExpression(expression)
      .withArgumentList(
        result.argumentList.withArgs(separatedList(argumentList))
      );
  }

  public visitInvocationExpression(
    node: InvocationExpressionSyntax
  ): InvocationExpressionSyntax {
    if (isSuperInvocationExpression(node)) {
      return this.convertSuperInvocationExpression(node);
    } else if (isSuperMemberAccessInvocationExpression(node)) {
      return this.convertSuperMemberAccessInvocationExpression(node);
    }

    return super.visitInvocationExpression(node);
  }

  public visitVariableStatement(
    node: VariableStatementSyntax
  ): VariableStatementSyntax {
    var result: VariableStatementSyntax = super.visitVariableStatement(node);

    return result
      .withModifiers(emptyList)
      .withLeadingTrivia(result.leadingTrivia());
  }

  public visitMemberAccessExpression(
    node: MemberAccessExpressionSyntax
  ): MemberAccessExpressionSyntax {
    var result: MemberAccessExpressionSyntax =
      super.visitMemberAccessExpression(node);

    if (isSuperMemberAccessExpression(result)) {
      return MemberAccessExpressionSyntax.create1(
        MemberAccessExpressionSyntax.create1(
          identifierName('_super'),
          identifierName('prototype')
        ),
        result.name
      ).withLeadingTrivia(result.leadingTrivia());
    }

    return result;
  }

  public visitToken(token: ISyntaxToken): ISyntaxToken {
    if (token.kind() === SyntaxKind.IdentifierName) {
      return <any>this.visitIdentifierName(token);
    }

    if (token.kind() === SyntaxKind.ThisKeyword) {
      return this.visitThisKeyword(token);
    }

    return token;
  }

  public visitThisKeyword(token: ISyntaxToken): ISyntaxToken {
    // TODO: use typecheck information to tell if we're accessing 'this' in a lambda and
    // should use "_this" instead.
    return token;
  }

  public visitIdentifierName(token: ISyntaxToken): INameSyntax {
    // Check if a name token needs to become fully qualified.
    var parent = this.syntaxInformationMap.parent(token);

    // We never qualify in a qualified name.  A qualified name only shows up in type
    // contexts, and will be removed anyways.
    if (parent.kind() === SyntaxKind.QualifiedName) {
      return token;
    }

    // Same issue for a generic name.
    if (parent.kind() === SyntaxKind.GenericType) {
      return token;
    }

    // We never qualify the right hand side of a dot.
    if (
      parent.kind() === SyntaxKind.MemberAccessExpression &&
      (<MemberAccessExpressionSyntax>parent).name === token
    ) {
      return token;
    }

    // TODO(cyrusn): Implement this when we have type check support.

    // Ok.  We're a name token that isn't on the right side of a dot.  We may need to be
    // qualified.   Get the symbol that this token binds to.  If it is a module/class and
    // has a full name that is larger than this token, then return the full name as a
    // member access expression.
    return token;
  }

  private generateThisCaptureStatement(
    indentationColumn: number
  ): VariableStatementSyntax {
    // var _this = this;
    return VariableStatementSyntax.create1(
      this.factory.variableDeclaration(
        token(SyntaxKind.VarKeyword).withTrailingTrivia(this.space),
        separatedList([
          this.factory.variableDeclarator(
            identifierFn('_this').withTrailingTrivia(this.space),
            null,
            this.factory.equalsValueClause(
              token(SyntaxKind.EqualsToken).withTrailingTrivia(this.space),
              token(SyntaxKind.ThisKeyword)
            )
          ),
        ])
      )
    )
      .withLeadingTrivia(this.indentationTrivia(indentationColumn))
      .withTrailingTrivia(this.newLine);
  }

  private mustCaptureThisInConstructor(
    constructorDeclaration: ConstructorDeclarationSyntax
  ): boolean {
    // TODO: use typecheck to answer this question properly.
    return false;
  }

  private mustCaptureThisInClass(
    classDeclaratoin: ClassDeclarationSyntax
  ): boolean {
    // TODO: use typecheck to answer this question properly.
    return false;
  }

  private mustCaptureThisInModule(
    moduleDeclaration: ModuleDeclarationSyntax
  ): boolean {
    // TODO: use typecheck to answer this question properly.
    return false;
  }

  private mustCaptureThisInFunction(
    functionDeclaration: FunctionDeclarationSyntax
  ): boolean {
    // TODO: use typecheck to answer this question properly.
    return false;
  }
}

export function emit(
  input: SourceUnitSyntax,
  options?: IFormattingOptions
): SourceUnitSyntax {
  // Make sure no one is passing us a bogus tree.
  SyntaxNodeInvariantsChecker.checkInvariants(input);

  // If there's nothing typescript specific about this node, then just return it as is.
  if (!input.isTypeScriptSpecific()) {
    return input;
  }

  // Do the initial conversion. Note: the result at this point may be 'bogus'.  For example,
  // it make contain the same token instance multiple times in the tree.
  var output: SourceUnitSyntax = input.accept(
    new EmitterImpl(
      SyntaxInformationMap.create(
        input,
        /*trackParents:*/ true,
        /*trackPreviousToken:*/ true
      ),
      options
    )
  );

  // Make sure we clone any nodes/tokens we used in multiple places in the result.  That way
  // we don't break the invariant that all tokens in a tree are unique.
  output = output.accept(new EnsureTokenUniquenessRewriter());

  SyntaxNodeInvariantsChecker.checkInvariants(output);
  Debug.assert(!output.isTypeScriptSpecific());

  return output;
}
