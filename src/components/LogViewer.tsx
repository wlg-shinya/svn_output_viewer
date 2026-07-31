import React from 'react';
import type { DelimiterMode, SearchRule } from '../types';
import { formatPath, getStatusLabel, escapeRegExp } from '../utils/svnParser';

export interface LogViewerItem {
  id?: number;
  path: string;
  status: string;
  count?: number;
  hasConflict?: boolean;
}

interface LogViewerProps {
  items: LogViewerItem[];
  limit: number;
  isDirMode: boolean;
  delimiterMode: DelimiterMode;
  includesRules: SearchRule[];
  onCopyPath: (path: string) => void;
}

export const LogViewer: React.FC<LogViewerProps> = ({
  items,
  limit,
  isDirMode,
  delimiterMode,
  includesRules,
  onCopyPath,
}) => {
  if (items.length === 0) {
    return (
      <div id="file-list">
        <div style={{ padding: '2rem', textAlign: 'center', color: '#666', lineHeight: 1.6 }}>
          <p>SVNの出力ログファイルをドロップしてください。</p>
          <p>ログ上のパス区切り文字（\ または /）を維持して表示します。</p>
          <p>
            検索構文や競合のヘルプは{' '}
            <span style={{ background: '#007acc', padding: '0 5px', color: 'white', borderRadius: '3px' }}>
              ?
            </span>{' '}
            をクリック。
          </p>
        </div>
      </div>
    );
  }

  const displayItems = items.slice(0, limit);

  // 検索ヒット箇所のハイライト用正規表現を構築
  let highlightRegex: RegExp | null = null;
  if (includesRules.length > 0) {
    const parts = includesRules.map((rule) => {
      const esc = escapeRegExp(rule.raw);
      return rule.anchor ? `(^${esc})` : `(${esc})`;
    });
    highlightRegex = new RegExp(parts.join('|'), 'gi');
  }

  return (
    <div id="file-list">
      {displayItems.map((item, idx) => {
        let displayStatus = item.status;
        if (isDirMode && item.hasConflict && !item.status.startsWith('C')) {
          displayStatus = 'C-Content';
        }

        const label = getStatusLabel(displayStatus);
        const statusText = isDirMode ? `${label}...` : label;
        const formattedPathStr = isDirMode ? item.path : formatPath(item.path, delimiterMode);

        let pathHtml = formattedPathStr;
        if (highlightRegex) {
          pathHtml = formattedPathStr.replace(
            highlightRegex,
            '<span class="highlight-text">$&</span>'
          );
        }

        if (isDirMode && item.count !== undefined) {
          pathHtml += ` <span class="dir-badge">${item.count} items</span>`;
        }

        return (
          <div
            key={item.id ?? `dir-${idx}-${item.path}`}
            className={`log-line${isDirMode ? ' is-dir' : ''}`}
          >
            <div className={`status status-${displayStatus}`}>{statusText}</div>
            <div
              className="path"
              title="クリックでパスをコピー"
              onClick={() => onCopyPath(formattedPathStr)}
              dangerouslySetInnerHTML={{ __html: pathHtml }}
            />
          </div>
        );
      })}

      {items.length > limit && (
        <div style={{ padding: '1rem', color: 'orange' }}>
          ... 他 {items.length - limit} 件を表示省略しています。
        </div>
      )}
    </div>
  );
};