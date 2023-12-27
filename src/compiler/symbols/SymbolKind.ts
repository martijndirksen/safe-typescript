export enum SymbolKind {
  Module,
  Parameter,

  // Types
  AnyType,
  NumberType,
  BooleanType,
  StringType,
  VoidType,
  NullType,
  UndefinedType,
  ClassType,
  InterfaceType,
  // ArrayType, // MD: For some reason this is not included?
  AnonymousType,
  EnumType,
  TypeParameter,

  // Members
  Constructor,
  Function,
  Variable,

  // Signatures
  CallSignature,
  ConstructSignature,
  IndexSignature,
  PropertySignature,
}
