# UIの出典

- scaffold: Svelte公式 sv 1.2.0 create、minimal/TypeScript、prettier/eslint/vitest/playwright/tailwindcss/公式Bun adapter add-ons。
- shadcn-svelte: 公式CLI 1.7.2 init (Vega/Lucide) と add button input label card badge で生成。生成後に色トークン、フォント、整形、汎用Buttonのnavigation lint例外を調整。MIT原文はlicenses/shadcn-svelte-MIT.txt。
- CLIはBunに公式サポート外の警告を出した。Bunで生成自体は成功したが、警告を未表示・公式Bun対応とは記録しない。実際のアプリbuild/check/browser検証で生成物を確認する。
- Vintage: background #E6E2DA、accent #CC4400、secondary #E0DACE。Pumpkin: background #292E33、accent #FF6619、secondary #1F2226。参照 https://github.com/zunda-pixel/tweetbot/blob/main/TweetbotKit/Sources/TweetbotUI/Components/ThemePalette.swift 。画像・ロゴ・実施設データはコピーしていない。
- Lucide公式の現行Svelte packageは @lucide/svelte。deprecatedなlucide-svelte packageを採用しない。
- システムフォントを使用し、外部フォントの実行時リクエストは行わない。
