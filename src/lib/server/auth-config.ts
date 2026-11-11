/**
 * Auth configuration as a pure factory, so it can be used by the app (with Neon),
 * by tests (with local Postgres) and by the Better Auth CLI (schema generation).
 * Do not import `$app/*` modules here.
 */
import { betterAuth, type BetterAuthPlugin } from 'better-auth';
import { APIError } from 'better-auth/api';
import { eq } from 'drizzle-orm';
import { user as userTable } from './db/auth.schema.ts';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { twoFactor } from 'better-auth/plugins';
import type { DB } from './db/types.ts';
import { ROLES } from '../roles.ts';
import { m } from '../paraglide/messages.js';

export type SendEmail = (msg: { to: string; subject: string; text: string }) => Promise<void>;

export interface AuthDeps {
	db: DB;
	baseURL: string;
	secret: string;
	tutorEmail: string;
	sendEmail: SendEmail;
	/** neon-http cannot run transactions; node-postgres can. */
	transactions?: boolean;
	/** Extra plugins, e.g. the SvelteKit cookie plugin. Must stay last. */
	plugins?: BetterAuthPlugin[];
	production?: boolean;
}

/** Error code when someone tries to sign up publicly with the tutor's address. */
export const USE_TUTOR_SETUP = 'USE_TUTOR_SETUP';

export function createAuth(deps: AuthDeps) {
	const tutorEmail = deps.tutorEmail.trim().toLowerCase();
	const origin = deps.baseURL.replace(/\/$/, '');
	return betterAuth({
		appName: 'Tutora',
		baseURL: deps.baseURL,
		secret: deps.secret,
		database: drizzleAdapter(deps.db, {
			provider: 'pg',
			transaction: deps.transactions ?? false
		}),
		emailAndPassword: {
			enabled: true,
			requireEmailVerification: true,
			minPasswordLength: 10,
			maxPasswordLength: 128,
			revokeSessionsOnPasswordReset: true,
			// Completing a reset proves the person controls the inbox, so the address counts as
			// confirmed. This also lets the real owner take back an address someone else signed up with.
			onPasswordReset: async ({ user }) => {
				await deps.db
					.update(userTable)
					.set({ emailVerified: true })
					.where(eq(userTable.id, user.id));
			},
			// Someone signed up with an address that already has an account: tell the owner.
			onExistingUserSignUp: async ({ user }) => {
				await deps.sendEmail({
					to: user.email,
					subject: m.email_exists_s(),
					text: m.email_exists_b({ url: `${origin}/forgot-password` })
				});
			},
			sendResetPassword: async ({ user, url }) => {
				await deps.sendEmail({
					to: user.email,
					subject: m.email_reset_s(),
					text: m.email_reset_b({ name: user.name, url })
				});
			}
		},
		emailVerification: {
			sendOnSignUp: true,
			// Don't send fresh links when someone tries to log in to an unconfirmed account:
			// a stranger could use that to send real-looking emails to the owner.
			sendOnSignIn: false,
			// After confirming, people log in with their own password. (Auto-login could put the
			// real owner into an account a stranger pre-registered with their email.)
			autoSignInAfterVerification: false,
			sendVerificationEmail: async ({ user, url }) => {
				await deps.sendEmail({
					to: user.email,
					subject: m.email_verify_s(),
					text: m.email_verify_b({ name: user.name, url })
				});
			}
		},
		user: {
			// Changing the login email sends a link to the NEW address; it only changes once clicked.
			changeEmail: { enabled: true },
			additionalFields: {
				role: {
					type: [...ROLES],
					required: false,
					defaultValue: 'student',
					// never accepted from the client; set by the server only
					input: false
				}
			}
		},
		session: {
			expiresIn: 60 * 60 * 24 * 30, // 30 days: fewer logins on shared phones costs less data
			updateAge: 60 * 60 * 24,
			// short signed cookie cache: fewer database reads per page view
			cookieCache: { enabled: true, maxAge: 5 * 60 }
		},
		databaseHooks: {
			user: {
				create: {
					// Everyone created through Better Auth is a student. The tutor account is only
					// created by the /setup flow, which proves control of the TUTOR_EMAIL inbox.
					before: async (user) => {
						if (user.email.trim().toLowerCase() === tutorEmail) {
							throw new APIError('FORBIDDEN', { code: USE_TUTOR_SETUP, message: USE_TUTOR_SETUP });
						}
						return { data: { ...user, role: 'student' } };
					}
				}
			}
		},
		rateLimit: {
			enabled: true,
			storage: 'database',
			window: 60,
			max: 60,
			customRules: {
				'/sign-in/email': { window: 60, max: 5 },
				'/sign-up/email': { window: 60 * 60, max: 5 },
				'/request-password-reset': { window: 60 * 60, max: 3 },
				'/send-verification-email': { window: 60 * 60, max: 3 },
				'/two-factor/*': { window: 60, max: 5 }
			}
		},
		advanced: {
			useSecureCookies: deps.production ?? false,
			ipAddress: { ipAddressHeaders: ['cf-connecting-ip', 'x-forwarded-for'] }
		},
		plugins: [twoFactor({ issuer: 'Tutora' }), ...(deps.plugins ?? [])]
	});
}

export type Auth = ReturnType<typeof createAuth>;
export type SessionData = Auth['$Infer']['Session'];
export type AuthUser = SessionData['user'];
