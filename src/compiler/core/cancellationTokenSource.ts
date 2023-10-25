import type { ICancellationToken } from './cancellationToken';

export interface ICancellationTokenSource {
  token(): ICancellationToken;
  cancel(): void;
}
