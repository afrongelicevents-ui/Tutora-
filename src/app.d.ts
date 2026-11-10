import type { Session } from 'better-auth';
import type { Role } from '#lib/roles.ts';

declare global {
	namespace App {
		interface Locals {
			user?: {
				id: string;
				name: string;
				email: string;
				emailVerified: boolean;
				role: Role;
				twoFactorEnabled: boolean;
			};
			session?: Session;
		}
		interface Error {
			message: string;
		}
	}
}

export {};
