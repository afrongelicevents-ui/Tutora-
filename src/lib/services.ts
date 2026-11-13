/** Kinds of help a tutor can offer (labels are messages th_<key>). */
export const SERVICES = ['homework', 'exams', 'catchup', 'revision', 'skills', 'group'] as const;
export type Service = (typeof SERVICES)[number];
export const isService = (v: unknown): v is Service =>
	typeof v === 'string' && (SERVICES as readonly string[]).includes(v);
