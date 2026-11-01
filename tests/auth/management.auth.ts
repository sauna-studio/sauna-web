import { expect, test } from '@playwright/test';

// Only virtual authenticators are used; never read/export their credentials or keys.
test('fresh UV adds a spare and another key revokes the old credential without removing the last key', async ({
	page,
	context,
	baseURL
}) => {
	const staff = new URL(baseURL!).port === '5174';
	const cdp = await context.newCDPSession(page);
	await cdp.send('WebAuthn.enable', { enableUI: false });
	const first = await cdp.send('WebAuthn.addVirtualAuthenticator', {
		options: {
			protocol: 'ctap2',
			transport: 'internal',
			hasResidentKey: true,
			hasUserVerification: true,
			isUserVerified: true,
			automaticPresenceSimulation: true
		}
	});
	let second: string | undefined;
	try {
		// Staff cannot enroll anonymously. Bootstrap only through the customer UI.
		await page.goto(staff ? 'http://localhost:5173/auth' : '/auth');
		await expect(page.getByTestId('session-status')).toHaveText('ログインしていません。');
		await page.getByRole('button', { name: 'Passkeyを登録', exact: true }).click();
		await expect(page.getByRole('status')).toHaveText(
			'Passkeyを登録しました。続けてログインしてください。'
		);
		await page.getByRole('button', { name: 'Passkeyでログイン', exact: true }).click();
		await expect(page.getByTestId('session-status')).toHaveText('ログインしています。');
		if (staff) {
			await page.goto('/auth');
			await expect(page.getByRole('button', { name: 'Passkeyを登録', exact: true })).toHaveCount(0);
			await page.getByRole('button', { name: 'Passkeyでログイン', exact: true }).click();
			await expect(page.getByTestId('session-status')).toHaveText('ログインしています。');
		}
		const list = page.getByTestId('managed-passkeys');
		await expect(list.getByRole('listitem')).toHaveCount(1);
		await expect(list.getByRole('button')).toBeDisabled();
		await page.getByRole('button', { name: '既存のPasskeyで確認して追加', exact: true }).click();
		await expect(
			page.getByRole('button', { name: '新しいPasskeyを登録', exact: true })
		).toBeVisible();
		await cdp.send('WebAuthn.setAutomaticPresenceSimulation', {
			authenticatorId: first.authenticatorId,
			enabled: false
		});
		const added = await cdp.send('WebAuthn.addVirtualAuthenticator', {
			options: {
				protocol: 'ctap2',
				transport: 'usb',
				hasResidentKey: true,
				hasUserVerification: true,
				isUserVerified: true,
				automaticPresenceSimulation: true
			}
		});
		second = added.authenticatorId;
		await page.getByRole('button', { name: '新しいPasskeyを登録', exact: true }).click();
		await expect(page.getByRole('status')).toHaveText(
			'Passkeyを変更しました。すべてのセッションからログアウトしました。再度ログインしてください。'
		);
		await expect(page.getByTestId('session-status')).toHaveText('ログインしていません。');
		if (staff) {
			await page.goto('http://localhost:5173/auth');
			await expect(page.getByTestId('session-status')).toHaveText('ログインしていません。');
			await page.goto('/auth');
		}
		await page.getByRole('button', { name: 'Passkeyでログイン', exact: true }).click();
		await expect(list.getByRole('listitem')).toHaveCount(2);
		const old = list.getByRole('listitem').filter({ hasNotText: '今回のログインに使用' });
		await expect(old).toHaveCount(1);
		await old.getByRole('button').click();
		await page.getByRole('button', { name: '別のPasskeyで確認して失効', exact: true }).click();
		await expect(page.getByTestId('session-status')).toHaveText('ログインしていません。');
		await page.getByRole('button', { name: 'Passkeyでログイン', exact: true }).click();
		await expect(list.getByRole('listitem')).toHaveCount(1);
		await expect(list.getByRole('button')).toBeDisabled();
		expect(await page.evaluate(() => !document.cookie.includes('__Host-sauna-'))).toBe(true);
		await page.getByRole('button', { name: 'ログアウト', exact: true }).click();
		await expect(page.getByTestId('session-status')).toHaveText('ログインしていません。');
	} finally {
		if (second) await cdp.send('WebAuthn.removeVirtualAuthenticator', { authenticatorId: second });
		await cdp.send('WebAuthn.removeVirtualAuthenticator', {
			authenticatorId: first.authenticatorId
		});
		await cdp.send('WebAuthn.disable');
		await cdp.detach();
	}
});
