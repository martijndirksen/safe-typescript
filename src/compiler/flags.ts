export function hasFlag(val: number, flag: number): boolean {
  return (val & flag) !== 0;
}

export enum TypeRelationshipFlags {
  SuccessfulComparison = 0,
  RequiredPropertyIsMissing = 1 << 1,
  IncompatibleSignatures = 1 << 2,
  SourceSignatureHasTooManyParameters = 3,
  IncompatibleReturnTypes = 1 << 4,
  IncompatiblePropertyTypes = 1 << 5,
  IncompatibleParameterTypes = 1 << 6,
  InconsistantPropertyAccesibility = 1 << 7,
}

export enum ModuleGenTarget {
  Unspecified = 0,
  Synchronous = 1,
  Asynchronous = 2,
}
