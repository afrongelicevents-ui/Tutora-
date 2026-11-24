import { describe, expect, it } from 'vitest';
import { labelFamilyLinks } from './family-features';

describe('labelFamilyLinks', () => {
	it('labels links to Tutora Family pages only', () => {
		const html =
			'<a class="x" href="/student/homework">Homework</a> <a href="/student/lessons">Lessons</a> ' +
			'<a href="/student/quiz/2?from=x">Quiz</a>';
		const out = labelFamilyLinks(html, 'Tutora Family');
		expect(out).toContain('<a class="x" data-fam="Tutora Family" href="/student/homework">');
		expect(out).toContain('<a href="/student/lessons">');
		expect(out).toContain('data-fam="Tutora Family" href="/student/quiz/2?from=x"');
		expect(labelFamilyLinks(out, 'Tutora Family')).toBe(out);
	});
});
