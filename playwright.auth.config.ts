import { defineConfig, devices } from '@playwright/test';
// Local API/PostgreSQL integration; intentionally separate from credential-free CI.
export default defineConfig({
	testDir: 'tests/auth',
	testMatch: '**/*.auth.ts',
	workers: 1,
	fullyParallel: false,
	timeout: 45000,
	reporter: 'line',
	use: { baseURL: 'http://localhost:5173', trace: 'off', video: 'off', screenshot: 'off' },
	projects: [{ name: 'resident-uv-chromium', use: { ...devices['Desktop Chrome'] } }],
	webServer: {
		command: 'bun run start',
		url: 'http://localhost:5173/auth',
		reuseExistingServer: false,
		timeout: 30000
	}
});
