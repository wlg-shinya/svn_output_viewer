// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import App from './App';

describe('App Component (Integration Tests)', () => {
  // --- ブラウザ API のモック設定 ---
  const mockClipboard = {
    writeText: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // 1. fetch のデフォルトモック（自動ロード失敗をシミュレートし、テストへの影響を防ぐ）
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('File not found')));

    // 2. クリップボード API のモック
    Object.defineProperty(navigator, 'clipboard', {
      value: mockClipboard,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(window, 'isSecureContext', {
      value: true,
      writable: true,
      configurable: true,
    });

    // 3. URL クエリパラメータの初期化
    window.history.pushState({}, '', '/');
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  // --- ヘルパー関数: テスト用ダミーファイルのロード ---
  const loadDummyLogFile = async (inputElement: HTMLElement) => {
    const dummyLogContent = `
M       /trunk/src/App.tsx
A       /trunk/src/components/Header.tsx
C       /trunk/src/components/Footer.tsx
D       /trunk/docs/old.txt
    `.trim();

    const file = new File([dummyLogContent], 'test.log', { type: 'text/plain' });
    fireEvent.change(inputElement, { target: { files: [file] } });

    // FileReader の非同期読み込みを待機（正規表現マッチャーに変更）
    await screen.findByText(/src\/App\.tsx/);
  };

  it('初期化時: URLパラメータ ?q=... が存在する場合、検索ボックスに設定されること', () => {
    window.history.pushState({}, '', '/?q=Header');

    render(<App />);

    const searchInput = screen.getByPlaceholderText(/🔍/) as HTMLInputElement;
    expect(searchInput.value).toBe('Header');
  });

  it('ファイル読み込み: ログファイルをドロップ/選択するとデータがパースされ一覧表示されること', async () => {
    render(<App />);

    // ドロップゾーン内の隠し file input を取得
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).not.toBeNull();

    await loadDummyLogFile(fileInput);

    // ログが正しく表示されているか確認
    expect(screen.getByText(/src\/App\.tsx/)).toBeInTheDocument();
    expect(screen.getByText(/src\/components\/Header\.tsx/)).toBeInTheDocument();
    expect(screen.getByText(/src\/components\/Footer\.tsx/)).toBeInTheDocument();

    // フッターのステータス表示を確認
    expect(screen.getByText('検索結果: 4 件のファイル')).toBeInTheDocument();
  });

  it('検索フィルタ: キーワードを入力するとリアルタイムに結果が絞り込まれること', async () => {
    render(<App />);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await loadDummyLogFile(fileInput);

    const searchInput = screen.getByPlaceholderText(/🔍/);
    
    // 'Header' で検索（ハイライト処理により文字列が <mark> 等で分断される）
    fireEvent.change(searchInput, { target: { value: 'Header' } });

    // DOM分断に対応: 子要素を包含する最も内側の要素をテキスト全体で判定して取得
    expect(
      screen.getByText((_, element) => {
        const hasText = element?.textContent?.includes('src/components/Header.tsx') ?? false;
        const childrenDontHaveText = Array.from(element?.children || []).every(
          child => !child.textContent?.includes('src/components/Header.tsx')
        );
        return hasText && childrenDontHaveText;
      })
    ).toBeInTheDocument();

    // App.tsx は絞り込まれて画面から消えていること
    expect(screen.queryByText(/src\/App\.tsx/)).toBeNull();
    
    // 検索結果件数の表示を確認
    expect(screen.getByText('検索結果: 1 件のファイル')).toBeInTheDocument();
  });

  it('ステータスフィルタ: ボタンをクリックすると特定のステータスのみ絞り込まれること', async () => {
    render(<App />);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await loadDummyLogFile(fileInput);

    // 変更 (M) ボタンを取得してクリック
    const mButton = screen.getByRole('button', { name: /M:変更/ });
    fireEvent.click(mButton);

    expect(screen.getByText(/src\/App\.tsx/)).toBeInTheDocument();
    expect(screen.queryByText(/src\/components\/Header\.tsx/)).toBeNull();
    expect(screen.getByText('検索結果: 1 件のファイル')).toBeInTheDocument();
  });

  it('ディレクトリ集約モード: トグルボタンを押すとフォルダ単位で集約されること', async () => {
    render(<App />);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await loadDummyLogFile(fileInput);

    const dirModeBtn = screen.getByTitle('ディレクトリ集約モードを切り替え');
    fireEvent.click(dirModeBtn);

    // ディレクトリ単位で表示されているか確認
    expect(screen.getByText(/src\/$/)).toBeInTheDocument();
    expect(screen.getByText(/src\/components\//)).toBeInTheDocument();
    expect(screen.getByText(/docs\//)).toBeInTheDocument();

    // フッター等の件数表示を確認
    expect(screen.getByText(/件のディレクトリ/)).toBeInTheDocument();
  });

  it('コピー機能: 表示中のテキストがクリップボードにコピーされること', async () => {
    render(<App />);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await loadDummyLogFile(fileInput);

    const copyBtn = screen.getByRole('button', { name: /表示をコピー/ });
    fireEvent.click(copyBtn);

    await waitFor(() => {
      expect(mockClipboard.writeText).toHaveBeenCalledTimes(1);
      // コピーされたテキストの中にファイルパスが含まれていること
      expect(mockClipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining('src/App.tsx')
      );
    });

    // ボタンのテキストが一時的に変更されること
    expect(screen.getByRole('button', { name: /4 件をコピーしました！/ })).toBeInTheDocument();
  });

  it('ヘルプモーダル: ヘルプボタンでモーダルが開き、閉じるボタンで閉じること', () => {
    render(<App />);

    // title 属性でピンポイント取得
    const helpBtn = screen.getByTitle('ヘルプを表示');
    fireEvent.click(helpBtn);

    expect(screen.getByRole('heading', { name: 'ヘルプ' })).toBeInTheDocument();
    expect(screen.getByText('🔍 検索・フィルタ構文')).toBeInTheDocument();

    // × ボタンを押して閉じる
    const closeBtn = screen.getByText('×');
    fireEvent.click(closeBtn);

    expect(screen.queryByRole('heading', { name: 'ヘルプ' })).toBeNull();
  });
});