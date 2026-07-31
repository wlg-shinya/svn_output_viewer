import { describe, it, expect } from 'vitest';
import type { DelimiterMode } from '../types';
import {
  formatPath,
  determineStatus,
  parseLog,
  getStatusLabel,
  getStatusSortPrio,
  parseSearchTerms,
  truncatePathByDepth,
  escapeRegExp
} from './svnParser';

describe('formatPath', () => {
  it('win モードでバックスラッシュに変換されること', () => {
    expect(formatPath('src/components/Header.tsx', 'win')).toBe('src\\components\\Header.tsx');
  });

  it('unix モードでスラッシュに変換されること', () => {
    expect(formatPath('src\\components\\Header.tsx', 'unix')).toBe('src/components/Header.tsx');
  });

  it('win/unix 以外のモードでは変換されないこと', () => {
    expect(formatPath('src/components\\Header.tsx', 'auto' as DelimiterMode)).toBe('src/components\\Header.tsx');
  });
});

describe('determineStatus', () => {
  it('競合（C）の各パターンを正しく識別できること', () => {
    expect(determineStatus('CC', 'CC /path')).toBe('C-Both');
    expect(determineStatus('C ', 'C  /path')).toBe('C-Content');
    expect(determineStatus(' C', ' C /path')).toBe('C-Prop');
    expect(determineStatus('   C', '   C /path')).toBe('C-Tree');
  });

  it('内容競合＋属性マージ（CG）の場合に C-Content と判定されること', () => {
    expect(determineStatus('CG', 'CG /path')).toBe('C-Content');
  });

  it('> 記号（マージ等）の場合に G と判定されること', () => {
    expect(determineStatus(' > ', ' >  /path')).toBe('G');
  });

  it('空文字やスペースのみの rawStatus の場合は None が返ること', () => {
    expect(determineStatus('', 'some line')).toBe('None');
    expect(determineStatus('   ', 'some line')).toBe('None');
  });
});

describe('parseLog', () => {
  it('SVNの各ステータス（A, M, D, ?）を正しくパースできること', () => {
    const rawLog = `
M       /trunk/src/App.tsx
A       /trunk/src/components/Header.tsx
D       /trunk/docs/old.txt
?       /trunk/temp.log
    `.trim();

    const result = parseLog(rawLog);

    expect(result).toHaveLength(4);
    expect(result[0]).toEqual(expect.objectContaining({ status: 'M', path: '/trunk/src/App.tsx' }));
    expect(result[1]).toEqual(expect.objectContaining({ status: 'A', path: '/trunk/src/components/Header.tsx' }));
    expect(result[2]).toEqual(expect.objectContaining({ status: 'D', path: '/trunk/docs/old.txt' }));
    expect(result[3]).toEqual(expect.objectContaining({ status: '?', path: '/trunk/temp.log' }));
  });

  it('履歴付き追加（A +）などの複合ステータス行を正しくパースできること', () => {
    const rawLog = 'A  +    /trunk/src/copied.ts';
    const result = parseLog(rawLog);

    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('A');
    expect(result[0].path).toBe('/trunk/src/copied.ts');
  });

  it('日本語やスペースを含むファイルパスを正しく保持できること', () => {
    const rawLog = 'M       /trunk/docs/仕様書 2026.pdf';
    const result = parseLog(rawLog);

    expect(result).toHaveLength(1);
    expect(result[0].path).toBe('/trunk/docs/仕様書 2026.pdf');
  });

  it('空行が含まれていても無視されてエラーにならないこと', () => {
    const rawLog = `

M       /trunk/src/index.ts

    `;
    const result = parseLog(rawLog);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(expect.objectContaining({ status: 'M', path: '/trunk/src/index.ts' }));
  });

  it('[ や Updating、--- で始まるSVNメタ行がスキップされること', () => {
    const rawLog = `
Updating '.':
[At revision 1234]
--- Summary of changes ---
M       /trunk/src/App.tsx
    `.trim();

    const result = parseLog(rawLog);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(expect.objectContaining({
      status: 'M',
      path: '/trunk/src/App.tsx'
    }));
  });

  it('正規表現にマッチしない行は status: "None" としてパースされること', () => {
    const rawLog = 'This is a random log note';
    const result = parseLog(rawLog);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(expect.objectContaining({
      status: 'None',
      path: 'This is a random log note'
    }));
  });

  it('Windows改行コード（CRLF: \\r\\n）のログでもパス末尾に \\r が残らないこと', () => {
    const crlfLog = "M       /trunk/src/App.tsx\r\nA       /trunk/src/main.tsx\r\n";
    const result = parseLog(crlfLog);

    expect(result[0].path).toBe('/trunk/src/App.tsx');
    expect(result[1].path).toBe('/trunk/src/main.tsx');
  });

  it('プロパティ競合（C-Prop）やツリー競合（C-Tree）のログ行を正しくパースできること', () => {
    const rawLog = [
      ' C      /trunk/src/App.tsx',
      '   C    /trunk/src/old_dir'
    ].join('\n');

    const result = parseLog(rawLog);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(expect.objectContaining({
      status: 'C-Prop',
      path: '/trunk/src/App.tsx'
    }));
    expect(result[1]).toEqual(expect.objectContaining({
      status: 'C-Tree',
      path: '/trunk/src/old_dir'
    }));
  });
});

