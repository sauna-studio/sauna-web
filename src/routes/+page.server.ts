import { superValidate } from 'sveltekit-superforms';
import { zod as zod4 } from 'sveltekit-superforms/adapters/zod4';
import { partyPreviewSchema } from '#lib/forms/party.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => ({
	preview: await superValidate({ guests: 2 }, zod4(partyPreviewSchema))
});
