// ============================================
// Foundry Guardian - Shared Types
// ============================================

export interface FoundryItem {
  name: string;
  key: string;
}

// --- Component Auditor Types ---

export interface LibraryFlag {
  name: string;       // e.g. "Web Hi-Fi", "Material UI", "Unknown"
  color: string;      // hex color for badge
  label: string;      // display label
}

export interface ComponentIssue {
  id: string;
  name: string;
  realName: string;
  libraryName: string;
  severity: 'critical' | 'info';
  flag: LibraryFlag;
  suggestions: SuggestionMatch[];
}

export interface SuggestionMatch {
  name: string;
  key: string;
  score: number;
}

// --- Token Linter Types ---

export interface TokenIssue {
  nodeId: string;
  nodeName: string;
  property: string;        // e.g. "paddingTop", "itemSpacing", "width"
  actualValue: number;
  nearestToken: number;    // closest valid token value
}

// Official Foundry spacing scale
export const FOUNDRY_SPACING_SCALE = [0, 2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96, 120, 160];

// --- Icon Auditor Types ---

export interface IconIssue {
  nodeId: string;
  nodeName: string;
  iconName: string;
  componentKey: string;
  isFoundry: boolean;
}

// --- Analytics Types ---

export interface AnalyticsSnapshot {
  timestamp: number;
  fileName: string;
  pageId: string;
  pageName: string;
  foundryCount: number;
  legacyCount: number;
  tokenErrorCount: number;
  iconErrorCount: number;
  extractedComponents: { key: string; name: string; type: 'FOUNDRY' | 'LEGACY' }[];
}

// --- Aggregated Scan Results ---

export interface ScanSummary {
  totalInstances: number;
  foundryCount: number;
  legacyCount: number;
  tokenErrors: number;
  iconErrors: number;
  healthScore: number;      // 0-100
}

export interface ScanResults {
  componentIssues: ComponentIssue[];
  tokenIssues: TokenIssue[];
  iconIssues: IconIssue[];
  summary: ScanSummary;
  extractedComponents: { key: string; name: string; type: 'FOUNDRY' | 'LEGACY' }[];
}

// --- Message Types (main <-> UI) ---

export type PluginMessage =
  | { type: 'SCAN_PAGE' }
  | { type: 'SWAP_COMPONENT'; nodeId: string; targetKey: string }
  | { type: 'FOCUS_NODE'; nodeId: string }
  | { type: 'EXPORT_REPORT'; reportType: 'component' | 'token' | 'icon' }
  | { type: 'SYNC_KEYS'; apiToken: string }
  | { type: 'SAVE_API_TOKEN'; token: string }
  | { type: 'GET_HISTORY' }
  | { type: 'SCAN_RESULTS'; data: ScanResults }
  | { type: 'HISTORY_RESULTS'; data: AnalyticsSnapshot[] }
  | { type: 'SYNC_STATUS'; status: 'loading' | 'success' | 'error'; message?: string }
  | { type: 'COPY_TO_CLIPBOARD'; text: string };
