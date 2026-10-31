import { describe, expect, it, vi } from 'vitest';
import { checkLocalService } from './service';

describe('fixed local API client', () => {
	it('uses only the fixed local endpoint', async () => {
		const fetcher = vi.fn(async (request: Request) => {
			expect(request.url).toBe('http://127.0.0.1:8080/health');
			return Response.json({ status: 'ok' });
		});
		expect(await checkLocalService(fetcher)).toBe(true);
	});
	it('does not expose remote errors', async () => {
		const fetcher = vi.fn(async () => {
			throw new Error('private diagnostic');
		});
		expect(await checkLocalService(fetcher)).toBe(false);
	});
	it('handles unavailable service', async () => {
		expect(
			await checkLocalService(vi.fn(async () => Response.json({ status: 503 }, { status: 503 })))
		).toBe(false);
	});
});

describe('public version projection', () => {
	it('reads only release fields', async () => {
		const fetcher = vi.fn(async () =>
			Response.json({ apiVersion: '1.0.0', version: '0.1.0', internal: 'not returned' })
		);
		const { readLocalVersion } = await import('./service');
		expect(await readLocalVersion(fetcher)).toEqual({ apiVersion: '1.0.0', version: '0.1.0' });
	});
	it.each([['1.0.0'], null, 100, { value: '1.0.0' }])(
		'rejects non-string release fields: %j',
		async (value) => {
			const { readLocalVersion } = await import('./service');
			for (const field of ['apiVersion', 'version']) {
				expect(
					await readLocalVersion(
						vi.fn(async () =>
							Response.json({ apiVersion: '1.0.0', version: '0.1.0', [field]: value })
						)
					)
				).toBeNull();
			}
		}
	);
	it('rejects malformed release data', async () => {
		const { readLocalVersion } = await import('./service');
		expect(
			await readLocalVersion(
				vi.fn(async () => Response.json({ apiVersion: '1.0.0', version: '0.1.0\n' }))
			)
		).toBeNull();
	});
});
