import { expect, test } from '@playwright/test';

test('Japanese shell, Vintage/Pumpkin theme and responsive layout', async ({ page }) => {
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	await page.goto('/');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('川のそばで、ひと息。');
	await expect(
		page.getByText('この画面では予約・空き状況の確認・決済はできません。')
	).toBeVisible();
	await expect(page.locator('.app-shell')).toHaveCSS('background-color', 'rgb(230, 226, 218)');
	await page.getByRole('button', { name: 'ダークテーマに切り替え' }).click();
	await expect(page.locator('.app-shell')).toHaveCSS('background-color', 'rgb(41, 46, 51)');
	await page.getByRole('button', { name: 'ライトテーマに切り替え' }).click();
	await expect(page.locator('.app-shell')).toHaveCSS('background-color', 'rgb(230, 226, 218)');
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
		true
	);
	expect(errors).toEqual([]);
});

test('local preview validates without sending or saving a request', async ({ page }) => {
	const requests: string[] = [];
	page.on('request', (request) => {
		if (request.method() !== 'GET') requests.push(request.url());
	});
	await page.goto('/');
	const guests = page.getByLabel('プレビュー人数');
	await guests.fill('0');
	await page.getByRole('button', { name: 'イメージする' }).click();
	await expect(page.getByText('1人以上で入力してください。')).toBeVisible();
	await guests.fill('3');
	await page.getByRole('button', { name: 'イメージする' }).click();
	await expect(page.getByText('3人で過ごす時間をイメージしました。')).toBeVisible();
	await expect(guests).toHaveValue('3');
	expect(requests).toEqual([]);
	await page.reload();
	await expect(guests).toHaveValue('2');
	await expect(page.getByText('3人で過ごす時間をイメージしました。')).not.toBeVisible();
});

test('without JavaScript the preview cannot submit input', async ({ browser }) => {
	const context = await browser.newContext({ javaScriptEnabled: false });
	const page = await context.newPage();
	await page.goto('http://127.0.0.1:4173/');
	await expect(page.getByLabel('プレビュー人数')).toBeDisabled();
	await expect(page.getByRole('button', { name: 'イメージする' })).toBeDisabled();
	await context.close();
});
