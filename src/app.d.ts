import type { Session } from 'better-auth';
import type { Role } from '#lib/roles';
import type { DB } from '#lib/server/db/types';
import type { Auth } from '#lib/server/auth-config';

declare global {
	namespace App {
		interface Locals {
			db: DB;
			auth: Auth;
			user?: {
				id: string;
				name: string;
				email: string;
				emailVerified: boolean;
				role: Role;
				twoFactorEnabled: boolean;
				/** for tutors: waiting for approval, approved, or suspended */
				tutorStatus?: 'pending' | 'active' | 'suspended' | null;
			};
			session?: Session;
		}
		interface Error {
			message: string;
		}
		interface Platform {
			env?: { FILES?: R2Bucket } & Record<string, unknown>;
			ctx?: { waitUntil(p: Promise<unknown>): void };
		}
	}
}

export {};
