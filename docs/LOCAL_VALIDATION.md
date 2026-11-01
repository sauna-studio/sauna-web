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

## Passkey BFF / UI

`codex/passkey-web` adds `/auth` and a server-only allowlist proxy. The generated OpenAPI client calls `/auth/api/auth/...`; the BFF maps those seven exact paths to fixed `127.0.0.1:8080/auth/...`. Canonical customer origin is `http://localhost:5173`; staff uses `http://localhost:5174`. Origin and Fetch Metadata are checked before forwarding. Only the current profile's flow/session cookies and CSRF header are forwarded. Upstream redirects are rejected, request/response bodies are bounded at 128 KiB, and a shared 10-second deadline covers body reads and the upstream request. Responses are `no-store`; upstream error details are replaced with fixed text.

`bun run check` (0 errors/warnings), `bun run lint`, production build and the six existing home E2E cases passed. Unit coverage includes allowlist/origin/metadata, profile cookie isolation, duplicate cookies, request limits, cancellation and upstream cleanup, safe errors, generated-client requests, native JSON APIs and registration without automatic sign-in. Request credentials are asserted at the native constructor input because Bun 1.4.4 reports `Request.credentials` as `include` even when constructed with `same-origin`; browser behavior is checked separately through the real BFF flow.

Run `bun run build` then `bun run test:auth` only with the local API and PostgreSQL running. The separate canonical-origin Chromium suite uses a CDP resident-key/UV virtual authenticator, removes it in `finally`, and never exports private keys. Trace, video and screenshots are disabled in both configurations; HAR/storage state are not recorded. Staff has no anonymous enrollment or management authorization. Safari/iOS devices and real platform authenticators remain unverified.


Final local auth integration: discovered adapter-bun 1.0 reads build-time `paths.origin`, not adapter-node's runtime `ORIGIN`. Configured the fixed canonical origin in Kit and added a raw Host equality guard, with missing/wrong/duplicate Host regressions. CSRF checks remain enabled. The real Chromium customer resident/UV suite passed three repetitions (registration 204 does not authenticate; assertion required; Secure/HttpOnly/Strict cookie hidden from JS; reload; logout; sign-in again; revoke-all 204 awaited; session then 401). The staff suite passed three repetitions (login UI ready, no enrollment, no Workspace/management authorization claim). Local API uses real PostgreSQL via Apple container. Initial intermittent Chrome GREASE clientData rejection was reproduced using key names only and resolved by the API verifier's W3C-compatible unknown-key handling; no raw values were logged. The source test no longer inspects clientData after diagnosis.

Added synthetic UI regressions for unsupported browsers, cancelled requests, and expiry clearing in-memory session state and prompting sign-in. Existing plus new desktop/mobile Chromium E2E cases total 12 successful per repository. Safari/iOS and real platform authenticators remain unverified. These are local checks; latest GitHub head CI/Codex is still a separate merge gate.


## Fresh-UV credential management (2026-11-01)

The OpenAPI snapshot matches API credential-management source a5f30e2 byte-for-byte; types were regenerated with api:generate. Six exact management routes were added to the existing BFF allowlist without widening Origin/Host/cookie/deadline/body/redirect policies. Users can list their own credentials, authorize addition with an existing signed UV assertion, explicitly create the new credential, and confirm revocation using another key. Successful changes clear in-memory session metadata and require login again. Staff anonymous enrollment and facility/Workspace authorization remain unavailable.

Frozen Bun install, check (0 errors/warnings), lint, unit 69 cases, production build and synthetic desktop/mobile E2E 20 cases passed. The UI regressions cover the last key, selected-target confirmation, separate addition actions, and pending-prompt cancellation on SPA navigation without submitting a proof. A late authenticator result after cancellation is rejected before finish submission. The two-stage options fixture uses a distinct creation nonce. Independent Review also ran the management/BFF unit subset and reviewed cancellation and profile separation; Security reviewed the exact route/cookie/CSRF boundary.

With the updated host API and real PostgreSQL18 on Apple container, the separate real-auth suite passed both cases. Two virtual authenticators (internal and USB) performed actual signatures/UV: existing-key confirmation, second-key creation, all-session logout, second-key login, first-key revocation, second-key login and last-key protection. The staff management test bootstrapped only through the customer UI and confirmed that its change also invalidated the existing customer-profile session. No private keys or credential dumps were extracted, and cookie values were not logged; trace/video/screenshots/HAR/storage state remained disabled. Safari/Apple devices and full-loss recovery remain unverified/unimplemented.

Bun 1.4.4 still reports Request.credentials as include for a same-origin constructor input. The temporary unit-test input probe is tracked at https://github.com/sauna-studio/sauna-web/issues/13; this is separate from the real browser/BFF result and does not relax credentials policy. API workaround trackers #47–#51 remain open. Latest-head GitHub Codex/CI and API PR54 merge are separate gates, not implied by local checks.
