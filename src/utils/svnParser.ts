import type {
  LogItem,
  DelimiterMode,
  SearchRule,
  SearchTerms
} from '../types';

// ステータスごとのソート優先度マップ
export const statusPriorityMap: Record<string, number> = {
  'C-Content': 10, 'C-Prop': 11, 'C-Both': 12, 'C-Tree': 13,
  '!': 20,
  '?': 30,
  'M': 40,
  'A': 50,
  'D': 60,
  'R': 65,
  'G': 70,
  'U': 71,
  'I': 80,
  'X': 90,
  'None': 95,
  'Other': 100
};

// パス区切り文字の変換
export function formatPath(path: string, mode: DelimiterMode): string {
  if (mode === 'win') return path.replace(/\//g, '\\');
  if (mode === 'unix') return path.replace(/\\/g, '/');
  return path;
}

// ログのステータス判定
export function determineStatus(raw: string, line: string): string {
  if (line.includes("Skipped")) return "Skipped";
  
  const char0 = raw.charAt(0);
  const char1 = raw.length > 1 ? raw.charAt(1) : ' ';
  const char3plus = raw.length > 3 ? raw.substring(3) : '';

  const isC0 = (char0 === 'C');
  const isC1 = (char1 === 'C');
  const isCTree = char3plus.includes('C');

  if (isC0 && isC1) return "C-Both";     
  if (isC0) return "C-Content";          
  if (isC1) return "C-Prop";             
  if (isCTree) return "C-Tree";          

  if (raw.trim() === '>') return 'G';
  const first = raw.trim().charAt(0);
  return first || 'None';
}

// ログテキスト全体のパース処理
export function parseLog(text: string): LogItem[] {
  const logData: LogItem[] = [];
  const lines = text.split(/\r?\n/);
  const regex = /^([A-Z!?>~+\sCGMURDELIX]{1,7})\s+(.*)$/;

  lines.forEach((line, index) => {
    const cleanLine = line.replace(/\r$/, '');
    if (!cleanLine.trim()) return;
    if (cleanLine.startsWith('[')) return;
    if (cleanLine.startsWith('---')) return;
    if (cleanLine.startsWith('Updating')) return; 

    const match = cleanLine.match(regex);
    if (match) {
      const rawStatus = match[1];
      const path = match[2].trim(); 
      const status = determineStatus(rawStatus, cleanLine);
      logData.push({ id: index, status, path, rawLine: cleanLine, statusRaw: rawStatus.trim() });
    } else {
      logData.push({ id: index, status: 'None', path: cleanLine.trim(), rawLine: cleanLine, statusRaw: '' });
    }
  });

  return logData;
}

// ステータスの表示用ラベルを取得
export function getStatusLabel(s: string): string {
  const labels: Record<string, string> = {
    'C-All':     'C:全競合',
    'C-Content': 'C:競合(内容)',
    'C-Prop':    'C:競合(属性)',
    'C-Both':    'C:競合(両方)',
    'C-Tree':    'C:競合(ツリー)',
    'C': 'C:競合',
    'G': 'G:マージ',
    'U': 'U:更新',
    'D': 'D:削除',
    'A': 'A:追加',
    'M': 'M:変更',
    'R': 'R:置換',
    'I': 'I:無視',
    'X': 'X:外部',
    '~': '~:型変',
    'L': 'L:ロック',
    'E': 'E:存在',
    '?': '?:管理外',
    '!': '!:欠落',
    'None': '-:無し',
    'All': 'All:全て'
  };
  return labels[s] || s;
}

// ソート用の優先度数値取得
export function getStatusSortPrio(s: string): number {
  return statusPriorityMap[s] || 999;
}

// 検索キーワードの解析 (^先頭, -除外 パターン)
export function parseSearchTerms(inputText: string): SearchTerms {
  const rawTerms = inputText.split(/\s+/).filter(t => t.length > 0);
  const includes: SearchRule[] = [];
  const excludes: SearchRule[] = [];

  rawTerms.forEach(t => {
    let term = t;
    let isExclude = false;
    let isAnchor = false;

    if (term.startsWith('-') && term.length > 1) {
      isExclude = true;
      term = term.substring(1);
    }
    if (term.startsWith('^') && term.length > 1) {
      isAnchor = true;
      term = term.substring(1);
    } else if (term.startsWith('^') && term.length === 1) {
      // ただの '^' は無視
    }

    const obj: SearchRule = { text: term.toLowerCase(), anchor: isAnchor, raw: term };
    if (isExclude) excludes.push(obj);
    else includes.push(obj);
  });

  return { includes, excludes };
}

// 指定階層でのディレクトリパス切り出し
export function truncatePathByDepth(path: string, depth: number, mode: DelimiterMode): string {
  const displayPath = formatPath(path, mode);
  const idxSlash = displayPath.lastIndexOf('/');
  const idxBack = displayPath.lastIndexOf('\\');
  const lastSep = Math.max(idxSlash, idxBack);
  const fullDirPath = lastSep >= 0 ? displayPath.substring(0, lastSep + 1) : '';

  if (!depth || depth < 1 || fullDirPath === '') {
      return fullDirPath || '(Root)';
  }

  let sepCount = 0;
  for (let i = 0; i < fullDirPath.length; i++) {
      const c = fullDirPath[i];
      if (c === '/' || c === '\\') {
          sepCount++;
          if (sepCount === depth) {
              return fullDirPath.substring(0, i + 1);
          }
      }
  }
  
  return fullDirPath;
}

// 正規表現の特殊文字エスケープ
export function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}