///<reference path='typescript.ts' />

export interface IWalkContext {
  goChildren: boolean;
  goNextSibling: boolean;
  // visit siblings in reverse execution order
  reverseSiblings: boolean;
}

export class BaseWalkContext implements IWalkContext {
  public goChildren = true;
  public goNextSibling = true;
  public reverseSiblings = false;
}
