export type FormularioInteligenteFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'date'
  | 'boolean'
  | 'file'
  | 'select';

export interface FormularioInteligenteFieldSchema {
  id: string;
  label: string;
  type: FormularioInteligenteFieldType;
  required: boolean;
  options?: string[];
}

export interface FormularioInteligenteRequestContext {
  [key: string]: unknown;
}

export interface FormularioInteligenteRequestDto {
  activityId: string;
  activityName: string;
  policyName: string;
  formSchema: FormularioInteligenteFieldSchema[];
  currentValues: Record<string, unknown>;
  userPrompt: string;
  context?: FormularioInteligenteRequestContext | null;
}

export interface FormularioInteligenteChangeDto {
  fieldId: string;
  oldValue: unknown;
  newValue: unknown;
  reason: string;
}

export interface FormularioInteligenteResponseDto {
  success: boolean;
  updatedValues: Record<string, unknown>;
  changes: FormularioInteligenteChangeDto[];
  warnings: string[];
  confidence: number | null;
  message: string | null;
}

export interface FormularioInteligenteResult {
  updatedValues: Record<string, unknown>;
  changes: FormularioInteligenteChangeDto[];
  warnings: string[];
  confidence: number | null;
  message: string | null;
}

export type VoiceRecognitionAvailability =
  | 'supported'
  | 'unsupported';

export type VoiceRecognitionState =
  | 'idle'
  | 'listening'
  | 'processing'
  | 'error'
  | 'unsupported';

export interface VoiceRecognitionError {
  code: string;
  message: string;
}

export type VoiceRecognitionEvent =
  | { type: 'start' }
  | { type: 'result'; transcript: string; isFinal: boolean }
  | { type: 'error'; error: VoiceRecognitionError }
  | { type: 'end' };
