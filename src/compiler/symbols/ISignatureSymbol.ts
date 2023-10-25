export interface ISignatureSymbol extends ISymbol {
  type(): ITypeSymbol;
}

export interface ICallSignatureSymbol
  extends IParameterizedSymbol,
    IGenericSymbol {}

export interface IConstructSignatureSymbol
  extends IParameterizedSymbol,
    IGenericSymbol {}

export interface IIndexSignatureSymbol extends IParameterizedSymbol {}

export interface IPropertySignature extends ISignatureSymbol {
  isOptional(): boolean;

  /// True if this property's type is an anonymous type that is a function type.
  isFunctionSignature(): boolean;
}
