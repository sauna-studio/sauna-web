import { proxyAuthentication } from '#lib/server/auth-proxy.js';
import type { RequestHandler } from './$types';
const handle: RequestHandler = ({ request, url, params }) =>
	proxyAuthentication(request, url, params.path ?? '');
export const GET = handle;
export const POST = handle;
