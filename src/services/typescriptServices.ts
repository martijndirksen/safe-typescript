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

import { Errors } from '../compiler/core/errors';
import { IClassifierHost, Classifier } from './classifier';
import { ICoreServicesHost, CoreServices } from './coreServices';
import {
  ILanguageServiceHost,
  ILanguageService,
  logInternalError,
} from './languageService';
import { LanguageService } from './pullLanguageService';
import {
  IShimFactory,
  IShim,
  ILanguageServiceShimHost,
  ILanguageServiceShim,
  LanguageServiceShimHostAdapter,
  LanguageServiceShim,
  ClassifierShim,
  CoreServicesShim,
} from './shims';

export function copyDataObject(dst: any, src: any): any {
  for (var e in dst) {
    if (typeof dst[e] == 'object') {
      copyDataObject(dst[e], src[e]);
    } else if (typeof dst[e] != 'function') {
      dst[e] = src[e];
    }
  }
  return dst;
}

export class TypeScriptServicesFactory implements IShimFactory {
  private _shims: IShim[] = [];

  public createPullLanguageService(
    host: ILanguageServiceHost
  ): ILanguageService {
    try {
      return new LanguageService(host);
    } catch (err) {
      logInternalError(host, err as Error);
      throw err;
    }
  }

  public createLanguageServiceShim(
    host: ILanguageServiceShimHost
  ): ILanguageServiceShim {
    try {
      var hostAdapter = new LanguageServiceShimHostAdapter(host);
      var pullLanguageService = this.createPullLanguageService(hostAdapter);
      return new LanguageServiceShim(this, host, pullLanguageService);
    } catch (err) {
      logInternalError(host, err as Error);
      throw err;
    }
  }

  public createClassifier(host: IClassifierHost): Classifier {
    try {
      return new Classifier(host);
    } catch (err) {
      logInternalError(host, err as Error);
      throw err;
    }
  }

  public createClassifierShim(host: IClassifierHost): ClassifierShim {
    try {
      return new ClassifierShim(this, host);
    } catch (err) {
      logInternalError(host, err as Error);
      throw err;
    }
  }

  public createCoreServices(host: ICoreServicesHost): CoreServices {
    try {
      return new CoreServices(host);
    } catch (err) {
      logInternalError(host.logger, err as Error);
      throw err;
    }
  }

  public createCoreServicesShim(host: ICoreServicesHost): CoreServicesShim {
    try {
      return new CoreServicesShim(this, host);
    } catch (err) {
      logInternalError(host.logger, err as Error);
      throw err;
    }
  }

  public close(): void {
    // Forget all the registered shims
    this._shims = [];
  }

  public registerShim(shim: IShim): void {
    this._shims.push(shim);
  }

  public unregisterShim(shim: IShim): void {
    for (var i = 0, n = this._shims.length; i < n; i++) {
      if (this._shims[i] === shim) {
        delete this._shims[i];
        return;
      }
    }

    throw Errors.invalidOperation();
  }
}
