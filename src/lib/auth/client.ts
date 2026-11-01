import createClient from 'openapi-fetch';
import { z } from 'zod';
import type { components, paths } from '#lib/api/schema.js';
const sessionSchema = z.object({
	userID: z.uuid(),
	expiresAtUnixSeconds: z.number().int().positive(),
	csrfToken: z.string().regex(/^[A-Za-z0-9_-]{43}$/)
});
const optionsSchema = z.object({
	challengeID: z.uuid(),
	publicKey: z.record(z.string(), z.unknown())
});
export type AuthSession = components['schemas']['AuthSession'];
export type ManagedPasskey = components['schemas']['ManagedPasskey'];
export type PasskeyManagementOptions = z.infer<typeof optionsSchema>;
const managedPasskeysSchema = z.strictObject({
	credentials: z
		.array(
			z.strictObject({
				credentialID: z
					.string()
					.min(2)
					.max(1364)
					.regex(/^[A-Za-z0-9_-]+$/),
				createdAtUnixSeconds: z.number().int().positive(),
				lastUsedAtUnixSeconds: z.number().int().positive().optional(),
				isCurrentSessionCredential: z.boolean()
			})
		)
		.max(10)
});
const origin = 'http://localhost:5173' as const;
function client() {
	return createClient<paths>({
		baseUrl: `${window.location.origin}/auth/api`,
		credentials: 'same-origin',
		cache: 'no-store'
	});
}
export function supportsPasskeys(): boolean {
	return (
		window.isSecureContext &&
		typeof PublicKeyCredential !== 'undefined' &&
		typeof PublicKeyCredential.parseCreationOptionsFromJSON === 'function' &&
		typeof PublicKeyCredential.parseRequestOptionsFromJSON === 'function' &&
		typeof PublicKeyCredential.prototype.toJSON === 'function'
	);
}
export async function readSession(signal?: AbortSignal): Promise<AuthSession | null> {
	const result = await client().GET('/auth/session', {
		params: { header: { Origin: origin } },
		signal
	});
	if (result.response.status === 401) return null;
	if (!result.response.ok) throw new Error('authentication unavailable');
	return sessionSchema.parse(result.data);
}
export async function authenticate(register: boolean): Promise<AuthSession | null> {
	const api = client();
	const options = register
		? await api.POST('/auth/passkeys/registration/options', {
				params: { header: { Origin: origin } }
			})
		: await api.POST('/auth/passkeys/authentication/options', {
				params: { header: { Origin: origin } }
			});
	if (!options.response.ok) throw new Error('authentication unavailable');
	const data = optionsSchema.parse(options.data);
	const credential = register
		? await navigator.credentials.create({
				publicKey: PublicKeyCredential.parseCreationOptionsFromJSON(
					data.publicKey as unknown as PublicKeyCredentialCreationOptionsJSON
				)
			})
		: await navigator.credentials.get({
				publicKey: PublicKeyCredential.parseRequestOptionsFromJSON(
					data.publicKey as unknown as PublicKeyCredentialRequestOptionsJSON
				)
			});
	if (!(credential instanceof PublicKeyCredential)) throw new Error('authentication unavailable');
	const body = {
		challengeID: data.challengeID,
		credentialJSON: JSON.stringify(credential.toJSON())
	};
	if (register) {
		const result = await api.POST('/auth/passkeys/registration/finish', {
			body,
			params: { header: { Origin: origin } }
		});
		if (result.response.status !== 204) throw new Error('authentication unavailable');
		return null;
	}
	const result = await api.POST('/auth/passkeys/authentication/finish', {
		body,
		params: { header: { Origin: origin } }
	});
	if (!result.response.ok) throw new Error('authentication unavailable');
	return sessionSchema.parse(result.data);
}
export async function endSession(csrfToken: string, all: boolean): Promise<void> {
	const api = client();
	const params = { header: { Origin: origin, 'X-Sauna-CSRF': csrfToken } };
	const result = all
		? await api.POST('/auth/sessions/revoke-all', { params })
		: await api.POST('/auth/logout', { params });
	if (result.response.status !== 204) throw new Error('authentication unavailable');
}

export async function readManagedPasskeys(signal?: AbortSignal): Promise<ManagedPasskey[]> {
	const result = await client().GET('/auth/passkeys', {
		params: { header: { Origin: origin } },
		signal
	});
	if (!result.response.ok) throw new Error('credential management unavailable');
	return managedPasskeysSchema.parse(result.data).credentials;
}
async function assertion(options: PasskeyManagementOptions, signal?: AbortSignal): Promise<string> {
	const credential = await navigator.credentials.get({
		publicKey: PublicKeyCredential.parseRequestOptionsFromJSON(
			options.publicKey as unknown as PublicKeyCredentialRequestOptionsJSON
		),
		signal
	});
	signal?.throwIfAborted();
	if (!(credential instanceof PublicKeyCredential))
		throw new Error('credential management unavailable');
	return JSON.stringify(credential.toJSON());
}
export async function authorizePasskeyAddition(
	csrfToken: string,
	signal?: AbortSignal
): Promise<PasskeyManagementOptions> {
	const api = client();
	const params = { header: { Origin: origin, 'X-Sauna-CSRF': csrfToken } };
	const begin = await api.POST('/auth/passkeys/addition/authorization/options', { params, signal });
	if (!begin.response.ok) throw new Error('credential management unavailable');
	const options = optionsSchema.parse(begin.data);
	const credentialJSON = await assertion(options, signal);
	const verified = await api.POST('/auth/passkeys/addition/authorization/finish', {
		params,
		body: { challengeID: options.challengeID, credentialJSON },
		signal
	});
	if (!verified.response.ok) throw new Error('credential management unavailable');
	return optionsSchema.parse(verified.data);
}
export async function completePasskeyAddition(
	options: PasskeyManagementOptions,
	csrfToken: string,
	signal?: AbortSignal
): Promise<void> {
	const credential = await navigator.credentials.create({
		publicKey: PublicKeyCredential.parseCreationOptionsFromJSON(
			options.publicKey as unknown as PublicKeyCredentialCreationOptionsJSON
		),
		signal
	});
	signal?.throwIfAborted();
	if (!(credential instanceof PublicKeyCredential))
		throw new Error('credential management unavailable');
	const result = await client().POST('/auth/passkeys/addition/finish', {
		params: { header: { Origin: origin, 'X-Sauna-CSRF': csrfToken } },
		body: { challengeID: options.challengeID, credentialJSON: JSON.stringify(credential.toJSON()) },
		signal
	});
	if (result.response.status !== 204) throw new Error('credential management unavailable');
}
export async function revokeManagedPasskey(
	credentialID: string,
	csrfToken: string,
	signal?: AbortSignal
): Promise<void> {
	const api = client();
	const params = { header: { Origin: origin, 'X-Sauna-CSRF': csrfToken } };
	const begin = await api.POST('/auth/passkeys/revocation/options', {
		params,
		body: { credentialID },
		signal
	});
	if (!begin.response.ok) throw new Error('credential management unavailable');
	const options = optionsSchema.parse(begin.data);
	const credentialJSON = await assertion(options, signal);
	const result = await api.POST('/auth/passkeys/revocation/finish', {
		params,
		body: { challengeID: options.challengeID, credentialJSON },
		signal
	});
	if (result.response.status !== 204) throw new Error('credential management unavailable');
}
