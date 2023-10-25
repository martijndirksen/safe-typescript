export interface IFormattingOptions {
  useTabs: boolean;
  spacesPerTab: number;
  indentSpaces: number;
  newLineCharacter: string;
}

export function createFormattingOptions(
  options?: Partial<IFormattingOptions>
): IFormattingOptions {
  return {
    useTabs: options?.useTabs ?? false,
    spacesPerTab: options?.spacesPerTab ?? 4,
    indentSpaces: options?.indentSpaces ?? 4,
    newLineCharacter: options?.newLineCharacter ?? '\r\n',
  };
}
