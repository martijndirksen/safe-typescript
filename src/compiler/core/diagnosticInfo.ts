import { DiagnosticCategory } from './diagnosticCategory';

export interface DiagnosticInfo {
  category: DiagnosticCategory;
  message?: string;
  code: number;
}
