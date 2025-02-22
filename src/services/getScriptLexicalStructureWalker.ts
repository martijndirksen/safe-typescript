import { ArrayUtilities } from '../compiler/core/arrayUtilities';
import { PositionTrackingWalker } from '../compiler/syntax/positionTrackingWalker';
import { INameSyntax } from '../compiler/syntax/syntaxElement';
import { SyntaxKind } from '../compiler/syntax/syntaxKind';
import { ISyntaxList, list, emptyList } from '../compiler/syntax/syntaxList';
import { SyntaxNode } from '../compiler/syntax/syntaxNode';
import { ISyntaxNodeOrToken } from '../compiler/syntax/syntaxNodeOrToken';
import {
  MemberVariableDeclarationSyntax,
  VariableStatementSyntax,
  InterfaceDeclarationSyntax,
  SourceUnitSyntax,
  ModuleDeclarationSyntax,
  QualifiedNameSyntax,
  ClassDeclarationSyntax,
  ObjectTypeSyntax,
  EnumDeclarationSyntax,
  ConstructorDeclarationSyntax,
  MemberFunctionDeclarationSyntax,
  GetAccessorSyntax,
  SetAccessorSyntax,
  VariableDeclaratorSyntax,
  IndexSignatureSyntax,
  EnumElementSyntax,
  CallSignatureSyntax,
  ConstructSignatureSyntax,
  MethodSignatureSyntax,
  PropertySignatureSyntax,
  FunctionDeclarationSyntax,
  BlockSyntax,
  IfStatementSyntax,
  ExpressionStatementSyntax,
  ThrowStatementSyntax,
  ReturnStatementSyntax,
  SwitchStatementSyntax,
  WithStatementSyntax,
  TryStatementSyntax,
  LabeledStatementSyntax,
} from '../compiler/syntax/syntaxNodes.generated';
import { ISyntaxToken, token } from '../compiler/syntax/syntaxToken';
import { SyntaxUtilities } from '../compiler/syntax/syntaxUtilities';
import { CheckedArray } from '../runtime/rt';
import {
  NavigateToItem,
  MatchKind,
  ScriptElementKindModifier,
  ScriptElementKind,
} from './languageService';

export class GetScriptLexicalStructureWalker extends PositionTrackingWalker {
  private nameStack: string[] = [];
  private kindStack: string[] = [];
  private currentMemberVariableDeclaration: MemberVariableDeclarationSyntax =
    null;
  private currentVariableStatement: VariableStatementSyntax = null;
  private currentInterfaceDeclaration: InterfaceDeclarationSyntax = null;

  constructor(
    private items: NavigateToItem[],
    private fileName: string
  ) {
    super();
  }

  static getListsOfAllScriptLexicalStructure(
    items: NavigateToItem[],
    fileName: string,
    unit: SourceUnitSyntax
  ) {
    var visitor = new GetScriptLexicalStructureWalker(items, fileName);
    unit.accept(visitor);
  }

  private createItem(
    node: SyntaxNode,
    modifiers: ISyntaxList,
    kind: string,
    name: string
  ): void {
    var item = new NavigateToItem();
    item.name = name;
    item.kind = kind;
    item.matchKind = MatchKind.exact;
    item.fileName = this.fileName;
    item.kindModifiers = this.getKindModifiers(modifiers);
    item.minChar = this.position() + node.leadingTriviaWidth();
    item.limChar = item.minChar + node.width();
    item.containerName = this.nameStack.join('.');
    item.containerKind =
      this.kindStack.length === 0 ? '' : ArrayUtilities.last(this.kindStack);

    this.items.push(item);
  }

  private getKindModifiers(modifiers: ISyntaxList): string {
    var result: string[] = [];

    if (SyntaxUtilities.containsToken(modifiers, SyntaxKind.ExportKeyword)) {
      result.push(ScriptElementKindModifier.exportedModifier);
    }

    if (SyntaxUtilities.containsToken(modifiers, SyntaxKind.DeclareKeyword)) {
      result.push(ScriptElementKindModifier.ambientModifier);
    }

    if (SyntaxUtilities.containsToken(modifiers, SyntaxKind.PublicKeyword)) {
      result.push(ScriptElementKindModifier.publicMemberModifier);
    }

    if (SyntaxUtilities.containsToken(modifiers, SyntaxKind.PrivateKeyword)) {
      result.push(ScriptElementKindModifier.privateMemberModifier);
    }

    if (SyntaxUtilities.containsToken(modifiers, SyntaxKind.StaticKeyword)) {
      result.push(ScriptElementKindModifier.staticModifier);
    }

    return result.length > 0
      ? result.join(',')
      : ScriptElementKindModifier.none;
  }

