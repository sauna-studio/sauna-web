# sauna-web
Sauna Studio web


## Scope

利用者向けSvelteKit / TypeScript Web。予約・決済・チャットのUIを提供する。

## Architecture

Sauna APIを正本とし、WebAuthn / Passkeyでログインする。最新安定版ブラウザを対象にVintage・Pumpkinを参照する。

## Verification

`bun install --frozen-lockfile`、`bun run check`、`bun run lint`、`bun run test:unit`、`bun run build`、`bun run test:e2e`を実行する。

CIはRepository policyに加え、Bunの型検査・lint・単体テスト・build・公開画面のPlaywright検証を実行します。実API/DBを使うPasskeyの`bun run test:auth`はローカル専用の別検証です。

[AGENTS.md](AGENTS.md) と [CONTRIBUTING.md](CONTRIBUTING.md) に従い、Issueの依存関係を満たしてから独立Review Agentを並行起動して実装します。共通規則適用元: [sauna-studio/.github@075c6695309d](https://github.com/sauna-studio/.github/tree/075c6695309d28baad2dc1391d7d3821b81142cc)。


## ローカルWeb基盤（2026-11-01）

SvelteKit / Svelte 5 Runes / TypeScript / BunでローカルPasskey認証と本人のPasskey管理を実装しています。追加・失効には既存Passkeyでの新しい署名/UV確認が必要です。変更成功時は全セッションからログアウトし、再ログインを要求します。最後の有効なPasskeyは失効できません。予約・決済・施設や社員の業務管理、全Passkey喪失時の回復は未実装です。

実行・検証手順と依存構成は [Local development](docs/LOCAL_DEVELOPMENT.md)、生成UIの出典は [UI provenance](docs/UI_PROVENANCE.md) を参照してください。
