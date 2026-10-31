# ローカル検証記録 — 2026-11-01

Bun 1.4.4で実行。GitHub ActionsではなくローカルmacOSの検証。

- `bun install --frozen-lockfile`: 成功。lockfile変更なし。
- `bun run check`: 成功、0 errors / 0 warnings。
- `bun run lint`: Prettier / ESLintとも成功。
- `bun run test:unit`: 2 files / 19 tests成功。Bun runtime、人数整数1–12、不正入力、固定API接続先、公開レスポンス投影、非string version拒否を検証。
- `bun run test:e2e`: production buildとofficial Bun adapterでの起動を含め、desktop Chromium / モバイル幅Chromiumで計6 tests成功。
- `git diff --check`: 成功。

独立Review Agentによる指摘: `/version`の配列値がRegExpの文字列coercionで受容される問題を修正。両fieldのtypeof guardとarray/null/number/objectの回帰テストを追加した。顧客画面では無効入力直後の再送をSuperformsが処理中に拒否する挙動を確認し、submit-only検証、処理中fieldset disabled、resetForm:falseで対応した。独立reviewで再現した競合の修正後、production E2Eを10反復し60ケースすべて成功した。無効→有効入力と入力維持を回帰検証する。

`bun run api:smoke`も成功。Apple container上で稼働するSauna APIへ固定127.0.0.1:8080経由で実接続し、health status=ok / apiVersion=1.0.0 / version=0.1.0を確認した。UIはこの診断に依存せず、内部診断を表示しない。Safari MCP未接続、Safari/iOS実機、外部API認可、遠隔CI、デプロイは未検証。

独立Review Agentの最終再検証もcheck / lint / unit19 / production build / E2E6 / api:smoke / diffcheckすべて成功。非string version拒否をBun直接呼出でも再現確認し、顧客の入力巻戻り修正も再確認した。未解決blocking指摘なし。GitHub上のCodexレビューとCIはローカル限定作業のため未依頼・未実行。

Foundation PR preparation: refreshed frozen install, type check (0 errors/warnings), lint, unit 19 and production build successfully. Added read-only, SHA-pinned Bun CI for these checks and the existing public-shell Playwright tests. PR creation is now authorized by the latest user instruction; remote CI results are pending until they actually run.
