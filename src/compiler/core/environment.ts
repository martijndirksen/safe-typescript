import {
  readFileSync as nodeReadFileSync,
  statSync as nodeStatSync,
  mkdirSync as nodeMkdirSync,
  openSync as nodeOpenSync,
  writeSync as nodeWriteSync,
  closeSync as nodeCloseSync,
  existsSync as nodeExistsSync,
  unlinkSync as nodeUnlinkSync,
  readdirSync as nodeReaddirSync,
} from 'node:fs';
import { dirname } from 'node:path';
import { EOL } from 'node:os';
import { IOUtils } from '../io';

declare var Buffer: {
  new (str: string, encoding?: string): any;
};

export enum ByteOrderMark {
  None = 0,
  Utf8 = 1,
  Utf16BigEndian = 2,
  Utf16LittleEndian = 3,
}

export class FileInformation {
  constructor(
    public contents: string,
    public byteOrderMark: ByteOrderMark
  ) {}
}

export interface IEnvironment {
  supportsCodePage(): boolean;
  readFile(path: string): FileInformation;
  writeFile(path: string, contents: string, writeByteOrderMark: boolean): void;
  deleteFile(path: string): void;
  fileExists(path: string): boolean;
  directoryExists(path: string): boolean;
  listFiles(
    path: string,
    pattern?: string | RegExp,
    options?: { recursive?: boolean }
  ): string[];

  arguments: string[];
  standardOut: IOUtils.ITextWriter;

  currentDirectory(): string;
  newLine: string;
}

export const Environment: IEnvironment = {
  // On node pick up the newline character from the OS
  newLine: EOL,

  currentDirectory(): string {
    return process.cwd();
  },

  supportsCodePage() {
    return false;
  },

  readFile(file: string): FileInformation {
    var buffer = nodeReadFileSync(file);
    switch (buffer[0]) {
      case 0xfe:
        if (buffer[1] === 0xff) {
          // utf16-be. Reading the buffer as big endian is not supported, so convert it to
          // Little Endian first
          var i = 0;
          while (i + 1 < buffer.length) {
            var temp = buffer[i];
            buffer[i] = buffer[i + 1];
            buffer[i + 1] = temp;
            i += 2;
          }
          return new FileInformation(
            buffer.toString('ucs2', 2),
            ByteOrderMark.Utf16BigEndian
          );
        }
        break;
      case 0xff:
        if (buffer[1] === 0xfe) {
          // utf16-le
          return new FileInformation(
            buffer.toString('ucs2', 2),
            ByteOrderMark.Utf16LittleEndian
          );
        }
        break;
      case 0xef:
        if (buffer[1] === 0xbb) {
          // utf-8
          return new FileInformation(
            buffer.toString('utf8', 3),
            ByteOrderMark.Utf8
          );
        }
    }

    // Default behaviour
    return new FileInformation(buffer.toString('utf8', 0), ByteOrderMark.None);
  },

  writeFile(path: string, contents: string, writeByteOrderMark: boolean) {
    function mkdirRecursiveSync(dir: string) {
      var stats = nodeStatSync(dir);
      if (stats.isFile()) {
        throw '"' + dir + '" exists but isn\'t a directory.';
      } else if (stats.isDirectory()) {
        return;
      } else {
        mkdirRecursiveSync(dirname(dir));
        nodeMkdirSync(dir, 509 /*775 in octal*/);
      }
    }

    mkdirRecursiveSync(dirname(path));

    if (writeByteOrderMark) {
      contents = '\uFEFF' + contents;
    }

    var chunkLength = 4 * 1024;
    var fileDescriptor = nodeOpenSync(path, 'w');
    try {
      for (var index = 0; index < contents.length; index += chunkLength) {
        var buffer = new Buffer(
          contents.substring(index, index + chunkLength),
          'utf8'
        );

        nodeWriteSync(fileDescriptor, buffer, 0, buffer.length, null);
      }
    } finally {
      nodeCloseSync(fileDescriptor);
    }
  },

  fileExists(path: string): boolean {
    return nodeExistsSync(path);
  },

  deleteFile(path: string) {
    try {
      nodeUnlinkSync(path);
    } catch (e) {}
  },

  directoryExists(path: string): boolean {
    return nodeExistsSync(path) && nodeStatSync(path).isDirectory();
  },

  listFiles(
    path: string,
    pattern?: string | RegExp,
    options?: { recursive?: boolean }
  ) {
    function filesInFolder(folder: string): string[] {
      var paths: string[] = [];

      var files = nodeReaddirSync(folder);
      for (var i = 0; i < files.length; i++) {
        var stat = nodeStatSync(folder + '\\' + files[i]);
        if (options?.recursive && stat.isDirectory()) {
          paths = paths.concat(filesInFolder(folder + '\\' + files[i]));
        } else if (stat.isFile() && (!pattern || files[i].match(pattern))) {
          paths.push(folder + '\\' + files[i]);
        }
      }

      return paths;
    }

    return filesInFolder(path);
  },

  arguments: process.argv.slice(2),

  standardOut: {
    Write(str: string) {
      process.stdout.write(str);
    },
    WriteLine(str: string) {
      process.stdout.write(str + '\n');
    },
    Close() {},
  },
};
