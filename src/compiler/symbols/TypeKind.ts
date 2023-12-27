/**
 * Enumeration for possible kinds of type symbols.
 */
export enum TypeKind {
  Any,
  Number,
  Boolean,
  String,
  Void,
  Null,
  Undefined,
  Class,
  Interface,
  // Array, // MD: For some reason this is not included?
  Anonymous,
  Enum,
  TypeParameter,
}
