import { z } from 'zod';

// Preview bounds, not published facility capacity or reservation availability.
export const partyPreviewSchema = z.object({
	guests: z
		.number({ error: '人数を入力してください。' })
		.int('整数で入力してください。')
		.min(1, '1人以上で入力してください。')
		.max(12, 'プレビューでは12人まで入力できます。')
});
