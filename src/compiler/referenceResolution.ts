import { ILineAndCharacter } from './core/lineAndCharacter';

// Note: This is being using by the host (VS) and is marshaled back and forth. When changing this make sure the changes
// are reflected in the managed side as well.
export interface IFileReference extends ILineAndCharacter {
  path: string;
  isResident: boolean;
  position: number;
  length: number;
}
