import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
	readManagedPasskeys,
	authorizePasskeyAddition,
	completePasskeyAddition,
	revokeManagedPasskey
} from './client.js';
const challengeID = '00000000-0000-4000-8000-000000000001';
const options = { challengeID, publicKey: { challenge: 'AQ' } };
const creationOptions = { challengeID, publicKey: { challenge: 'Ag' } };
const csrf = 'a'.repeat(43);
class Credential {
	static parseCreationOptionsFromJSON = vi.fn(() => ({ challenge: new Uint8Array([1]) }));
	static parseRequestOptionsFromJSON = vi.fn(() => ({ challenge: new Uint8Array([1]) }));
	toJSON() {
		return { id: 'public-test-id', type: 'public-key' };
	}
}
const fetcher = vi.fn<typeof fetch>();
const get = vi.fn();
const create = vi.fn();
beforeEach(() => {
	vi.clearAllMocks();
	vi.stubGlobal('window', { location: { origin: 'http://localhost:5173' } });
	vi.stubGlobal('fetch', fetcher);
	vi.stubGlobal('navigator', { credentials: { get, create } });
	vi.stubGlobal('PublicKeyCredential', Credential);
});
afterEach(() => vi.unstubAllGlobals());
it('returns only validated account credential metadata', async () => {
	fetcher.mockResolvedValueOnce(
		Response.json({
			credentials: [
				{ credentialID: 'AQ', createdAtUnixSeconds: 100, isCurrentSessionCredential: true }
			]
		})
	);
	expect(await readManagedPasskeys()).toEqual([
		{ credentialID: 'AQ', createdAtUnixSeconds: 100, isCurrentSessionCredential: true }
	]);
	fetcher.mockResolvedValueOnce(
		Response.json({
			credentials: [
				{
					credentialID: 'AQ',
					createdAtUnixSeconds: 100,
					isCurrentSessionCredential: true,
					publicKeyCOSE: 'unexpected'
				}
			]
		})
	);
	await expect(readManagedPasskeys()).rejects.toThrow();
});
it('authorizes addition using an assertion without creating a new credential automatically', async () => {
	fetcher
		.mockResolvedValueOnce(Response.json(options))
		.mockResolvedValueOnce(Response.json(creationOptions));
	get.mockResolvedValueOnce(new Credential());
	expect(await authorizePasskeyAddition(csrf)).toEqual(creationOptions);
	expect(get).toHaveBeenCalledOnce();
	expect(create).not.toHaveBeenCalled();
	const requests = fetcher.mock.calls.map(([request]) => request as Request);
	expect(requests.map((request) => new URL(request.url).pathname)).toEqual([
		'/auth/api/auth/passkeys/addition/authorization/options',
		'/auth/api/auth/passkeys/addition/authorization/finish'
	]);
	expect(requests.every((request) => request.headers.get('X-Sauna-CSRF') === csrf)).toBe(true);
	expect((await requests[1].json()).challengeID).toBe(challengeID);
});
it('does not submit authorization when the existing authenticator is cancelled', async () => {
	fetcher.mockResolvedValueOnce(Response.json(options));
	get.mockRejectedValueOnce(new DOMException('cancelled', 'NotAllowedError'));
	await expect(authorizePasskeyAddition(csrf)).rejects.toThrow();
	expect(fetcher).toHaveBeenCalledOnce();
	expect(create).not.toHaveBeenCalled();
});
it('uses the authorized creation challenge and requires an explicit successful change', async () => {
	create.mockResolvedValueOnce(new Credential());
	fetcher.mockResolvedValueOnce(new Response(null, { status: 204 }));
	await completePasskeyAddition(options, csrf);
	expect(get).not.toHaveBeenCalled();
	expect(Credential.parseCreationOptionsFromJSON).toHaveBeenCalledWith(options.publicKey);
	const request = fetcher.mock.calls[0][0] as Request;
	expect(new URL(request.url).pathname).toBe('/auth/api/auth/passkeys/addition/finish');
	expect(request.headers.get('X-Sauna-CSRF') === csrf).toBe(true);
	expect((await request.json()).challengeID).toBe(challengeID);
});
it('binds revocation options to the selected target and submits the returned assertion challenge', async () => {
	fetcher
		.mockResolvedValueOnce(Response.json(options))
		.mockResolvedValueOnce(new Response(null, { status: 204 }));
	get.mockResolvedValueOnce(new Credential());
	await revokeManagedPasskey('Ag', csrf);
	const begin = fetcher.mock.calls[0][0] as Request;
	const finish = fetcher.mock.calls[1][0] as Request;
	expect(await begin.json()).toEqual({ credentialID: 'Ag' });
	expect((await finish.json()).challengeID).toBe(challengeID);
	expect(
		[begin, finish].every(
			(request) => request.headers.get('X-Sauna-CSRF') === csrf && !new URL(request.url).search
		)
	).toBe(true);
	expect(create).not.toHaveBeenCalled();
});
it('does not treat a rejected or expired management operation as a completed change', async () => {
	fetcher.mockResolvedValueOnce(new Response(null, { status: 401 }));
	await expect(revokeManagedPasskey('Ag', csrf)).rejects.toThrow();
	expect(get).not.toHaveBeenCalled();
	expect(fetcher).toHaveBeenCalledOnce();
});
it('passes cancellation to the authenticator rather than leaving a prompt after unmount', async () => {
	const abort = new AbortController();
	fetcher
		.mockResolvedValueOnce(Response.json(options))
		.mockResolvedValueOnce(new Response(null, { status: 204 }));
	get.mockResolvedValueOnce(new Credential());
	await revokeManagedPasskey('Ag', csrf, abort.signal);
	expect(get.mock.calls[0][0].signal === abort.signal).toBe(true);
});

it('does not submit a late authenticator result after cancellation', async () => {
	const abort = new AbortController();
	fetcher.mockResolvedValueOnce(Response.json(options));
	get.mockImplementationOnce(async () => {
		abort.abort();
		return new Credential();
	});
	await expect(revokeManagedPasskey('Ag', csrf, abort.signal)).rejects.toThrow();
	expect(fetcher).toHaveBeenCalledOnce();
});
