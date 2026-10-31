// Server-only, local development BFF. Never accepts an upstream URL from a request.
export const authOrigin = 'http://localhost:5173';
const profile = 'customer';
const limit = 128 * 1024;
const methods = new Map([
	['auth/passkeys/registration/options', 'POST'],
	['auth/passkeys/registration/finish', 'POST'],
	['auth/passkeys/authentication/options', 'POST'],
	['auth/passkeys/authentication/finish', 'POST'],
	['auth/session', 'GET'],
	['auth/logout', 'POST'],
	['auth/sessions/revoke-all', 'POST']
]);
const cookieNames = new Set([`__Host-sauna-${profile}-flow`, `__Host-sauna-${profile}-session`]);
function failure(status: number): Response {
	return Response.json(
		{ message: '認証リクエストを完了できませんでした。' },
		{ status, headers: { 'Cache-Control': 'no-store' } }
	);
}
function discard(body: ReadableStream<Uint8Array> | null): void {
	void body?.cancel().catch(() => {});
}
async function boundedBody(
	body: ReadableStream<Uint8Array> | null,
	signal: AbortSignal
): Promise<Uint8Array> {
	if (!body) return new Uint8Array();
	signal.throwIfAborted();
	const reader = body.getReader();
	const abort = () => {
		void reader.cancel().catch(() => {});
	};
	signal.addEventListener('abort', abort, { once: true });
	const chunks: Uint8Array[] = [];
	let size = 0;
	try {
		while (true) {
			const next = await reader.read();
			signal.throwIfAborted();
			if (next.done) break;
			size += next.value.byteLength;
			if (size > limit) {
				void reader.cancel().catch(() => {});
				throw new Error('bounded body');
			}
			chunks.push(next.value);
		}
	} finally {
		signal.removeEventListener('abort', abort);
		reader.releaseLock();
	}
	const result = new Uint8Array(size);
	let offset = 0;
	for (const chunk of chunks) {
		result.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return result;
}
export async function proxyAuthentication(
	request: Request,
	url: URL,
	path: string,
	fetcher: typeof fetch = fetch
): Promise<Response> {
	if (
		url.origin !== authOrigin ||
		request.headers.get('Host') !== new URL(authOrigin).host ||
		url.search ||
		methods.get(path) !== request.method
	)
		return failure(404);
	const origin = request.headers.get('Origin');
	if ((origin !== null && origin !== authOrigin) || (request.method !== 'GET' && origin === null))
		return failure(403);
	const site = request.headers.get('Sec-Fetch-Site');
	if (site !== 'same-origin' && site !== 'none') return failure(403);
	const headers = new Headers({ Origin: authOrigin });
	const cookies: string[] = [];
	const seen = new Set<string>();
	for (const part of (request.headers.get('Cookie') ?? '').split(';')) {
		const item = part.trim();
		const index = item.indexOf('=');
		if (index < 0) continue;
		const name = item.slice(0, index);
		if (!cookieNames.has(name)) continue;
		if (seen.has(name) || !/^[A-Za-z0-9_-]{43}$/.test(item.slice(index + 1))) return failure(400);
		seen.add(name);
		cookies.push(item);
	}
	if (cookies.length) headers.set('Cookie', cookies.join('; '));
	const csrf = request.headers.get('X-Sauna-CSRF');
	if (csrf !== null) {
		if (!/^[A-Za-z0-9_-]{43}$/.test(csrf)) return failure(400);
		headers.set('X-Sauna-CSRF', csrf);
	}
	const declared = request.headers.get('Content-Length');
	if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > limit))
		return failure(413);
	if (request.headers.has('Content-Encoding')) return failure(400);
	const signal = AbortSignal.any([request.signal, AbortSignal.timeout(10_000)]);
	let body: Uint8Array | undefined;
	try {
		if (request.method !== 'GET') body = await boundedBody(request.body, signal);
	} catch {
		return failure(signal.aborted ? 503 : 413);
	}
	if (body?.length) {
		if (request.headers.get('Content-Type')?.split(';')[0].trim() !== 'application/json')
			return failure(400);
		headers.set('Content-Type', 'application/json');
	}
	try {
		const upstream = await fetcher(`http://127.0.0.1:8080/${path}`, {
			method: request.method,
			headers,
			body: body?.length ? new Uint8Array(body).buffer : undefined,
			redirect: 'error',
			signal
		});
		if (![200, 204, 400, 401, 403, 413, 429, 503].includes(upstream.status)) {
			discard(upstream.body);
			return failure(503);
		}
		const resultHeaders = new Headers({
			'Cache-Control': 'no-store',
			Pragma: 'no-cache',
			'X-Content-Type-Options': 'nosniff'
		});
		for (const cookie of upstream.headers.getSetCookie()) {
			const name = cookie.slice(0, cookie.indexOf('='));
			if (
				cookieNames.has(name) &&
				!/;\s*Domain=/i.test(cookie) &&
				/;\s*Path=\/(?:;|$)/i.test(cookie) &&
				/;\s*Secure(?:;|$)/i.test(cookie) &&
				/;\s*HttpOnly(?:;|$)/i.test(cookie) &&
				/;\s*SameSite=Strict(?:;|$)/i.test(cookie)
			)
				resultHeaders.append('Set-Cookie', cookie);
		}
		if (upstream.status === 204) return new Response(null, { status: 204, headers: resultHeaders });
		if (!upstream.ok) {
			discard(upstream.body);
			resultHeaders.set('Content-Type', 'application/json');
			return new Response(JSON.stringify({ message: '認証リクエストを完了できませんでした。' }), {
				status: upstream.status,
				headers: resultHeaders
			});
		}
		if (upstream.headers.get('Content-Type')?.split(';')[0].trim() !== 'application/json') {
			discard(upstream.body);
			return failure(503);
		}
		const result = await boundedBody(upstream.body, signal);
		resultHeaders.set('Content-Type', 'application/json');
		return new Response(new Uint8Array(result).buffer, {
			status: upstream.status,
			headers: resultHeaders
		});
	} catch {
		return failure(503);
	}
}
