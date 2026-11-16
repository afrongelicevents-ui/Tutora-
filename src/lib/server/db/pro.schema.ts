import {
	boolean,
	index,
	integer,
	pgTable,
	primaryKey,
	serial,
	text,
	timestamp,
	uniqueIndex
} from 'drizzle-orm/pg-core';
import { user } from './auth.schema';
import { FAMILY_STATUS, TUTORA_INVOICE_STATUS, TUTORA_PAY_METHODS } from './family.schema';

const ts = (name: string) => timestamp(name, { withTimezone: true });
const userRef = (name: string) =>
	text(name)
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' });

/** Tutora Pro ($5/month): one row per tutor. Same states as Tutora Family. */
export const proSubscription = pgTable(
	'pro_subscription',
	{
		id: serial('id').primaryKey(),
		tutorId: userRef('tutor_id'),
		status: text('status', { enum: FAMILY_STATUS }).notNull().default('free'),
		paidUntil: ts('paid_until'),
		periodMonths: integer('period_months').notNull().default(1),
		/** Pro: remind the tutor's students/parents about unpaid lessons automatically (opt-in) */
		autoReminders: boolean('auto_reminders').notNull().default(false),
		/** Pro: the colour on branded reports (#rrggbb), null = Tutora navy */
		brandColour: text('brand_colour'),
		createdAt: ts('created_at').notNull().defaultNow(),
		updatedAt: ts('updated_at').notNull().defaultNow()
	},
	(t) => [uniqueIndex('pro_subscription_tutor_uq').on(t.tutorId)]
);

/** A tutor's invoice for Tutora Pro (paid to Tutora with proof, confirmed by the owner). */
export const proInvoice = pgTable(
	'pro_invoice',
	{
		id: serial('id').primaryKey(),
		tutorId: userRef('tutor_id'),
		subscriptionId: integer('subscription_id').references(() => proSubscription.id, {
			onDelete: 'set null'
		}),
		periodMonths: integer('period_months').notNull().default(1),
		amountCents: integer('amount_cents').notNull(),
		discountPct: integer('discount_pct').notNull().default(0),
		status: text('status', { enum: TUTORA_INVOICE_STATUS }).notNull().default('due'),
		dueOn: ts('due_on').notNull(),
		periodStart: ts('period_start').notNull(),
		proofKey: text('proof_key'),
		reference: text('reference'),
		method: text('method', { enum: TUTORA_PAY_METHODS }),
		rejectReason: text('reject_reason'),
		receiptNo: integer('receipt_no'),
		confirmedBy: text('confirmed_by').references(() => user.id, { onDelete: 'set null' }),
		confirmedAt: ts('confirmed_at'),
		remindedBefore: ts('reminded_before'),
		remindedDue: ts('reminded_due'),
		remindedAfter: ts('reminded_after'),
		createdAt: ts('created_at').notNull().defaultNow(),
		updatedAt: ts('updated_at').notNull().defaultNow()
	},
	(t) => [
		index('pro_invoice_tutor_idx').on(t.tutorId),
		index('pro_invoice_status_idx').on(t.status),
		uniqueIndex('pro_invoice_receipt_uq').on(t.receiptNo)
	]
);

export const GIFT_PLANS = ['family', 'pro'] as const;
export type GiftPlan = (typeof GIFT_PLANS)[number];

/** The owner gives Tutora Family or Tutora Pro free to a chosen person (optional end date). */
export const planGift = pgTable(
	'plan_gift',
	{
		id: serial('id').primaryKey(),
		userId: userRef('user_id'),
		plan: text('plan', { enum: GIFT_PLANS }).notNull(),
		until: ts('until'),
		note: text('note'),
		givenBy: text('given_by').references(() => user.id, { onDelete: 'set null' }),
		createdAt: ts('created_at').notNull().defaultNow()
	},
	(t) => [uniqueIndex('plan_gift_user_plan_uq').on(t.userId, t.plan)]
);

/** Pro: when a tutor's student (and parents) were last reminded about money owed. */
export const tutorPayReminder = pgTable(
	'tutor_pay_reminder',
	{
		tutorId: userRef('tutor_id'),
		userId: userRef('user_id'),
		sentAt: ts('sent_at').notNull().defaultNow()
	},
	(t) => [primaryKey({ columns: [t.tutorId, t.userId] })]
);
