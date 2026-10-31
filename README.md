# sauna-web
Sauna Studio web


## Scope

利用者向けSvelteKit / TypeScript Web。予約・決済・チャットのUIを提供する。

## Architecture

Sauna APIを正本とし、WebAuthn / Passkeyでログインする。最新安定版ブラウザを対象にVintage・Pumpkinを参照する。

## Verification

実装後はnpm ci / npm run check / npm test -- --run / npm run buildとPlaywright検証を実行する。

初期PRは開発基盤のみを追加します。CIはRepository policy検査を実行し、業務機能の実装や動作検証はまだ含みません。

[AGENTS.md](AGENTS.md) と [CONTRIBUTING.md](CONTRIBUTING.md) に従い、Issueの依存関係を満たしてから独立Review Agentを並行起動して実装します。共通規則適用元: [sauna-studio/.github@075c6695309d](https://github.com/sauna-studio/.github/tree/075c6695309d28baad2dc1391d7d3821b81142cc)。
