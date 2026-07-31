import React from 'react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>ヘルプ</h2>
          <span className="close-btn" onClick={onClose}>&times;</span>
        </div>
        <div className="modal-body">
          <div className="help-section">
            <h3>基本的な使い方</h3>
            <ul>
              <li>SVNコマンドの出力ログをファイルに書き出して"ログをドロップまたはクリック"に入力することで、その内容が見やすく表示されます</li>
              <li>ログを入力したすぐ右にSVNステータスごとにフィルタ出来るボタンが現れるので必要なステータスだけに容易に絞り込めます</li>
              <li>🔍部分で文字列によるフィルタも可能です。詳細な使い方は後述しています</li>
              <li>"ディレクトリ集約"ボタンを押すことでディレクトリ単位に表示をまとめることができます。階層を指定すれば好きな深度でまとめられます</li>
              <li>"表示をコピー"ボタンを押すことで表示されている情報をクリップボードに取り出すことができます</li>
            </ul>
            <h3>🔍 検索・フィルタ構文</h3>
            <table className="help-table">
              <thead>
                <tr>
                  <th style={{ width: '150px' }}>パターン</th>
                  <th>説明</th>
                  <th>例</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><code>text</code></td>
                  <td>"text" を<strong>含む</strong></td>
                  <td><code>Source/UI</code></td>
                </tr>
                <tr>
                  <td><code>-text</code></td>
                  <td>"text" を<strong>含まない</strong> (除外)</td>
                  <td><code>-Test</code></td>
                </tr>
                <tr>
                  <td><code>^text</code></td>
                  <td>"text" で<strong>始まる</strong> (先頭一致)</td>
                  <td><code>^Tools/</code></td>
                </tr>
                <tr>
                  <td><code>-^text</code></td>
                  <td>"text" で<strong>始まらない</strong> (先頭除外)</td>
                  <td><code>-^Asset/</code></td>
                </tr>
              </tbody>
            </table>
            <p style={{ marginTop: '1rem', color: '#aaa', fontSize: '0.9rem' }}>
              ※ URLパラメータ <code>?q=キーワード</code> または <code>?filter=キーワード</code> を指定して開くと、自動的にフィルタリングされます。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};