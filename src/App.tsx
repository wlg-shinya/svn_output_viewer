import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type {
  LogItem,
  SortMode,
  DelimiterMode,
  EncodingType,
  DirGroupItem,
} from './types';
import {
  parseLog,
  parseSearchTerms,
  formatPath,
  getStatusSortPrio,
  getStatusLabel,
  truncatePathByDepth,
} from './utils/svnParser';
import { Header } from './components/Header';
import { LogViewer, type LogViewerItem } from './components/LogViewer';
import { Footer } from './components/Footer';
import { HelpModal } from './components/HelpModal';

export const App: React.FC = () => {
  // --- 状態 (State) 定義 ---
  const [logData, setLogData] = useState<LogItem[]>([]);
  const [currentFilter, setCurrentFilter] = useState<string>('All');
  const [filterText, setFilterText] = useState<string>('');
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [isDirMode, setIsDirMode] = useState<boolean>(false);
  const [dirDepth, setDirDepth] = useState<string>('');
  const [encoding, setEncoding] = useState<EncodingType>('Shift_JIS');
  const [limit, setLimit] = useState<number>(5000);
  const [sortMode, setSortMode] = useState<SortMode>('none');
  const [delimiterMode, setDelimiterMode] = useState<DelimiterMode>('original');
  const [includeStatus, setIncludeStatus] = useState<boolean>(false);
  const [includeCount, setIncludeCount] = useState<boolean>(false);
  const [isHelpOpen, setIsHelpOpen] = useState<boolean>(false);
  const [copyBtnText, setCopyBtnText] = useState<string>('📋 表示をコピー');

  // --- ファイル読み込み処理 ---
  const handleFile = useCallback(
    (file: File) => {
      if (!file) return;
      setCurrentFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result;
        if (typeof text === 'string') {
          const parsed = parseLog(text);
          setLogData(parsed);
        }
      };
      try {
        reader.readAsText(file, encoding);
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        alert('読込エラー: ' + errorMsg);
      }
    },
    [encoding]
  );

  // エンコーディング変更時に再読み込み
  useEffect(() => {
    if (currentFile) {
      handleFile(currentFile);
    }
  }, [encoding, currentFile, handleFile]);

  // 初期化（URLクエリパラメータ取得 & デフォルトログの自動読込試行）
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const filterParam = params.get('q') || params.get('filter');
    if (filterParam) {
      setFilterText(filterParam);
    }

    fetch('svn_output.log')
      .then((res) => {
        // 開発サーバーが 404 の代わりに index.html(text/html) を返した場合は弾く
        const contentType = res.headers.get('content-type');
        if (!res.ok || (contentType && contentType.includes('text/html'))) {
          throw new Error('Not found or returned HTML fallback');
        }
        return res.blob();
      })
      .then((blob) => {
        const file = new File([blob], 'svn_output.log');
        handleFile(file);
      })
      .catch(() => {
        // デフォルトファイルが存在しない場合は静かにスキップ
      });
  }, [handleFile]);

  // 全体ドラッグ＆ドロップ処理
  useEffect(() => {
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      document.body.classList.add('drag-over');
    };
    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      if (e.relatedTarget === null) {
        document.body.classList.remove('drag-over');
      }
    };
    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      document.body.classList.remove('drag-over');
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        handleFile(e.dataTransfer.files[0]);
      }
    };

    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('drop', handleDrop);
    };
  }, [handleFile]);

  // --- 集計・フィルタリング計算 ---
  const counts = useMemo(() => {
    return logData.reduce<Record<string, number>>((acc, item) => {
      acc[item.status] = (acc[item.status] || 0) + 1;
      return acc;
    }, {});
  }, [logData]);

  const searchTerms = useMemo(() => parseSearchTerms(filterText), [filterText]);

  // 表示アイテムの生成 (フィルタリング + ディレクトリ集約 + ソート)
  const filteredItems = useMemo(() => {
    const { includes, excludes } = searchTerms;

    // 1. ステータス ＆ テキストフィルタ
    let list = logData.filter((item) => {
      if (currentFilter !== 'All') {
        if (currentFilter === 'C-All') {
          if (!item.status.startsWith('C')) return false;
        } else {
          if (item.status !== currentFilter) return false;
        }
      }

      if (includes.length === 0 && excludes.length === 0) return true;

      const displayPath = formatPath(item.path, delimiterMode);
      const lowerPath = displayPath.toLowerCase();

      const isExcluded = excludes.some((rule) =>
        rule.anchor ? lowerPath.startsWith(rule.text) : lowerPath.includes(rule.text)
      );
      if (isExcluded) return false;

      const matchesAll = includes.every((rule) =>
        rule.anchor ? lowerPath.startsWith(rule.text) : lowerPath.includes(rule.text)
      );
      return matchesAll;
    });

    // 2. ディレクトリ集約モード
    if (isDirMode) {
      const dirMap = new Map<string, DirGroupItem>();
      const depthVal = parseInt(dirDepth, 10);

      list.forEach((item) => {
        const dirPath = truncatePathByDepth(item.path, depthVal, delimiterMode);

        if (!dirMap.has(dirPath)) {
          dirMap.set(dirPath, {
            path: dirPath,
            status: item.status,
            count: 0,
            hasConflict: false,
            prio: getStatusSortPrio(item.status),
          });
        }

        const dirEntry = dirMap.get(dirPath)!;
        dirEntry.count++;

        const currentPrio = getStatusSortPrio(item.status);
        if (currentPrio < dirEntry.prio) {
          dirEntry.prio = currentPrio;
          dirEntry.status = item.status;
        }

        if (item.status.startsWith('C')) {
          dirEntry.hasConflict = true;
        }
      });

      const dirList = Array.from(dirMap.values());

      // ディレクトリモードでのソート
      if (sortMode !== 'none') {
        dirList.sort((a, b) => {
          if (sortMode === 'path') return a.path.localeCompare(b.path);
          if (sortMode === 'status-az') {
            const sDiff = a.status.localeCompare(b.status);
            return sDiff !== 0 ? sDiff : a.path.localeCompare(b.path);
          }
          if (sortMode === 'status-prio') {
            if (a.prio !== b.prio) return a.prio - b.prio;
            return a.path.localeCompare(b.path);
          }
          return 0;
        });
      } else {
        dirList.sort((a, b) => a.path.localeCompare(b.path));
      }

      return dirList as LogViewerItem[];
    }

    // 3. 通常ファイルモードでのソート
    if (sortMode !== 'none') {
      list = [...list].sort((a, b) => {
        const pathA = formatPath(a.path, delimiterMode);
        const pathB = formatPath(b.path, delimiterMode);

        if (sortMode === 'path') return pathA.localeCompare(pathB);
        if (sortMode === 'status-az') {
          const sDiff = a.status.localeCompare(b.status);
          return sDiff !== 0 ? sDiff : pathA.localeCompare(pathB);
        }
        if (sortMode === 'status-prio') {
          const pA = getStatusSortPrio(a.status);
          const pB = getStatusSortPrio(b.status);
          if (pA !== pB) return pA - pB;
          return pathA.localeCompare(pathB);
        }
        return 0;
      });
    }

    return list as LogViewerItem[];
  }, [logData, currentFilter, searchTerms, isDirMode, dirDepth, delimiterMode, sortMode]);

  // --- ステータスバーテキストの生成 ---
  const statusText = useMemo(() => {
    if (logData.length === 0) return '待機中';
    if (filteredItems.length === 0) return '検索結果: 0 件';

    if (isDirMode) {
      const totalItems = filteredItems.reduce((acc, item) => acc + (item.count || 0), 0);
      return `検索結果: ${filteredItems.length} 件のディレクトリ (累計: ${totalItems} items)`;
    }
    return `検索結果: ${filteredItems.length} 件のファイル`;
  }, [logData.length, filteredItems, isDirMode]);

  // --- クリップボードコピー処理 ---
  const copyToClipboard = useCallback(async (text: string, msg = 'コピーしました！') => {
    if (!text) {
      alert('コピーする項目がありません！');
      return;
    }
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        setCopyBtnText(msg);
        setTimeout(() => setCopyBtnText('📋 表示をコピー'), 1500);
        return;
      }
      throw new Error('Fallback required');
    } catch {
      try {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);

        if (successful) {
          setCopyBtnText(msg);
          setTimeout(() => setCopyBtnText('📋 表示をコピー'), 1500);
        } else {
          alert('コピーに失敗しました (Browser restriction)');
        }
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        alert('コピーに失敗しました: ' + errorMsg);
      }
    }
  }, []);

  const handleCopy = useCallback(() => {
    const lines = filteredItems.map((item) => {
      let line = isDirMode ? item.path : formatPath(item.path, delimiterMode);
      if (isDirMode && includeCount) {
        line += ` (${item.count})`;
      }
      if (includeStatus) {
        let stLabel = getStatusLabel(item.status);
        if (isDirMode) stLabel += '...';
        line = `${stLabel}\t${line}`;
      }
      return line;
    });

    copyToClipboard(lines.join('\n'), `${lines.length} 件をコピーしました！`);
  }, [filteredItems, isDirMode, delimiterMode, includeCount, includeStatus, copyToClipboard]);

  return (
    <>
      <Header
        encoding={encoding}
        onEncodingChange={setEncoding}
        limit={limit}
        onLimitChange={setLimit}
        sortMode={sortMode}
        onSortModeChange={setSortMode}
        delimiterMode={delimiterMode}
        onDelimiterModeChange={setDelimiterMode}
        fileName={currentFile ? currentFile.name : null}
        onFileSelect={handleFile}
        counts={counts}
        totalCount={logData.length}
        currentFilter={currentFilter}
        onFilterChange={setCurrentFilter}
        filterText={filterText}
        onFilterTextChange={setFilterText}
        isDirMode={isDirMode}
        onToggleDirMode={() => setIsDirMode((prev) => !prev)}
        dirDepth={dirDepth}
        onDirDepthChange={setDirDepth}
        includeStatus={includeStatus}
        onIncludeStatusChange={setIncludeStatus}
        includeCount={includeCount}
        onIncludeCountChange={setIncludeCount}
        onCopy={handleCopy}
        copyBtnText={copyBtnText}
        onOpenHelp={() => setIsHelpOpen(true)}
      />

      <LogViewer
        items={filteredItems}
        limit={limit}
        isDirMode={isDirMode}
        delimiterMode={delimiterMode}
        includesRules={searchTerms.includes}
        onCopyPath={(path) => copyToClipboard(path, 'パスをコピーしました！')}
      />

      <Footer statusText={statusText} />

      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
    </>
  );
};

export default App;