  public visitModuleDeclaration(node: ModuleDeclarationSyntax): void {
    var names = this.getModuleNames(node);
    this.visitModuleDeclarationWorker(node, names, 0);
  }

  private visitModuleDeclarationWorker(
    node: ModuleDeclarationSyntax,
    names: string[],
    nameIndex: number
  ): void {
    if (nameIndex === names.length) {
      // We're after all the module names, descend and process all children.
      super.visitModuleDeclaration(node);
    } else {
      // If we have a dotted module (like "module A.B.C"):
      //  1) If we're the outermost module, then use the modifiers provided on the node.
      //  2) For any inner modules, consider it exported.
      var modifiers =
        nameIndex === 0
          ? node.modifiers
          : list([
              token(SyntaxKind.ExportKeyword),
            ] as CheckedArray<ISyntaxNodeOrToken>);
      var name = names[nameIndex];
      var kind = ScriptElementKind.moduleElement;
      this.createItem(node, node.modifiers, kind, name);

      this.nameStack.push(name);
      this.kindStack.push(kind);

      this.visitModuleDeclarationWorker(node, names, nameIndex + 1);

      this.nameStack.pop();
      this.kindStack.pop();
    }
  }

  private getModuleNames(node: ModuleDeclarationSyntax): string[] {
    var result: string[] = [];

    if (node.stringLiteral) {
      result.push(node.stringLiteral.text());
    } else {
      this.getModuleNamesHelper(node.name, result);
    }

    return result;
  }

  private getModuleNamesHelper(name: INameSyntax, result: string[]): void {
    if (name.kind() === SyntaxKind.QualifiedName) {
      var qualifiedName = <QualifiedNameSyntax>name;
      this.getModuleNamesHelper(qualifiedName.left, result);
      result.push(qualifiedName.right.text());
    } else {
      result.push((<ISyntaxToken>name).text());
    }
  }

  public visitClassDeclaration(node: ClassDeclarationSyntax): void {
    var name = node.identifier.text();
    var kind = ScriptElementKind.classElement;

    this.createItem(node, node.modifiers, kind, name);

    this.nameStack.push(name);
    this.kindStack.push(kind);

    super.visitClassDeclaration(node);

    this.nameStack.pop();
    this.kindStack.pop();
  }

  public visitInterfaceDeclaration(node: InterfaceDeclarationSyntax): void {
    var name = node.identifier.text();
    var kind = ScriptElementKind.interfaceElement;

    this.createItem(node, node.modifiers, kind, name);

    this.nameStack.push(name);
    this.kindStack.push(kind);

    this.currentInterfaceDeclaration = node;
    super.visitInterfaceDeclaration(node);
    this.currentInterfaceDeclaration = null;

    this.nameStack.pop();
    this.kindStack.pop();
  }

  public visitObjectType(node: ObjectTypeSyntax): void {
    // Ignore an object type if we aren't inside an interface declaration.  We don't want
    // to add some random object type's members to the nav bar.
    if (this.currentInterfaceDeclaration === null) {
      this.skip(node);
    } else {
      super.visitObjectType(node);
    }
  }

  public visitEnumDeclaration(node: EnumDeclarationSyntax): void {
    var name = node.identifier.text();
    var kind = ScriptElementKind.enumElement;

    this.createItem(node, node.modifiers, kind, name);

    this.nameStack.push(name);
    this.kindStack.push(kind);

    super.visitEnumDeclaration(node);

    this.nameStack.pop();
    this.kindStack.pop();
  }

  public visitConstructorDeclaration(node: ConstructorDeclarationSyntax): void {
    var item = this.createItem(
      node,
      emptyList,
      ScriptElementKind.constructorImplementationElement,
      'constructor'
    );

    // No need to descend into a constructor;
    this.skip(node);
  }

  public visitMemberFunctionDeclaration(
    node: MemberFunctionDeclarationSyntax
  ): void {
    var item = this.createItem(
      node,
      node.modifiers,
      ScriptElementKind.memberFunctionElement,
      node.propertyName.text()
    );

    // No need to descend into a member function;
    this.skip(node);
  }

