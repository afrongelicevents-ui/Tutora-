import {
	boolean,
	index,
	integer,
	jsonb,
	pgTable,
	serial,
	text,
	timestamp,
	uniqueIndex
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { user } from './auth.schema';

const ts = (name: string) => timestamp(name, { withTimezone: true });
const userRef = (name: string) =>
	text(name)
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' });

/** Tutora Family (the parent's paid plan for the system; tutors are paid separately). */
export const FAMILY_STATUS = ['trial', 'active', 'grace', 'free'] as const;
export type FamilyStatus = (typeof FAMILY_STATUS)[number];
export const FAMILY_PERIODS = [1, 3, 6] as const;
export type FamilyPeriod = (typeof FAMILY_PERIODS)[number];

export const familySubscription = pgTable(
	'family_subscription',
	{
		id: serial('id').primaryKey(),
		/** the paying account: a parent, or an adult student paying for themselves */
		parentId: userRef('parent_id'),
		status: text('status', { enum: FAMILY_STATUS }).notNull().default('free'),
		paidUntil: ts('paid_until'),
		periodMonths: integer('period_months').notNull().default(1),
		createdAt: ts('created_at').notNull().defaultNow(),
		updatedAt: ts('updated_at').notNull().defaultNow()
	},
	(t) => [uniqueIndex('family_subscription_parent_uq').on(t.parentId)]
);

/**
 * Which children a subscription covers. `active` is set once an invoice for the child is
 * paid and cleared when the account drops to free: a child can be active on ONE paying
 * account only (partial unique index), so two parents can't both pay for the same child.
 */
export const subscriptionChild = pgTable(
	'subscription_child',
	{
		id: serial('id').primaryKey(),
		subscriptionId: integer('subscription_id')
			.notNull()
			.references(() => familySubscription.id, { onDelete: 'cascade' }),
		studentId: userRef('student_id'),
		active: boolean('active').notNull().default(false),
		createdAt: ts('created_at').notNull().defaultNow()
	},
	(t) => [
		uniqueIndex('subscription_child_sub_student_uq').on(t.subscriptionId, t.studentId),
		uniqueIndex('subscription_child_active_student_uq')
			.on(t.studentId)
			.where(sql`${t.active}`)
	]
);

export const TUTORA_INVOICE_STATUS = [
	'due',
	'proof_sent',
	'paid',
	'overdue',
	'rejected',
	'cancelled'
] as const;
export type TutoraInvoiceStatus = (typeof TUTORA_INVOICE_STATUS)[number];
export const TUTORA_PAY_METHODS = ['ecocash', 'innbucks', 'bank', 'cash', 'other'] as const;

export interface InvoiceChild {
	id: string;
	name: string;
	cents: number;
}

export const tutoraInvoice = pgTable(
	'tutora_invoice',
	{
		id: serial('id').primaryKey(),
		parentId: userRef('parent_id'),
		subscriptionId: integer('subscription_id').references(() => familySubscription.id, {
			onDelete: 'set null'
		}),
		/** the children (and per-child price) when the invoice was made */
		children: jsonb('children').$type<InvoiceChild[]>().notNull(),
		periodMonths: integer('period_months').notNull().default(1),
		amountCents: integer('amount_cents').notNull(),
		discountPct: integer('discount_pct').notNull().default(0),
		status: text('status', { enum: TUTORA_INVOICE_STATUS }).notNull().default('due'),
		dueOn: ts('due_on').notNull(),
		/** the period this invoice pays for */
		periodStart: ts('period_start').notNull(),
		proofKey: text('proof_key'),
		reference: text('reference'),
		method: text('method', { enum: TUTORA_PAY_METHODS }),
		rejectReason: text('reject_reason'),
		receiptNo: integer('receipt_no'),
		confirmedBy: text('confirmed_by').references(() => user.id, { onDelete: 'set null' }),
		confirmedAt: ts('confirmed_at'),
		/** reminders sent (claimed before sending, so each goes once) */
		remindedBefore: ts('reminded_before'),
		remindedDue: ts('reminded_due'),
		remindedAfter: ts('reminded_after'),
		createdAt: ts('created_at').notNull().defaultNow(),
		updatedAt: ts('updated_at').notNull().defaultNow()
	},
	(t) => [
		index('tutora_invoice_parent_idx').on(t.parentId),
		index('tutora_invoice_status_idx').on(t.status),
		uniqueIndex('tutora_invoice_receipt_uq').on(t.receiptNo)
	]
);

/** One row (id = 1): how families pay Tutora, set by the owner. */
export const tutoraSettings = pgTable('tutora_settings', {
	id: integer('id').primaryKey().default(1),
	ecocashNumber: text('ecocash_number'),
	ecocashName: text('ecocash_name'),
	innbucksNumber: text('innbucks_number'),
	innbucksName: text('innbucks_name'),
	bankName: text('bank_name'),
	bankAccountName: text('bank_account_name'),
	bankAccountNumber: text('bank_account_number'),
	bankBranch: text('bank_branch'),
	notes: text('notes'),
	discount3mPct: integer('discount_3m_pct').notNull().default(0),
	discount6mPct: integer('discount_6m_pct').notNull().default(0),
	/** while on, every family has the full app for free (the pilot) */
	pilotFreeTrial: boolean('pilot_free_trial').notNull().default(true),
	trialDays: integer('trial_days').notNull().default(30),
	updatedAt: ts('updated_at').notNull().defaultNow()
});
