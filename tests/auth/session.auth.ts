import { expect, test } from '@playwright/test';
// Never enable trace/video/HAR/screenshots/storageState for this suite.
test('resident UV registration requires sign-in, then session reload/logout/revocation', async ({
	page,
	context
}) => {
	const statuses: string[] = [];
	page.on('response', (r) => {
		const path = new URL(r.url()).pathname;
		if (path.startsWith('/auth/api/')) statuses.push(path + ':' + r.status());
	});
	const cdp = await context.newCDPSession(page);
	await cdp.send('WebAuthn.enable', { enableUI: false });
	const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', {
		options: {
			protocol: 'ctap2',
			transport: 'internal',
			hasResidentKey: true,
			hasUserVerification: true,
			isUserVerified: true,
			automaticPresenceSimulation: true
		}
	});
	try {
		await page.goto('/auth');
		await expect(page.getByTestId('session-status')).toHaveText('ログインしていません。');
		await page.getByRole('button', { name: 'Passkeyを登録', exact: true }).click();
		await expect(page.getByRole('status')).toHaveText(
			'Passkeyを登録しました。続けてログインしてください。'
		);
		await expect(page.getByTestId('session-status')).toHaveText('ログインしていません。');
		await page.getByRole('button', { name: 'Passkeyでログイン', exact: true }).click();
		await expect(page.getByTestId('session-status')).toHaveText('ログインしています。');
		// Return only Boolean properties; never serialize cookie/token values.
		expect(
			await context
				.cookies()
				.then((c) =>
					c.some(
						(x) =>
							x.name === '__Host-sauna-customer-session' &&
							x.httpOnly &&
							x.secure &&
							x.sameSite === 'Strict'
					)
				)
		).toBe(true);
		expect(await page.evaluate(() => !document.cookie.includes('__Host-sauna-customer-'))).toBe(
			true
		);
		await page.reload();
		await expect(page.getByTestId('session-status')).toHaveText('ログインしています。');
		await page.getByRole('button', { name: 'ログアウト', exact: true }).click();
		await expect(page.getByTestId('session-status')).toHaveText('ログインしていません。');
		await page.getByRole('button', { name: 'Passkeyでログイン', exact: true }).click();
		await expect(page.getByTestId('session-status')).toHaveText('ログインしています。');
		await page
			.getByRole('button', { name: 'すべてのセッションからログアウト', exact: true })
			.click();
		await expect(page.getByTestId('session-status')).toHaveText('ログインしていません。');
		await page.reload();
		await expect(page.getByTestId('session-status')).toHaveText('ログインしていません。');
		expect(statuses.includes('/auth/api/auth/sessions/revoke-all:204')).toBe(true);
	} finally {
		await cdp.send('WebAuthn.removeVirtualAuthenticator', { authenticatorId });
		await cdp.send('WebAuthn.disable');
		await cdp.detach();
	}
});
