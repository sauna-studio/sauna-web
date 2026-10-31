import { checkLocalService, readLocalVersion } from '../src/lib/server/service.ts';
const healthy = await checkLocalService();
const version = await readLocalVersion();
if (!healthy || !version) {
	console.error('Local API is unavailable or returned an invalid public contract.');
	process.exit(1);
}
console.log(JSON.stringify({ status: 'ok', ...version }));
