import { expect, test } from '@playwright/test';
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
