# ローカル開発

## スタック

SvelteKit3.1.1 / Svelte5.57.3 Runes / strict TypeScript6.0.3 / Bun1.4.4 / Vite8.3.5 / TailwindCSS4.3.3、shadcn-svelte1.7.2生成UI、Lucide @lucide/svelte1.66.0、Superforms3.1.0 + Zod4.6.7、openapi-fetch0.17.0、openapi-typescript7.13.0、Vitest5.0.5、Playwright1.64.1、ESLint10/Prettier3。正確な依存版はpackage.jsonとbun.lockを参照。

TypeScript7はKit3のpeer範囲外で実際にsync失敗を確認したため、対応範囲の最新6系を採用した。公式 @sveltejs/adapter-bun1.0.0を使用し、Bunでbuildとproduction runtimeを実行する。Bunへ強制する--bunフラグを各scriptに明記する。

## 実行

BunがPATHにない場合、このワークスペース用のbinaryを指定する（shell profileの変更は不要）。

```sh
export PATH="$PWD/../.tools/bun:$PATH"
bun install --frozen-lockfile
bun run check
bun run lint
bun run test:unit
bun run build
bun run start
```

起動先は http://127.0.0.1:5173 。devはbun run dev、productionはbun run startを使用する。公開ポートはloopbackに限定する。

```sh
bun --bun playwright install chromium
bun run test:e2e
bun run api:generate
# APIがlocalhost:8080で起動しているときだけ実接続検証
bun run api:smoke
```

API clientはserver-onlyの固定localhost health/versionに限る。ページ表示の必須依存にはしておらず、API未稼働でもshell/previewは動く。api:smokeの未実行時は実API接続済みと記録しない。OpenAPI snapshotの更新元は隣のsauna-api/Sources/SaunaAPIContract/openapi.yamlであり、型生成後差分を確認する。

## 実装範囲と制約

画面のVintage/Pumpkin切替、responsive shell、readonly表示のみ。利用者画面にはSuperforms/Zodによる非PII人数previewを設け、SPAでPOSTせず、JSなしでは入力をdisabledとする。管理者shellは認証・施設権限を実装せず、ログインボタンをdisabledにし、管理ルートを作らない。予約や決済ができるとは表示しない。

ローカル作業のみ、push/PR/遠隔CI・本番デプロイ・外部API認可は未実施。キーや秘密鍵が必要になれば停止して確認する。Safari MCPは未接続でSafari/iOS実機は未検証。PlaywrightのmobileはChromiumのモバイル幅エミュレーション。