describe('getStatusLabel', () => {
  it('定義済みのステータスラベルを正しく取得できること', () => {
    expect(getStatusLabel('M')).toBe('M:変更');
  });

  it('未定義ラベルの場合は渡された文字列をそのまま返すこと', () => {
    expect(getStatusLabel('UNKNOWN_STATUS')).toBe('UNKNOWN_STATUS');
  });
});

describe('getStatusSortPrio', () => {
  it('定義済みのステータス優先度を正しく取得できること', () => {
    expect(getStatusSortPrio('C-Content')).toBe(10);
    expect(getStatusSortPrio('M')).toBe(40);
  });

  it('未定義のステータスの場合はデフォルト優先度 999 を返すこと', () => {
    expect(getStatusSortPrio('UNKNOWN_STATUS')).toBe(999);
  });
});

describe('parseSearchTerms', () => {
  it.each([
    {
      title: '通常の複数キーワード（AND検索）',
      query: 'App Header',
      expectedIncludes: [
        expect.objectContaining({ text: 'app', anchor: false }),
        expect.objectContaining({ text: 'header', anchor: false }),
      ],
      expectedExcludes: [],
    },
    {
      title: '除外（-）と先頭一致（^）の組み合わせ',
      query: 'src -test ^components',
      expectedIncludes: [
        expect.objectContaining({ text: 'src', anchor: false }),
        expect.objectContaining({ text: 'components', anchor: true }),
      ],
      expectedExcludes: [
        expect.objectContaining({ text: 'test', anchor: false }),
      ],
    },
    {
      title: '先頭一致かつ除外（-^）',
      query: '-^dist',
      expectedIncludes: [],
      expectedExcludes: [
        expect.objectContaining({ text: 'dist', anchor: true }),
      ],
    },
  ])('$title: "$query"', ({ query, expectedIncludes, expectedExcludes }) => {
    const result = parseSearchTerms(query);
    expect(result.includes).toEqual(expectedIncludes);
    expect(result.excludes).toEqual(expectedExcludes);
  });

  it('空文字や空白のみの入力時は空の検索条件が返ること', () => {
    const result = parseSearchTerms('   ');
    expect(result.includes).toHaveLength(0);
    expect(result.excludes).toHaveLength(0);
  });

  it('記号のみの入力（"-" や "^"）でもクラッシュせず安全に処理されること', () => {
    expect(() => parseSearchTerms('- ^   ')).not.toThrow();
  });

  it('大文字で指定された接頭辞付きキーワードも小文字化されること', () => {
    const result = parseSearchTerms('^SRC -TEST');
    
    expect(result.includes[0].text).toBe('src');
    expect(result.excludes[0].text).toBe('test');
  });
});

describe('truncatePathByDepth', () => {
  const samplePath = 'src/components/common/Button.tsx';

  it('指定した階層数でディレクトリパスが正しく切り詰められること', () => {
    expect(truncatePathByDepth(samplePath, 1, 'unix')).toBe('src/');
    expect(truncatePathByDepth(samplePath, 2, 'unix')).toBe('src/components/');
    expect(truncatePathByDepth(samplePath, 3, 'unix')).toBe('src/components/common/');
  });

  it('階層数がパスの深さを超えている場合はフルディレクトリパスを返すこと', () => {
    expect(truncatePathByDepth(samplePath, 10, 'unix')).toBe('src/components/common/');
  });

  it('ディレクトリが存在しないルート直下ファイルは (Root) を返すこと', () => {
    expect(truncatePathByDepth('README.md', 1, 'unix')).toBe('(Root)');
  });

  it('空文字列が渡された場合は (Root) を返すこと', () => {
    expect(truncatePathByDepth('', 1, 'unix')).toBe('(Root)');
  });

  it('depth が 0 以下または未指定の場合はフルディレクトリパスまたは (Root) を返すこと', () => {
    expect(truncatePathByDepth(samplePath, 0, 'unix')).toBe('src/components/common/');
  });

  it('win モードで Windows 形式のパス（\\）を正しく階層切り出しできること', () => {
    const winPath = 'src\\components\\common\\Button.tsx';
    expect(truncatePathByDepth(winPath, 2, 'win')).toBe('src\\components\\');
  });
});

describe('escapeRegExp', () => {
  it('正規表現の特殊文字が安全にエスケープされること', () => {
    expect(escapeRegExp('src/components/*.ts')).toBe('src/components/\\*\\.ts');
    expect(escapeRegExp('path[0].(val)?')).toBe('path\\[0\\]\\.\\(val\\)\\?');
  });
});