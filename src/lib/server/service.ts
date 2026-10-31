import createClient from 'openapi-fetch';
import type { paths } from '#lib/api/schema.js';

// Fixed local development target. No user input or client URL can select a host.
const baseUrl = 'http://127.0.0.1:8080';

export async function checkLocalService(
	fetcher: (request: Request) => Promise<Response> = fetch
): Promise<boolean> {
	try {
		const client = createClient<paths>({ baseUrl, fetch: fetcher });
		const result = await client.GET('/health', { signal: AbortSignal.timeout(1000) });
		return result.response.status === 200 && result.data?.status === 'ok';
	} catch {
		return false;
	}
}

export async function readLocalVersion(
	fetcher: (request: Request) => Promise<Response> = fetch
): Promise<{ apiVersion: string; version: string } | null> {
	try {
		const client = createClient<paths>({ baseUrl, fetch: fetcher });
		const result = await client.GET('/version', { signal: AbortSignal.timeout(1000) });
		if (result.response.status !== 200 || !result.data) return null;
		const { apiVersion, version } = result.data;
		if (typeof apiVersion !== 'string' || typeof version !== 'string') return null;
		const release = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?![\s\S])/;
		if (!release.test(apiVersion) || !release.test(version)) return null;
		return { apiVersion, version };
	} catch {
		return null;
	}
}
