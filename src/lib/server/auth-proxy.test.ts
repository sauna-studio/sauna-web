import { describe, it, expect, vi } from 'vitest';
import { authOrigin, proxyAuthentication } from './auth-proxy.js';
const token = 'a'.repeat(43);
const profile = 'customer';
const own = `__Host-sauna-${profile}-session`;
function request(
	path = 'auth/session',
	method = 'GET',
	headers: Record<string, string> = {},
	body?: string
) {
	const url = new URL(`/auth/api/${path}`, authOrigin);
	return {
		url,
		request: new Request(url, {
			method,
			headers: {
				'Sec-Fetch-Site': 'same-origin',
				...(method === 'GET' ? {} : { Origin: authOrigin }),
				...headers
			},
			body
		})
	};
}
async function run(
	path = 'auth/session',
	method = 'GET',
	headers: Record<string, string> = {},
	body?: string,
	result: Response = Response.json({ ok: true })
) {
	const input = request(path, method, headers, body);
	const fetcher = vi.fn<typeof fetch>().mockResolvedValue(result);
	const response = await proxyAuthentication(input.request, input.url, path, fetcher);
	return { response, fetcher };
}
describe('fixed local auth BFF', () => {
	it.each([
		'auth/session/extra',
		'auth/../session',
		'https://elsewhere.invalid/',
		'health',
		'auth/session?other=1'
	])('denies non allowlisted route %s', async (path) => {
		const { response, fetcher } = await run(path);
		expect(response.status).toBe(404);
		expect(fetcher).not.toHaveBeenCalled();
	});
	it('denies a host selected by the client', async () => {
		const url = new URL('http://elsewhere.invalid/auth/api/auth/session');
		const fetcher = vi.fn<typeof fetch>();
		expect((await proxyAuthentication(new Request(url), url, 'auth/session', fetcher)).status).toBe(
			404
		);
		expect(fetcher).not.toHaveBeenCalled();
	});
	it.each(['http://elsewhere.invalid', 'http://localhost:9999', 'null'])(
		'denies wrong Origin %s',
		async (origin) => {
			const { response, fetcher } = await run('auth/session', 'GET', { Origin: origin });
			expect(response.status).toBe(403);
			expect(fetcher).not.toHaveBeenCalled();
		}
	);
	it('requires Origin on mutation', async () => {
		const input = request('auth/logout', 'POST');
		input.request.headers.delete('Origin');
		const fetcher = vi.fn<typeof fetch>();
		expect(
			(await proxyAuthentication(input.request, input.url, 'auth/logout', fetcher)).status
		).toBe(403);
		expect(fetcher).not.toHaveBeenCalled();
	});
	it.each(['cross-site', 'same-site', ''])('rejects fetch metadata %s', async (site) => {
		const { response } = await run('auth/session', 'GET', { 'Sec-Fetch-Site': site });
		expect(response.status).toBe(403);
	});
	it('filters cookies and headers and fixes target, redirect policy, timeout and GET Origin', async () => {
		const { response, fetcher } = await run('auth/session', 'GET', {
			Cookie: `other=ignored; __Host-sauna-other-session=${token}; ${own}=${token}`,
			Authorization: 'ignored',
			'X-Forwarded-Host': 'ignored'
		});
		const [url, init] = fetcher.mock.calls[0];
		const h = new Headers(init?.headers);
		expect(url).toBe('http://127.0.0.1:8080/auth/session');
		expect(h.get('Origin')).toBe(authOrigin);
		expect(h.get('Cookie') === `${own}=${token}`).toBe(true);
		expect(h.has('Authorization')).toBe(false);
		expect(h.has('X-Forwarded-Host')).toBe(false);
		expect(init?.redirect).toBe('error');
		expect(init?.signal).toBeInstanceOf(AbortSignal);
		expect(response.headers.get('Cache-Control')).toBe('no-store');
	});
	it('rejects duplicate profile cookie', async () => {
		const { response, fetcher } = await run('auth/session', 'GET', {
			Cookie: `${own}=${token}; ${own}=${token}`
		});
		expect(response.status).toBe(400);
		expect(fetcher).not.toHaveBeenCalled();
	});
	it('bounds actual body without relying on content-length', async () => {
		const { response, fetcher } = await run(
			'auth/passkeys/authentication/finish',
			'POST',
			{ 'Content-Type': 'application/json' },
			'a'.repeat(128 * 1024 + 1)
		);
		expect(response.status).toBe(413);
		expect(fetcher).not.toHaveBeenCalled();
	});
	it('bounds declared body', async () => {
		const { response, fetcher } = await run('auth/logout', 'POST', { 'Content-Length': '999999' });
		expect(response.status).toBe(413);
		expect(fetcher).not.toHaveBeenCalled();
	});
	it('forwards bounded JSON and CSRF only', async () => {
		const { response, fetcher } = await run(
			'auth/logout',
			'POST',
			{ 'Content-Type': 'application/json', 'X-Sauna-CSRF': token },
			'{}',
			new Response(null, { status: 204 })
		);
		const h = new Headers(fetcher.mock.calls[0][1]?.headers);
		expect(h.get('X-Sauna-CSRF') === token).toBe(true);
		expect(response.status).toBe(204);
	});
	it('returns only own host-only secure cookies', async () => {
		const headers = new Headers({ 'Content-Type': 'application/json' });
		headers.append('Set-Cookie', `${own}=${token}; Path=/; Secure; HttpOnly; SameSite=Strict`);
		headers.append('Set-Cookie', `other=${token}; Path=/; Secure; HttpOnly; SameSite=Strict`);
		headers.append(
			'Set-Cookie',
			`${own}=${token}; Path=/; Domain=localhost; Secure; HttpOnly; SameSite=Strict`
		);
		const { response } = await run(
			'auth/session',
			'GET',
			{},
			undefined,
			new Response('{}', { headers })
		);
		expect(response.headers.getSetCookie().length).toBe(1);
		expect(response.headers.getSetCookie()[0].startsWith(own + '=')).toBe(true);
	});
	it('does not expose upstream error details', async () => {
		const { response } = await run(
			'auth/session',
			'GET',
			{},
			undefined,
			new Response('internal-value', { status: 503 })
		);
		expect((await response.text()).includes('internal-value')).toBe(false);
		expect(response.status).toBe(503);
	});
	it('closes network failures without error details', async () => {
		const input = request();
		const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new Error('internal-value'));
		const response = await proxyAuthentication(input.request, input.url, 'auth/session', fetcher);
		expect(response.status).toBe(503);
		expect((await response.text()).includes('internal-value')).toBe(false);
	});
});

