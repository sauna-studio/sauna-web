import { describe, expect, it } from 'vitest';
import { partyPreviewSchema } from './party';

describe('non-persistent party preview', () => {
	it('accepts integer preview bounds', () => {
		expect(partyPreviewSchema.parse({ guests: 1 }).guests).toBe(1);
		expect(partyPreviewSchema.parse({ guests: 12 }).guests).toBe(12);
	});
	it.each([0, 13, -1, 1.5, NaN, Infinity, '2', undefined])('rejects invalid input %s', (guests) => {
		expect(partyPreviewSchema.safeParse({ guests }).success).toBe(false);
	});
	it('runs Vitest in Bun', () => {
		expect(process.versions.bun).toBeDefined();
	});
});
