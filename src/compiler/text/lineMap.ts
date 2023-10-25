import { LineMap } from '../core/lineMap';
import { IScriptSnapshot } from './scriptSnapshot';
import { ISimpleText } from './text';
import { parseLineStarts } from './textUtilities';

export module LineMap1 {
  export function fromSimpleText(text: ISimpleText): LineMap {
    return new LineMap(
      () =>
        parseLineStarts({
          charCodeAt(index) {
            return text.charCodeAt(index);
          },
          length: text.length(),
        }),
      text.length()
    );
  }

  export function fromScriptSnapshot(scriptSnapshot: IScriptSnapshot): LineMap {
    return new LineMap(
      () => scriptSnapshot.getLineStartPositions(),
      scriptSnapshot.getLength()
    );
  }

  export function fromString(text: string): LineMap {
    return new LineMap(() => parseLineStarts(new String(text)), text.length);
  }
}