it('cancels a stalled request body at the shared deadline', async () => {
	const cancelled = vi.fn();
	const controller = new AbortController();
	const body = new ReadableStream<Uint8Array>({ cancel: cancelled });
	const url = new URL('/auth/api/auth/logout', authOrigin);
	const request = new Request(url, {
		method: 'POST',
		headers: {
			Origin: authOrigin,
			'Sec-Fetch-Site': 'same-origin',
			'Content-Type': 'application/json'
		},
		body,
		signal: controller.signal,
		duplex: 'half'
	} as RequestInit);
	const fetcher = vi.fn<typeof fetch>();
	const pending = proxyAuthentication(request, url, 'auth/logout', fetcher);
	controller.abort();
	const response = await pending;
	expect(response.status).toBe(503);
	expect(cancelled).toHaveBeenCalledOnce();
	expect(fetcher).not.toHaveBeenCalled();
});
it.each([302, 500, 200, 401])('discards rejected upstream body %s', async (status) => {
	const cancel = vi.fn();
	const body = new ReadableStream<Uint8Array>({ cancel });
	const { response } = await run(
		'auth/session',
		'GET',
		{},
		undefined,
		new Response(body, { status, headers: { 'Content-Type': 'text/plain' } })
	);
	expect(response.status).toBe(status === 401 ? 401 : 503);
	expect(cancel).toHaveBeenCalledOnce();
});