  public visitGetAccessor(node: GetAccessorSyntax): void {
    var item = this.createItem(
      node,
      node.modifiers,
      ScriptElementKind.memberGetAccessorElement,
      node.propertyName.text()
    );

    // No need to descend into a member accessor;
    this.skip(node);
  }

  public visitSetAccessor(node: SetAccessorSyntax): void {
    var item = this.createItem(
      node,
      node.modifiers,
      ScriptElementKind.memberSetAccessorElement,
      node.propertyName.text()
    );

    // No need to descend into a member accessor;
    this.skip(node);
  }

  public visitMemberVariableDeclaration(
    node: MemberVariableDeclarationSyntax
  ): void {
    this.currentMemberVariableDeclaration = node;
    super.visitMemberVariableDeclaration(node);
    this.currentMemberVariableDeclaration = null;
  }

  public visitVariableStatement(node: VariableStatementSyntax): void {
    this.currentVariableStatement = node;
    super.visitVariableStatement(node);
    this.currentVariableStatement = null;
  }

  public visitVariableDeclarator(node: VariableDeclaratorSyntax): void {
    var modifiers = this.currentMemberVariableDeclaration
      ? this.currentMemberVariableDeclaration.modifiers
      : emptyList;
    var kind = this.currentMemberVariableDeclaration
      ? ScriptElementKind.memberVariableElement
      : ScriptElementKind.variableElement;
    var item = this.createItem(node, modifiers, kind, node.propertyName.text());

    // No need to descend into a variable declarator;
    this.skip(node);
  }

  public visitIndexSignature(node: IndexSignatureSyntax): void {
    var item = this.createItem(
      node,
      emptyList,
      ScriptElementKind.indexSignatureElement,
      '[]'
    );

    // No need to descend into an index signature;
    this.skip(node);
  }

  public visitEnumElement(node: EnumElementSyntax): void {
    var item = this.createItem(
      node,
      emptyList,
      ScriptElementKind.memberVariableElement,
      node.propertyName.text()
    );

    // No need to descend into an enum element;
    this.skip(node);
  }

  public visitCallSignature(node: CallSignatureSyntax): void {
    var item = this.createItem(
      node,
      emptyList,
      ScriptElementKind.callSignatureElement,
      '()'
    );

    // No need to descend into a call signature;
    this.skip(node);
  }

  public visitConstructSignature(node: ConstructSignatureSyntax): void {
    var item = this.createItem(
      node,
      emptyList,
      ScriptElementKind.constructSignatureElement,
      'new()'
    );

    // No need to descend into a construct signature;
    this.skip(node);
  }

  public visitMethodSignature(node: MethodSignatureSyntax): void {
    var item = this.createItem(
      node,
      emptyList,
      ScriptElementKind.memberFunctionElement,
      node.propertyName.text()
    );

    // No need to descend into a method signature;
    this.skip(node);
  }

  public visitPropertySignature(node: PropertySignatureSyntax): void {
    var item = this.createItem(
      node,
      emptyList,
      ScriptElementKind.memberVariableElement,
      node.propertyName.text()
    );

    // No need to descend into a property signature;
    this.skip(node);
  }

  public visitFunctionDeclaration(node: FunctionDeclarationSyntax): void {
    var item = this.createItem(
      node,
      node.modifiers,
      ScriptElementKind.functionElement,
      node.identifier.text()
    );

    // No need to descend into a function declaration;
    this.skip(node);
  }

  // Common statement types.  Don't even bother walking into them as we'll never find anything
  // inside that we'd put in the navbar.

  public visitBlock(node: BlockSyntax): void {
    this.skip(node);
  }

  public visitIfStatement(node: IfStatementSyntax): void {
    this.skip(node);
  }

  public visitExpressionStatement(node: ExpressionStatementSyntax): void {
    this.skip(node);
  }

  public visitThrowStatement(node: ThrowStatementSyntax): void {
    this.skip(node);
  }

  public visitReturnStatement(node: ReturnStatementSyntax): void {
    this.skip(node);
  }

  public visitSwitchStatement(node: SwitchStatementSyntax): void {
    this.skip(node);
  }

  public visitWithStatement(node: WithStatementSyntax): void {
    this.skip(node);
  }

  public visitTryStatement(node: TryStatementSyntax): void {
    this.skip(node);
  }

  public visitLabeledStatement(node: LabeledStatementSyntax): void {
    this.skip(node);
  }
}
