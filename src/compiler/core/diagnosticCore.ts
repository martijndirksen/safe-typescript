import { EOL } from 'os';
import { DiagnosticCode } from '../resources/diagnosticCode.generated';
import { ArrayUtilities } from './arrayUtilities';
import { DiagnosticCategory } from './diagnosticCategory';
import { DiagnosticInfo } from './diagnosticInfo';
import { LineMap } from './lineMap';
import { Debug } from './debug';
import { diagnosticInformationMap } from '../resources/diagnosticInformationMap.generated';

export var LocalizedDiagnosticMessages: any = null;

export function setLocalizedDiagnosticMessages(value: any): void {
  LocalizedDiagnosticMessages = value;
}

export class Diagnostic {
  private _fileName: string;
  private _lineMap: LineMap;
  private _start: number;
  private _length: number;
  private _diagnosticKey: string;
  private _arguments: string[];

  constructor(
    fileName: string,
    lineMap: LineMap,
    start: number,
    length: number,
    diagnosticKey: string,
    args?: string[]
  ) {
    this._diagnosticKey = diagnosticKey;
    this._arguments = args && args.length > 0 ? args : [];
    this._fileName = fileName;
    this._lineMap = lineMap;
    this._start = start;
    this._length = length;
  }

  public toJSON(key: any): any {
    var result: any = {};
    result.start = this.start();
    result.length = this.length();

    result.diagnosticCode = this._diagnosticKey;

    var args: any[] = (<any>this).arguments();
    if (args && args.length > 0) {
      result.arguments = args;
    }

    return result;
  }

  public fileName(): string {
    return this._fileName;
  }

  public line(): number {
    return this._lineMap
      ? this._lineMap.getLineNumberFromPosition(this.start())
      : 0;
  }

  public character(): number {
    return this._lineMap
      ? this._lineMap.getLineAndCharacterFromPosition(this.start()).character()
      : 0;
  }

  public start(): number {
    return this._start;
  }

  public length(): number {
    return this._length;
  }

  public diagnosticKey(): string {
    return this._diagnosticKey;
  }

  public arguments(): string[] | null {
    return this._arguments;
  }

  /**
   * Get the text of the message in the given language.
   */
  public text(): string {
    return getLocalizedText(this._diagnosticKey, this._arguments);
  }

  /**
   * Get the text of the message including the error code in the given language.
   */
  public message(): string {
    return getDiagnosticMessage(this._diagnosticKey, this._arguments);
  }

  public static equals(
    diagnostic1: Diagnostic,
    diagnostic2: Diagnostic
  ): boolean {
    return (
      diagnostic1._fileName === diagnostic2._fileName &&
      diagnostic1._start === diagnostic2._start &&
      diagnostic1._length === diagnostic2._length &&
      diagnostic1._diagnosticKey === diagnostic2._diagnosticKey &&
      ArrayUtilities.sequenceEquals(
        diagnostic1._arguments ?? [],
        diagnostic2._arguments ?? [],
        (v1, v2) => v1 === v2
      )
    );
  }

  public info(): DiagnosticInfo {
    return getDiagnosticInfoFromKey(this.diagnosticKey());
  }
}

function getLargestIndex(diagnostic: string): number {
  var largest = -1;
  var regex = /\{(\d+)\}/g;

  var match: RegExpExecArray | null;
  while ((match = regex.exec(diagnostic)) != null) {
    var val = parseInt(match[1]);
    if (!isNaN(val) && val > largest) {
      largest = val;
    }
  }

  return largest;
}

function getDiagnosticInfoFromKey(diagnosticKey: string): DiagnosticInfo {
  var result: DiagnosticInfo = diagnosticInformationMap[diagnosticKey];
  Debug.assert(result);
  return result;
}

export function getLocalizedText(
  diagnosticKey: string,
  args?: string[]
): string {
  if (LocalizedDiagnosticMessages) {
    //Debug.assert(LocalizedDiagnosticMessages.hasOwnProperty(diagnosticKey));
  }

  var diagnosticMessageText: string = LocalizedDiagnosticMessages
    ? LocalizedDiagnosticMessages[diagnosticKey]
    : diagnosticKey;
  Debug.assert(
    diagnosticMessageText !== undefined && diagnosticMessageText !== null
  );

  var actualCount = args ? args.length : 0;
  // We have a string like "foo_0_bar_1".  We want to find the largest integer there.
  // (i.e.'1').  We then need one more arg than that to be correct.
  var expectedCount = 1 + getLargestIndex(diagnosticKey);

  if (expectedCount !== actualCount) {
    throw new Error(
      diagnosticKey +
        ' :: ' +
        getLocalizedText(
          DiagnosticCode.Expected_0_arguments_to_message_got_1_instead,
          [expectedCount.toString(), actualCount.toString()]
        )
    );
  }

  // This should also be the same number of arguments as the message text
  var valueCount = 1 + getLargestIndex(diagnosticMessageText);
  if (valueCount !== expectedCount) {
    throw new Error(
      diagnosticKey +
        ' :: ' +
        getLocalizedText(
          DiagnosticCode.Expected_the_message_0_to_have_1_arguments_but_it_had_2,
          [
            diagnosticMessageText,
            expectedCount.toString(),
            valueCount.toString(),
          ]
        )
    );
  }

  diagnosticMessageText = diagnosticMessageText.replace(
    /{(\d+)}/g,
    function (match, num?) {
      return args && typeof args[num] !== 'undefined' ? args[num] : match;
    }
  );

  diagnosticMessageText = diagnosticMessageText.replace(/{(NL)}/g, function () {
    return EOL;
  });

  return diagnosticMessageText;
}

export function getDiagnosticMessage(
  diagnosticKey: string,
  args?: string[]
): string {
  var diagnostic = getDiagnosticInfoFromKey(diagnosticKey);
  var diagnosticMessageText = getLocalizedText(diagnosticKey, args);

  var message: string;
  if (diagnostic.category === DiagnosticCategory.Error) {
    message = getLocalizedText(DiagnosticCode.error_TS_0_1, [
      diagnostic.code.toString(),
      diagnosticMessageText,
    ]);
  } else if (diagnostic.category === DiagnosticCategory.Warning) {
    message = getLocalizedText(DiagnosticCode.warning_TS_0_1, [
      diagnostic.code.toString(),
      diagnosticMessageText,
    ]);
  } else {
    message = diagnosticMessageText;
  }

  return message;
}
