export module CompilerDiagnostics {
  export var debug = false;
  export interface IDiagnosticWriter {
    Alert(output: string): void;
  }

  export var diagnosticWriter: IDiagnosticWriter = null;

  export var analysisPass: number = 0;

  export function Alert(output: string) {
    if (diagnosticWriter) {
      diagnosticWriter.Alert(output);
    }
  }

  export function debugPrint(s: string) {
    if (debug) {
      Alert(s);
    }
  }

  export function assert(condition: boolean, s: string) {
    if (debug) {
      if (!condition) {
        Alert(s);
      }
    }
  }
}

export interface ILogger {
  information(): boolean;
  debug(): boolean;
  warning(): boolean;
  error(): boolean;
  fatal(): boolean;
  log(s: string): void;
}

export class NullLogger implements ILogger {
  public information(): boolean {
    return false;
  }
  public debug(): boolean {
    return false;
  }
  public warning(): boolean {
    return false;
  }
  public error(): boolean {
    return false;
  }
  public fatal(): boolean {
    return false;
  }
  public log(s: string): void {}
}

export function timeFunction(
  logger: ILogger,
  funcDescription: string,
  func: () => any
): any {
  var start = new Date().getTime();
  var result = func();
  var end = new Date().getTime();
  logger.log(funcDescription + ' completed in ' + (end - start) + ' msec');
  return result;
}
