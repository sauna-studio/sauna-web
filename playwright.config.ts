import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
	testDir: 'tests/e2e',
	testMatch: '**/*.e2e.ts',
	fullyParallel: true,
	use: { baseURL: 'http://127.0.0.1:4173', trace: 'off', video: 'off', screenshot: 'off' },
	projects: [
		{ name: 'chromium', use: { ...devices['Desktop Chrome'] } },
		{ name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } }
	],
	webServer: {
		command: 'bun run build && HOST=127.0.0.1 PORT=4173 ORIGIN=http://127.0.0.1:4173 bun ./build',
		url: 'http://127.0.0.1:4173',
		reuseExistingServer: false,
		timeout: 120000
	}
});
