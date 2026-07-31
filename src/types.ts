export interface LogItem {
  id: number;
  status: string;
  path: string;
  rawLine: string;
  statusRaw: string;
}

export type SortMode = 'none' | 'path' | 'status-prio' | 'status-az';

export type DelimiterMode = 'original' | 'win' | 'unix';

export type EncodingType = 'Shift_JIS' | 'UTF-8';

export interface SearchRule {
  text: string;
  anchor: boolean;
  raw: string;
}

export interface SearchTerms {
  includes: SearchRule[];
  excludes: SearchRule[];
}

export interface DirGroupItem {
  path: string;
  status: string;
  count: number;
  hasConflict: boolean;
  prio: number;
}