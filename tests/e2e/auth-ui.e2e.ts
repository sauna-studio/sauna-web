import { expect, test, type Page } from '@playwright/test';
// Isolated UI states with synthetic public fixtures, no authenticator or live API.
const sessionPath = '**/auth/api/auth/session';
test('unsupported browser explains required support without a fallback login', async ({ page }) => {
	await page.addInitScript(() =>
		Object.defineProperty(window, 'PublicKeyCredential', { value: undefined, configurable: true })
	);
	await page.route(sessionPath, (route) => route.fulfill({ status: 401 }));
	await page.goto('/auth');
	await expect(page.getByText('最新のPasskey対応ブラウザーをご利用ください。')).toBeVisible();
	await expect(page.getByRole('button', { name: 'Passkeyでログイン', exact: true })).toBeDisabled();
});
test('cancelled credential request resets the login control', async ({ page }) => {
	await page.addInitScript(() =>
		Object.defineProperty(navigator.credentials, 'get', {
			value: () => Promise.reject(new DOMException('cancelled', 'NotAllowedError')),
			configurable: true
		})
	);
	await page.route(sessionPath, (route) => route.fulfill({ status: 401 }));
	await page.route('**/auth/api/auth/passkeys/authentication/options', (route) =>
		route.fulfill({
			json: {
				challengeID: '00000000-0000-4000-8000-000000000001',
				publicKey: { challenge: 'AQ', rpId: 'localhost', userVerification: 'required' }
			}
		})
	);
	await page.goto('/auth');
	await page.getByRole('button', { name: 'Passkeyでログイン', exact: true }).click();
	await expect(page.getByRole('status')).toHaveText(
		'認証を完了できませんでした。キャンセルした場合は再試行できます。'
	);
	await expect(page.getByRole('button', { name: 'Passkeyでログイン', exact: true })).toBeEnabled();
});
test('expired session clears memory and prompts sign-in', async ({ page }) => {
	await page.route(sessionPath, (route) =>
		route.fulfill({
			json: {
				userID: '00000000-0000-4000-8000-000000000001',
				expiresAtUnixSeconds: 1,
				csrfToken: 'a'.repeat(43)
			}
		})
	);
	await page.goto('/auth');
	await expect(page.getByRole('status')).toHaveText(
		'セッションの有効期限が切れました。再度ログインしてください。'
	);
	await expect(page.getByTestId('session-status')).toHaveText('ログインしていません。');
});

const accountSession = {
	userID: '00000000-0000-4000-8000-000000000001',
	expiresAtUnixSeconds: 2000000000,
	csrfToken: 'a'.repeat(43)
};
const managementOptions = {
	challengeID: '00000000-0000-4000-8000-000000000002',
	publicKey: { challenge: 'AQ', rpId: 'localhost', userVerification: 'required' }
};
async function managedAccount(page: Page, count: number) {
	await page.route(sessionPath, (route) => route.fulfill({ json: accountSession }));
	await page.route('**/auth/api/auth/passkeys', (route) =>
		route.fulfill({
			json: {
				credentials: Array.from({ length: count }, (_, index) => ({
					credentialID: index === 0 ? 'AQ' : 'Ag',
					createdAtUnixSeconds: 100,
					isCurrentSessionCredential: index === 0
				}))
			}
		})
	);
}
test('last credential is protected while a spare can be added', async ({ page }) => {
	await managedAccount(page, 1);
	await page.goto('/auth');
	await expect(page.getByTestId('managed-passkeys').getByRole('listitem')).toHaveCount(1);
	await expect(
		page.getByRole('button', { name: 'Passkey 1を失効する', exact: true })
	).toBeDisabled();
	await expect(
		page.getByRole('button', { name: '既存のPasskeyで確認して追加', exact: true })
	).toBeEnabled();
	await expect(page.getByText('一覧は端末数ではありません。', { exact: false })).toBeVisible();
});
test('a selected revocation requires confirmation before asking for another passkey', async ({
	page
}) => {
	await managedAccount(page, 2);
	await page.addInitScript(() =>
		Object.defineProperty(navigator.credentials, 'get', {
			value: () => Promise.reject(new DOMException('cancelled', 'NotAllowedError')),
			configurable: true
		})
	);
	let requests = 0;
	await page.route('**/auth/api/auth/passkeys/revocation/options', (route) => {
		requests += 1;
		return route.fulfill({ json: managementOptions });
	});
	await page.goto('/auth');
	await page.getByRole('button', { name: 'Passkey 1を失効する', exact: true }).click();
	await expect(
		page.getByText('Passkey 1を失効します。別の登録済みPasskeyで確認してください。')
	).toBeVisible();
	expect(requests).toBe(0);
	await page.getByRole('button', { name: '別のPasskeyで確認して失効', exact: true }).click();
	await expect(page.getByTestId('credential-message')).toContainText(
		'最初から確認し直してください。'
	);
	expect(requests).toBe(1);
});
test('addition waits for a separate creation action then requires login again', async ({
	page
}) => {
	await managedAccount(page, 1);
	await page.addInitScript(() => {
		class SyntheticCredential {
			static parseCreationOptionsFromJSON(value: unknown) {
				return value;
			}
			static parseRequestOptionsFromJSON(value: unknown) {
				return value;
			}
			toJSON() {
				return { id: 'public-ui-fixture', type: 'public-key' };
			}
		}
		Object.defineProperty(window, 'PublicKeyCredential', {
			value: SyntheticCredential,
			configurable: true
		});
		Object.defineProperty(navigator.credentials, 'get', {
			value: async () => new SyntheticCredential(),
			configurable: true
		});
		Object.defineProperty(navigator.credentials, 'create', {
			value: async () => new SyntheticCredential(),
			configurable: true
		});
	});
	await page.route('**/auth/api/auth/passkeys/addition/authorization/options', (route) =>
		route.fulfill({ json: managementOptions })
	);
	await page.route('**/auth/api/auth/passkeys/addition/authorization/finish', (route) =>
		route.fulfill({ json: managementOptions })
	);
	let completed = 0;
	await page.route('**/auth/api/auth/passkeys/addition/finish', (route) => {
		completed += 1;
		return route.fulfill({ status: 204 });
	});
	await page.goto('/auth');
	await page.getByRole('button', { name: '既存のPasskeyで確認して追加', exact: true }).click();
	await expect(
		page.getByText('確認できました。新しく使うPasskeyを登録してください。')
	).toBeVisible();
	expect(completed).toBe(0);
	await page.getByRole('button', { name: '新しいPasskeyを登録', exact: true }).click();
	await expect(page.getByRole('status')).toHaveText(
		'Passkeyを変更しました。すべてのセッションからログアウトしました。再度ログインしてください。'
	);
	await expect(page.getByTestId('session-status')).toHaveText('ログインしていません。');
	expect(completed).toBe(1);
});

