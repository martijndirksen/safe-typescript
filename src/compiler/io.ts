import { RT } from '../runtime/rt';
import { getDiagnosticMessage } from './core/diagnosticCore';
import { Environment, FileInformation } from './core/environment';
import { DiagnosticCode } from './resources/diagnosticCode.generated';

export interface IFindFileResult extends RT.Virtual {
  fileInformation: FileInformation;
  path: string;
}

export interface IFileWatcher extends RT.Virtual {
  fileName: string;
  close(): void;
}

export interface IIO extends RT.Virtual {
  readFile(path: string): FileInformation;
  writeFile(path: string, contents: string, writeByteOrderMark: boolean): void;
  deleteFile(path: string): void;
  dir(path: string, re?: RegExp, options?: { recursive?: boolean }): string[];
  fileExists(path: string): boolean;
  directoryExists(path: string): boolean;
  createDirectory(path: string): void;
  resolvePath(path: string): string;
  dirName(path: string): string;
  findFile(rootPath: string, partialFilePath: string): IFindFileResult;
  print(str: string): void;
  printLine(str: string): void;
  arguments: string[];
  stderr: IOUtils.ITextWriter;
  stdout: IOUtils.ITextWriter;
  watchFile: (fileName: string, callback: (x: string) => void) => IFileWatcher;
  run(source: string, fileName: string): void;
  getExecutingFilePath(): string;
  quit(exitCode?: number): void;
}

export module IOUtils {
  // Creates the directory including its parent if not already present
  function createDirectoryStructure(ioHost: IIO, dirName: string) {
    if (ioHost.directoryExists(dirName)) {
      return;
    }

    var parentDirectory = ioHost.dirName(dirName);
    if (parentDirectory != '') {
      createDirectoryStructure(ioHost, parentDirectory);
    }
    ioHost.createDirectory(dirName);
  }

  // Creates a file including its directory structure if not already present
  export function writeFileAndFolderStructure(
    ioHost: IIO,
    fileName: string,
    contents: string,
    writeByteOrderMark: boolean
  ): void {
    var path = ioHost.resolvePath(fileName);
    var dirName = ioHost.dirName(path);
    createDirectoryStructure(ioHost, dirName);
    ioHost.writeFile(path, contents, writeByteOrderMark);
  }

  export function throwIOError(message: string, error: Error) {
    var errorMessage = message;
    if (error && error.message) {
      errorMessage += ' ' + error.message;
    }
    throw new Error(errorMessage);
  }

  export function combine(prefix: string, suffix: string): string {
    return prefix + '/' + suffix;
  }

  export interface ITextWriter {
    Write(str: string): void;
    WriteLine(str: string): void;
    Close(): void;
  }

  export class BufferedTextWriter implements ITextWriter {
    public buffer: string | null = '';
    // Inner writer does not need a WriteLine method, since the BufferedTextWriter wraps it itself
    constructor(
      public writer: { Write: (str: string) => void; Close: () => void },
      public capacity = 1024
    ) {}
    Write(str: string) {
      this.buffer += str;
      if (this.buffer?.length && this.buffer.length >= this.capacity) {
        this.writer.Write(this.buffer);
        this.buffer = '';
      }
    }
    WriteLine(str: string) {
      this.Write(str + '\r\n');
    }
    Close() {
      if (this.buffer?.length) {
        this.writer.Write(this.buffer);
      }
      this.writer.Close();
      this.buffer = null;
    }
  }
}

