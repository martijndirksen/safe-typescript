//
// Copyright (c) Microsoft Corporation.  All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//

///<reference path='..\compiler\typescript.ts' />
///<reference path='classifier.ts' />
///<reference path='languageService.ts' />
///<reference path='formatting\formatting.ts' />

import { getDiagnosticMessage } from '../compiler/core/diagnosticCore';
import { ILogger } from '../compiler/diagnostics';
import { IPreProcessedFileInfo, preProcessFile } from '../compiler/precompile';
import { DiagnosticCode } from '../compiler/resources/diagnosticCode.generated';
import { CompilationSettings } from '../compiler/settings';
import { LanguageVersion } from '../compiler/syntax/languageVersion';
import { IScriptSnapshot } from '../compiler/text/scriptSnapshot';

// Access to "Debug" object
export var debugObjectHost = <any>this;

export interface ICoreServicesHost {
  logger: ILogger;
}

export class CoreServices {
  constructor(public host: ICoreServicesHost) {}

  public getPreProcessedFileInfo(
    fileName: string,
    sourceText: IScriptSnapshot
  ): IPreProcessedFileInfo {
    return preProcessFile(fileName, sourceText);
  }

  public getDefaultCompilationSettings(): CompilationSettings {
    // Set "ES5" target by default for language service
    var settings = new CompilationSettings();
    settings.codeGenTarget = LanguageVersion.EcmaScript5;
    settings.serviceMode = true;
    return settings;
  }

  public dumpMemory(): string {
    if (
      !debugObjectHost ||
      !debugObjectHost.Debug ||
      !debugObjectHost.Debug.dumpHeap
    ) {
      throw new Error(
        getDiagnosticMessage(
          DiagnosticCode.This_version_of_the_Javascript_runtime_does_not_support_the_0_function,
          ['Debug.dumpHeap()']
        )
      );
    }

    var objects = debugObjectHost.Debug.dumpHeap(2);
    var totalSize = 0;
    for (var i = 0; i < objects.length; i++) {
      totalSize += objects[i].size;
    }

    return (
      'There are ' +
      objects.length +
      " object(s) accessible from 'global', for a total of " +
      totalSize +
      ' byte(s).'
    );
  }

  public getMemoryInfo(): any[] {
    if (
      !debugObjectHost ||
      !debugObjectHost.Debug ||
      !debugObjectHost.Debug.getMemoryInfo
    ) {
      throw new Error(
        getDiagnosticMessage(
          DiagnosticCode.This_version_of_the_Javascript_runtime_does_not_support_the_0_function,
          ['Debug.getMemoryInfo()']
        )
      );
    }

    return debugObjectHost.Debug.getMemoryInfo();
  }

  public collectGarbage(): void {
    if (!debugObjectHost || !debugObjectHost.CollectGarbage) {
      throw new Error(
        getDiagnosticMessage(
          DiagnosticCode.This_version_of_the_Javascript_runtime_does_not_support_the_0_function,
          ['collectGarbage()']
        )
      );
    }

    debugObjectHost.CollectGarbage();
  }
}