test('leaving credential management aborts the pending prompt without submitting a proof', async ({
	page
}) => {
	await managedAccount(page, 1);
	await page.addInitScript(() =>
		Object.defineProperty(navigator.credentials, 'get', {
			value: (options: CredentialRequestOptions) =>
				new Promise((_, reject) => {
					document.documentElement.dataset.managementPromptStarted = 'true';
					options.signal?.addEventListener(
						'abort',
						() => {
							document.documentElement.dataset.managementPromptAborted = 'true';
							reject(new DOMException('aborted', 'AbortError'));
						},
						{ once: true }
					);
				}),
			configurable: true
		})
	);
	await page.route('**/auth/api/auth/passkeys/addition/authorization/options', (route) =>
		route.fulfill({ json: managementOptions })
	);
	let proofs = 0;
	await page.route('**/auth/api/auth/passkeys/addition/authorization/finish', (route) => {
		proofs += 1;
		return route.fulfill({ json: managementOptions });
	});
	await page.goto('/auth');
	await page.getByRole('button', { name: '既存のPasskeyで確認して追加', exact: true }).click();
	await page.waitForFunction(
		() => document.documentElement.dataset.managementPromptStarted === 'true'
	);
	await page.getByRole('link', { name: 'ホームに戻る', exact: true }).click();
	await expect(page).toHaveURL('/');
	expect(
		await page.evaluate(() => document.documentElement.dataset.managementPromptAborted === 'true')
	).toBe(true);
	expect(proofs).toBe(0);
});

test('a changed session clears cached account state after a failed management operation', async ({
	page
}) => {
	await managedAccount(page, 1);
	let reads = 0;
	await page.route(sessionPath, (route) =>
		route.fulfill({
			json: {
				...accountSession,
				csrfToken: reads++ === 0 ? accountSession.csrfToken : 'b'.repeat(43)
			}
		})
	);
	await page.addInitScript(() =>
		Object.defineProperty(navigator.credentials, 'get', {
			value: () => Promise.reject(new DOMException('cancelled', 'NotAllowedError')),
			configurable: true
		})
	);
	await page.route('**/auth/api/auth/passkeys/addition/authorization/options', (route) =>
		route.fulfill({ json: managementOptions })
	);
	await page.goto('/auth');
	await page.getByRole('button', { name: '既存のPasskeyで確認して追加', exact: true }).click();
	await expect(page.getByTestId('session-status')).toHaveText('ログインしていません。');
	await expect(page.getByRole('status')).toHaveText(
		'セッションが失効または変更されました。再度ログインしてください。'
	);
	await expect(page.getByTestId('managed-passkeys')).toHaveCount(0);
});
