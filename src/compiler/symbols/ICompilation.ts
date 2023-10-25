import { ICancellationToken } from '../core/cancellationToken';
import { Diagnostic } from '../core/diagnosticCore';
import { SyntaxTree } from '../syntax/syntaxTree';
import { ISemanticModel } from './ISemanticModel';
import { IModuleSymbol } from './ISymbol';
import {
  IAnyTypeSymbol,
  INumberTypeSymbol,
  IBooleanTypeSymbol,
  IStringTypeSymbol,
  IVoidTypeSymbol,
  INullTypeSymbol,
  IUndefinedTypeSymbol,
} from './ITypeSymbol';

export interface ICompilation {
  /**
   * Gets the syntax trees (parsed from source code) that this compilation was created with.
   */
  syntaxTrees(): SyntaxTree[];

  getSemanticModel(syntaxTree: SyntaxTree): ISemanticModel;

  addSyntaxTrees(...syntaxTrees: SyntaxTree[]): void;

  removeSyntaxTrees(...syntaxTrees: SyntaxTree[]): void;

  replaceSyntaxTree(oldSyntaxTree: SyntaxTree, newSyntaxTree: SyntaxTree): void;

  containsSyntaxTree(syntaxTree: SyntaxTree): boolean;

  globalModule(): IModuleSymbol;

  anyType(): IAnyTypeSymbol;

  numberType(): INumberTypeSymbol;
  booleanType(): IBooleanTypeSymbol;
  stringType(): IStringTypeSymbol;
  voidType(): IVoidTypeSymbol;
  nullType(): INullTypeSymbol;
  undefinedType(): IUndefinedTypeSymbol;

  /**
   * Gets all the diagnostics for the compilation, including syntax, declaration, and
   * binding. Does not include any diagnostics that might be produced during emit.
   */
  getDiagnostics(cancellationToken: ICancellationToken): Diagnostic[];

  // TODO: add parameters here to control emitting.
  emit(): void;
}
