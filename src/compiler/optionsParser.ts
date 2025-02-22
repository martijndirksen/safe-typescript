import { getLocalizedText, getDiagnosticMessage } from './core/diagnosticCore';
import { IIO } from './io';
import { DiagnosticCode } from './resources/diagnosticCode.generated';

export interface IOptions {
  name?: string;
  flag?: boolean;
  short?: string;
  usage?: {
    locCode: string; // DiagnosticCode
    args?: string[];
  };
  set?: (s: string) => void;
  type?: string; // DiagnosticCode
  experimental?: boolean;
}

export class OptionsParser {
  private DEFAULT_SHORT_FLAG = '-';
  private DEFAULT_LONG_FLAG = '--';

  private printedVersion: boolean = false;

  // Find the option record for the given string. Returns null if not found.
  private findOption(arg: string) {
    var upperCaseArg = arg && arg.toUpperCase();

    for (var i = 0; i < this.options.length; i++) {
      var current = this.options[i];

      if (
        upperCaseArg === (current.short && current.short.toUpperCase()) ||
        upperCaseArg === (current.name && current.name.toUpperCase())
      ) {
        return current;
      }
    }

    return null;
  }

  public unnamed: string[] = [];

  public options: IOptions[] = [];

  constructor(
    public host: IIO,
    public version: string,
    public researchVersion: string
  ) {}

  public printUsage() {
    this.printVersion();

    var optionsWord = getLocalizedText(DiagnosticCode.options, null);
    var fileWord = getLocalizedText(DiagnosticCode.file1, null);
    var tscSyntax = 'tsc [' + optionsWord + '] [' + fileWord + ' ..]';
    var syntaxHelp = getLocalizedText(DiagnosticCode.Syntax_0, [tscSyntax]);
    this.host.printLine(syntaxHelp);
    this.host.printLine('');
    this.host.printLine(
      getLocalizedText(DiagnosticCode.Examples, null) + ' tsc hello.ts'
    );
    this.host.printLine('          tsc --out foo.js foo.ts');
    this.host.printLine('          tsc @args.txt');
    this.host.printLine('');
    this.host.printLine(getLocalizedText(DiagnosticCode.Options, null));

    var output: string[][] = [];
    var maxLength = 0;
    var i = 0;

    this.options = this.options.sort(function (a, b) {
      var aName = a.name.toLowerCase();
      var bName = b.name.toLowerCase();

      if (aName > bName) {
        return 1;
      } else if (aName < bName) {
        return -1;
      } else {
        return 0;
      }
    });

    // Build up output array
    for (i = 0; i < this.options.length; i++) {
      var option = this.options[i];

      if (option.experimental) {
        continue;
      }

      if (!option.usage) {
        break;
      }

      var usageString = '  ';
      var type = option.type ? ' ' + getLocalizedText(option.type, null) : '';

      if (option.short) {
        usageString += this.DEFAULT_SHORT_FLAG + option.short + type + ', ';
      }

      usageString += this.DEFAULT_LONG_FLAG + option.name + type;

      output.push([
        usageString,
        getLocalizedText(option.usage.locCode, option.usage.args),
      ]);

      if (usageString.length > maxLength) {
        maxLength = usageString.length;
      }
    }

    var fileDescription = getLocalizedText(
      DiagnosticCode.Insert_command_line_options_and_files_from_a_file,
      null
    );
    output.push(['  @<' + fileWord + '>', fileDescription]);

    // Print padded output
    for (i = 0; i < output.length; i++) {
      this.host.printLine(
        output[i][0] +
          new Array(maxLength - output[i][0].length + 3).join(' ') +
          output[i][1]
      );
    }
  }

  public printVersion() {
    if (!this.printedVersion) {
      this.host.printLine(
        getLocalizedText(DiagnosticCode.Version_0, [this.version])
      );
      this.host.printLine(
        getLocalizedText(DiagnosticCode.ResearchVersion_0, [
          this.researchVersion,
        ])
      );
      this.printedVersion = true;
    }
  }

  public option(name: string, config: IOptions, short?: string) {
    if (!config) {
      config = <any>short;
      short = null;
    }

    config.name = name;
    config.short = short;
    config.flag = false;

    this.options.push(config);
  }

  public flag(name: string, config: IOptions, short?: string) {
    if (!config) {
      config = <any>short;
      short = null;
    }

    config.name = name;
    config.short = short;
    config.flag = true;

    this.options.push(config);
  }

  // Parse an arguments string
  public parseString(argString: string) {
    var position = 0;
    var tokens = argString.match(/\s+|"|[^\s"]+/g);

    function peek() {
      return tokens[position];
    }

    function consume() {
      return tokens[position++];
    }

    function consumeQuotedString() {
      var value = '';
      consume(); // skip opening quote.

      var token = peek();

      while (token && token !== '"') {
        consume();

        value += token;

        token = peek();
      }

      consume(); // skip ending quote;

      return value;
    }

    var args: string[] = [];
    var currentArg = '';

    while (position < tokens.length) {
      var token = peek();

      if (token === '"') {
        currentArg += consumeQuotedString();
      } else if (token.match(/\s/)) {
        if (currentArg.length > 0) {
          args.push(currentArg);
          currentArg = '';
        }

        consume();
      } else {
        consume();
        currentArg += token;
      }
    }

    if (currentArg.length > 0) {
      args.push(currentArg);
    }

    this.parse(args);
  }

  // Parse arguments as they come from the platform: split into arguments.
  public parse(args: string[]) {
    var position = 0;

    function consume() {
      return args[position++];
    }

    while (position < args.length) {
      var current = consume();
      var match = current.match(/^(--?|@)(.*)/);
      var value: any = null;

      if (match) {
        if (match[1] === '@') {
          this.parseString(this.host.readFile(match[2]).contents);
        } else {
          var arg = match[2];
          var option = this.findOption(arg);

          if (option === null) {
            this.host.printLine(
              getDiagnosticMessage(DiagnosticCode.Unknown_option_0, [arg])
            );
            this.host.printLine(
              getLocalizedText(DiagnosticCode.Use_the_0_flag_to_see_options, [
                '--help',
              ])
            );
          } else {
            if (!option.flag) {
              value = consume();
              if (value === undefined) {
                // No value provided
                this.host.printLine(
                  getDiagnosticMessage(
                    DiagnosticCode.Option_0_specified_without_1,
                    [arg, getLocalizedText(option.type, null)]
                  )
                );
                this.host.printLine(
                  getLocalizedText(
                    DiagnosticCode.Use_the_0_flag_to_see_options,
                    ['--help']
                  )
                );
                continue;
              }
            }

            option.set(value);
          }
        }
      } else {
        this.unnamed.push(current);
      }
    }
  }
}
