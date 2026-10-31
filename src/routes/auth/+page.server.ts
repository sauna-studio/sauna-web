import type { PageServerLoad } from './$types';
export const load: PageServerLoad = ({ setHeaders }) => {
	setHeaders({
		'Cache-Control': 'no-store',
		'Content-Security-Policy': "frame-ancestors 'none'; object-src 'none'; base-uri 'self'",
		'X-Frame-Options': 'DENY'
	});
	return {};
};
