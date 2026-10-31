import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { authenticate, readSession, endSession, supportsPasskeys } from './client.js';
const origin = 'http://localhost:5173';
const challengeID = '00000000-0000-4000-8000-000000000001';
const metadata = {
	userID: challengeID,
	expiresAtUnixSeconds: 2000000000,
	csrfToken: 'a'.repeat(43)
};
class PublicCredential {
	static parseCreationOptionsFromJSON = vi.fn(() => ({ challenge: new Uint8Array([1]) }));
	static parseRequestOptionsFromJSON = vi.fn(() => ({ challenge: new Uint8Array([1]) }));
	toJSON() {
		return { id: 'test-only-public-id', type: 'public-key' };
	}
}
const NativeRequest = Request;
let requestedCredentials: RequestCredentials | undefined;
const fetcher = vi.fn<typeof fetch>();
const create = vi.fn();
const get = vi.fn();
beforeEach(() => {
	vi.clearAllMocks();
	vi.stubGlobal(
		'Request',
		class extends NativeRequest {
			constructor(input: RequestInfo | URL, init?: RequestInit) {
				super(input, init);
				requestedCredentials = init?.credentials;
			}
		}
	);
	vi.stubGlobal('window', { location: { origin }, isSecureContext: true });
	vi.stubGlobal('PublicKeyCredential', PublicCredential);
	vi.stubGlobal('navigator', { credentials: { create, get } });
	vi.stubGlobal('fetch', fetcher);
});
afterEach(() => {
	vi.unstubAllGlobals();
});
it('requires current native JSON APIs', () => {
	expect(supportsPasskeys()).toBe(true);
	vi.stubGlobal('PublicKeyCredential', undefined);
	expect(supportsPasskeys()).toBe(false);
});
it('treats unauthenticated session as signed out', async () => {
	fetcher.mockResolvedValueOnce(new Response(null, { status: 401 }));
	expect(await readSession()).toBeNull();
});
it('uses generated contract and same-origin BFF for session', async () => {
	fetcher.mockResolvedValueOnce(Response.json(metadata));
	const value = await readSession();
	const request = fetcher.mock.calls[0][0] as Request;
	expect(request.url).toBe(origin + '/auth/api/auth/session');
	// Bun 1.4.4 reports Request.credentials as include even for same-origin; assert the native constructor input.
	expect(requestedCredentials).toBe('same-origin');
	expect(request.cache).toBe('no-store');
	expect(value?.csrfToken === metadata.csrfToken).toBe(true);
});
it('registration does not authenticate or request assertion automatically', async () => {
	fetcher
		.mockResolvedValueOnce(Response.json({ challengeID, publicKey: { challenge: 'AQ' } }))
		.mockResolvedValueOnce(new Response(null, { status: 204 }));
	create.mockResolvedValueOnce(new PublicCredential());
	expect(await authenticate(true)).toBeNull();
	expect(get).not.toHaveBeenCalled();
	expect(PublicCredential.parseCreationOptionsFromJSON).toHaveBeenCalledOnce();
	const request = fetcher.mock.calls[1][0] as Request;
	const body = await request.json();
	expect(body.challengeID === challengeID).toBe(true);
	expect(JSON.parse(body.credentialJSON).type === 'public-key').toBe(true);
	expect(request.url.endsWith('/auth/passkeys/registration/finish')).toBe(true);
});
it('authentication uses native assertion JSON', async () => {
	fetcher
		.mockResolvedValueOnce(Response.json({ challengeID, publicKey: { challenge: 'AQ' } }))
		.mockResolvedValueOnce(Response.json(metadata));
	get.mockResolvedValueOnce(new PublicCredential());
	expect((await authenticate(false))?.csrfToken === metadata.csrfToken).toBe(true);
	expect(create).not.toHaveBeenCalled();
	expect(PublicCredential.parseRequestOptionsFromJSON).toHaveBeenCalledOnce();
});
it('sends in-memory CSRF for revocation without URL parameters', async () => {
	fetcher.mockResolvedValueOnce(new Response(null, { status: 204 }));
	await endSession(metadata.csrfToken, true);
	const request = fetcher.mock.calls[0][0] as Request;
	expect(request.url).toBe(origin + '/auth/api/auth/sessions/revoke-all');
	expect(request.headers.get('X-Sauna-CSRF') === metadata.csrfToken).toBe(true);
});
