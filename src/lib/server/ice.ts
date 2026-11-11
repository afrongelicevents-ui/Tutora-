import { TURN_KEY_ID, TURN_KEY_API_TOKEN } from '$app/env/private';

export interface IceServer {
	urls: string | string[];
	username?: string;
	credential?: string;
}

const STUN: IceServer[] = [{ urls: 'stun:stun.cloudflare.com:3478' }];

/**
 * Servers that help two phones find each other. With a Cloudflare Realtime TURN key
 * (optional, free tier) calls also work on networks that block direct connections.
 */
export async function iceServers(fetcher: typeof fetch = fetch): Promise<IceServer[]> {
	if (!TURN_KEY_ID || !TURN_KEY_API_TOKEN) return STUN;
	try {
		const res = await fetcher(
			`https://rtc.live.cloudflare.com/v1/turn/keys/${TURN_KEY_ID}/credentials/generate-ice-servers`,
			{
				method: 'POST',
				headers: {
					authorization: `Bearer ${TURN_KEY_API_TOKEN}`,
					'content-type': 'application/json'
				},
				body: JSON.stringify({ ttl: 4 * 3600 })
			}
		);
		if (!res.ok) return STUN;
		const body = (await res.json()) as { iceServers?: IceServer[] | IceServer };
		const list = Array.isArray(body.iceServers)
			? body.iceServers
			: body.iceServers
				? [body.iceServers]
				: [];
		return list.length ? list : STUN;
	} catch {
		return STUN;
	}
}