export var IO = (function () {
  function getNodeIO(): IIO {
    var _fs = require('fs');
    var _path = require('path');
    var _module = require('module');

    return {
      readFile(file: string): FileInformation {
        return Environment.readFile(file);
      },

      writeFile(path: string, contents: string, writeByteOrderMark: boolean) {
        Environment.writeFile(path, contents, writeByteOrderMark);
      },

      deleteFile(path) {
        try {
          _fs.unlinkSync(path);
        } catch (e) {
          IOUtils.throwIOError(
            getDiagnosticMessage(DiagnosticCode.Could_not_delete_file_0, [
              path,
            ]),
            e as any
          );
        }
      },
      fileExists(path: string): boolean {
        return _fs.existsSync(path);
      },

      dir(path, spec?, options?) {
        options = options || <{ recursive?: boolean }>{};

        function filesInFolder(folder: string): string[] {
          var paths: string[] = [];

          try {
            var files = _fs.readdirSync(folder);
            for (var i = 0; i < files.length; i++) {
              var stat = _fs.statSync(folder + '/' + files[i]);
              if (options.recursive && stat.isDirectory()) {
                paths = paths.concat(filesInFolder(folder + '/' + files[i]));
              } else if (stat.isFile() && (!spec || files[i].match(spec))) {
                paths.push(folder + '/' + files[i]);
              }
            }
          } catch (err) {
            /*
             *   Skip folders that are inaccessible
             */
          }

          return paths;
        }

        return filesInFolder(path);
      },
      createDirectory(path: string): void {
        try {
          if (!this.directoryExists(path)) {
            _fs.mkdirSync(path);
          }
        } catch (e) {
          IOUtils.throwIOError(
            getDiagnosticMessage(DiagnosticCode.Could_not_create_directory_0, [
              path,
            ]),
            e as any
          );
        }
      },

      directoryExists(path: string): boolean {
        return _fs.existsSync(path) && _fs.statSync(path).isDirectory();
      },
      resolvePath(path: string): string {
        return _path.resolve(path);
      },
      dirName(path: string): string {
        var dirPath = _path.dirname(path);

        // Node will just continue to repeat the root path, rather than return null
        if (dirPath === path) {
          dirPath = null;
        }

        return dirPath;
      },
      findFile(rootPath: string, partialFilePath: string): IFindFileResult {
        var path = rootPath + '/' + partialFilePath;

        while (true) {
          if (_fs.existsSync(path)) {
            return {
              fileInformation: <FileInformation>this.readFile(path),
              path: path,
            };
          } else {
            var parentPath = _path.resolve(rootPath, '..');

            // Node will just continue to repeat the root path, rather than return null
            if (rootPath === parentPath) {
              return null;
            } else {
              rootPath = parentPath;
              path = _path.resolve(rootPath, partialFilePath);
            }
          }
        }
      },
      print(str) {
        process.stdout.write(str);
      },
      printLine(str) {
        process.stdout.write(str + '\n');
      },
      arguments: process.argv.slice(2),
      stderr: {
        Write(str) {
          process.stderr.write(str);
        },
        WriteLine(str) {
          process.stderr.write(str + '\n');
        },
        Close() {},
      },
      stdout: {
        Write(str) {
          process.stdout.write(str);
        },
        WriteLine(str) {
          process.stdout.write(str + '\n');
        },
        Close() {},
      },
      watchFile: function (
        fileName: string,
        callback: (x: string) => void
      ): IFileWatcher {
        var firstRun = true;
        var processingChange = false;

        var fileChanged: any = function (curr: any, prev: any) {
          if (!firstRun) {
            if (curr.mtime < prev.mtime) {
              return;
            }

            _fs.unwatchFile(fileName, fileChanged);
            if (!processingChange) {
              processingChange = true;
              callback(fileName);
              setTimeout(function () {
                processingChange = false;
              }, 100);
            }
          }
          firstRun = false;
          _fs.watchFile(
            fileName,
            { persistent: true, interval: 500 },
            fileChanged
          );
        };

        fileChanged();
        return {
          fileName: fileName,
          close() {
            _fs.unwatchFile(fileName, fileChanged);
          },
        };
      },
      run(source, fileName) {
        require.main.filename = fileName;
        require.main.paths = _module._nodeModulePaths(
          _path.dirname(_fs.realpathSync(fileName))
        );
        // TODO: MD, what is this?
        // @ts-expect-error _compiler does not exist on main
        require.main._compile(source, fileName);
      },
      getExecutingFilePath() {
        // TODO: MD, what is this?
        return process.mainModule.filename;
      },
      quit(code?: number) {
        var stderrFlushed = process.stderr.write('');
        var stdoutFlushed = process.stdout.write('');
        process.stderr.on('drain', function () {
          stderrFlushed = true;
          if (stdoutFlushed) {
            process.exit(code);
          }
        });
        process.stdout.on('drain', function () {
          stdoutFlushed = true;
          if (stderrFlushed) {
            process.exit(code);
          }
        });
        setTimeout(function () {
          process.exit(code);
        }, 5);
      },
    };
  }

  if (typeof module !== 'undefined' && module.exports) return getNodeIO();
  else return null; // Unsupported host
})();
