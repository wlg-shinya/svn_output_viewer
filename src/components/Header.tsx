import React, { useRef } from 'react';
import type { EncodingType, SortMode, DelimiterMode } from '../types';
import { getStatusLabel } from '../utils/svnParser';

interface HeaderProps {
  encoding: EncodingType;
  onEncodingChange: (val: EncodingType) => void;
  limit: number;
  onLimitChange: (val: number) => void;
  sortMode: SortMode;
  onSortModeChange: (val: SortMode) => void;
  delimiterMode: DelimiterMode;
  onDelimiterModeChange: (val: DelimiterMode) => void;
  fileName: string | null;
  onFileSelect: (file: File) => void;
  counts: Record<string, number>;
  totalCount: number;
  currentFilter: string;
  onFilterChange: (status: string) => void;
  filterText: string;
  onFilterTextChange: (text: string) => void;
  isDirMode: boolean;
  onToggleDirMode: () => void;
  dirDepth: string;
  onDirDepthChange: (depth: string) => void;
  includeStatus: boolean;
  onIncludeStatusChange: (val: boolean) => void;
  includeCount: boolean;
  onIncludeCountChange: (val: boolean) => void;
  onCopy: () => void;
  copyBtnText: string;
  onOpenHelp: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  encoding,
  onEncodingChange,
  limit,
  onLimitChange,
  sortMode,
  onSortModeChange,
  delimiterMode,
  onDelimiterModeChange,
  fileName,
  onFileSelect,
  counts,
  totalCount,
  currentFilter,
  onFilterChange,
  filterText,
  onFilterTextChange,
  isDirMode,
  onToggleDirMode,
  dirDepth,
  onDirDepthChange,
  includeStatus,
  onIncludeStatusChange,
  includeCount,
  onIncludeCountChange,
  onCopy,
  copyBtnText,
  onOpenHelp,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // フィルタボタンの抽出計算
  const conflictTypes = ['C-Content', 'C-Prop', 'C-Both', 'C-Tree'];
  const priorityTypes = ['All', 'M', 'A', 'D', 'U', 'G', '?', '!', 'I', 'X', 'R', 'None'];

  const typesToShow: string[] = ['All'];
  let totalConflicts = 0;
  conflictTypes.forEach((t) => (totalConflicts += counts[t] || 0));

  const countsWithConflict = { ...counts };
  if (totalConflicts > 0) {
    countsWithConflict['C-All'] = totalConflicts;
    typesToShow.push('C-All');
  }

  conflictTypes.forEach((t) => {
    if (countsWithConflict[t]) typesToShow.push(t);
  });
  priorityTypes.forEach((t) => {
    if (t !== 'All' && countsWithConflict[t]) typesToShow.push(t);
  });
  Object.keys(countsWithConflict).forEach((t) => {
    if (!typesToShow.includes(t)) typesToShow.push(t);
  });

  return (
    <header>
      <div className="header-row">
        <select
          value={encoding}
          onChange={(e) => onEncodingChange(e.target.value as EncodingType)}
          title="文字コードを選択"
          style={{ width: '90px' }}
        >
          <option value="Shift_JIS">SJIS</option>
          <option value="UTF-8">UTF-8</option>
        </select>

        <div className="config-label">
          表示:
          <input
            type="number"
            className="num-input"
            value={limit}
            min={1}
            step={1000}
            onChange={(e) => onLimitChange(parseInt(e.target.value, 10) || 5000)}
            style={{ width: '55px' }}
          />
        </div>

        <select
          value={sortMode}
          onChange={(e) => onSortModeChange(e.target.value as SortMode)}
          title="表示順序の切り替え"
        >
          <option value="none">順序: ログ順 (デフォルト)</option>
          <option value="path">順序: パス (A-Z)</option>
          <option value="status-prio">順序: ステータス (重要度)</option>
          <option value="status-az">順序: ステータス (A-Z)</option>
        </select>

        <select
          value={delimiterMode}
          onChange={(e) => onDelimiterModeChange(e.target.value as DelimiterMode)}
          title="パス区切り文字の切り替え"
        >
          <option value="original">パス区切り: ログ準拠</option>
          <option value="win">パス区切り: Win (\)</option>
          <option value="unix">パス区切り: Unix (/)</option>
        </select>

        <div className="drop-zone" onClick={() => fileInputRef.current?.click()}>
          {fileName ? `📄 ${fileName}` : '📂 ログをドロップ または クリック'}
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                onFileSelect(e.target.files[0]);
                e.target.value = '';
              }
            }}
          />
        </div>

        <div className="filters">
          {totalCount > 0 &&
            typesToShow.map((status) => {
              const count = status === 'All' ? totalCount : countsWithConflict[status];
              if (count === undefined) return null;
              return (
                <button
                  key={status}
                  className={currentFilter === status ? 'active' : ''}
                  data-status={status}
                  onClick={() => onFilterChange(status)}
                >
                  {getStatusLabel(status)}{' '}
                  <span className="count">{count}</span>
                </button>
              );
            })}
        </div>
      </div>

      <div className="header-row">
        <input
          type="text"
          className="search-box"
          value={filterText}
          onChange={(e) => onFilterTextChange(e.target.value)}
          placeholder="🔍 ^先頭 -除外 -^先頭除外 テキスト..."
        />

        <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
          <button
            id="dirModeBtn"
            className={`btn-toggle ${isDirMode ? 'active' : ''}`}
            onClick={onToggleDirMode}
            title="ディレクトリ集約モードを切り替え"
          >
            📂 ディレクトリ集約
          </button>
          <input
            type="number"
            className="num-input"
            min={1}
            value={dirDepth}
            onChange={(e) => onDirDepthChange(e.target.value)}
            placeholder="階層"
            title="何階層目までで集約するか (例: 1=トップフォルダのみ, 空=最深)"
            style={{ width: '45px' }}
            disabled={!isDirMode}
          />
        </div>

        <div
          style={{
            display: 'flex',
            gap: '0.5rem',
            alignItems: 'center',
            borderLeft: '1px solid #444',
            paddingLeft: '0.5rem',
          }}
        >
          <button className="btn-copy" onClick={onCopy}>
            {copyBtnText}
          </button>
          <label className="config-label" title="コピー時にステータス(M:変更, A:追加など)を含めます">
            <input
              type="checkbox"
              checked={includeStatus}
              onChange={(e) => onIncludeStatusChange(e.target.checked)}
            />{' '}
            ステータスも
          </label>
          <label className="config-label" title="ディレクトリ集約時のみ有効: ファイル数を含めます">
            <input
              type="checkbox"
              checked={includeCount}
              onChange={(e) => onIncludeCountChange(e.target.checked)}
              disabled={!isDirMode}
            />{' '}
            件数も
          </label>
        </div>

        <button className="btn-help" onClick={onOpenHelp} title="ヘルプを表示">
          ?
        </button>
      </div>
    </header>
  );
};