import { describe, expect, it } from 'vitest';
import { tuneOpus } from './room-client.ts';
import {
	contactSchema,
	packageSchema,
	pricesSchema,
	profileSchema,
	teachingSchema
} from './validation/settings.ts';

describe('low-data audio', () => {
	it('asks Opus for ~24 kbps mono with silence suppression', () => {
		const sdp =
			'v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\na=rtpmap:111 opus/48000/2\r\na=fmtp:111 minptime=10;useinbandfec=1\r\n';
		const out = tuneOpus(sdp);
		expect(out).toContain(
			'a=fmtp:111 minptime=10;maxaveragebitrate=24000;usedtx=1;stereo=0;useinbandfec=1'
		);
		expect(out.match(/a=fmtp:111/g)).toHaveLength(1);
	});
	it('adds the settings if the browser gave none, and leaves non-Opus SDP alone', () => {
		const sdp = 'a=rtpmap:109 opus/48000/2\r\n';
		expect(tuneOpus(sdp)).toContain('a=fmtp:109 maxaveragebitrate=24000');
		expect(tuneOpus('a=rtpmap:0 PCMU/8000\r\n')).toBe('a=rtpmap:0 PCMU/8000\r\n');
	});
});

describe('settings validation', () => {
	it('empty boxes mean "not filled in" (hidden publicly)', () => {
		expect(profileSchema.parse({ tutorName: '  ', bio: '' })).toMatchObject({
			tutorName: null,
			bio: null,
			yearsTeaching: null
		});
		expect(contactSchema.parse({ whatsappNumber: '' })).toEqual({
			whatsappNumber: null,
			phone: null,
			contactEmail: null
		});
	});
	it('checks phone numbers, emails, prices and group sizes', () => {
		expect(contactSchema.safeParse({ whatsappNumber: 'call me' }).success).toBe(false);
		expect(contactSchema.safeParse({ contactEmail: 'nope' }).success).toBe(false);
		expect(pricesSchema.parse({ defaultPrice: '12.5', currency: 'ZWG' })).toEqual({
			defaultPrice: 1250,
			showPrices: false,
			currency: 'ZWG',
			offersIntro: false
		});
		expect(pricesSchema.safeParse({ defaultPrice: '-3', currency: 'USD' }).success).toBe(false);
		expect(
			teachingSchema.safeParse({
				lessonModes: 'both',
				groupMode: 'both',
				maxGroupSize: '1',
				lessonMinutes: '60',
				cancelHours: '24'
			}).success
		).toBe(false);
		expect(
			packageSchema.safeParse({ name: '4 lessons', lessonCount: '4', price: '' }).success
		).toBe(false);
	});
	it('long text is refused', () => {
		expect(profileSchema.safeParse({ bio: 'x'.repeat(2001) }).success).toBe(false);
	});
});
