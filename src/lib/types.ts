export type SymbolKind = 'symbol' | 'person' | 'place';

export interface Dream {
  id: string;
  title: string;
  body: string;
  dreamDate: string; // YYYY-MM-DD
  mood: number | null; // 0-4 index into MOODS
  lucid: boolean;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface InterpretationSymbol {
  name: string;
  kind: SymbolKind;
  meaning: string;
}

export interface Interpretation {
  dreamId: string;
  title: string;
  summary: string;
  symbols: InterpretationSymbol[];
  emotions: string[];
  tone: string;
  patternCallback: string | null;
  createdAt: string;
}

export interface PatternItem {
  name: string;
  kind: SymbolKind | 'emotion';
  count: number;
  previousCount: number; // same-length window before, for trend
}
