// Finds (or creates) the Neon database for Tutora and hands its address to the next steps,
// without ever printing it. Optionally resets the database password first (for a leaked one).
// Env: NEON_API_KEY (required), RESET_PASSWORD=true|false, NEON_PROJECT (optional id or name).
import { appendFileSync } from 'node:fs';

const API = process.env.NEON_API_BASE ?? 'https://console.neon.tech/api/v2';
const KEY = process.env.NEON_API_KEY?.trim();
const RESET = process.env.RESET_PASSWORD === 'true';
const WANT = process.env.NEON_PROJECT?.trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const mask = (v) => console.log(`::add-mask::${v}`);

async function neon(path, init = {}) {
	for (let attempt = 0; ; attempt++) {
		const res = await fetch(API + path, {
			...init,
			headers: {
				authorization: `Bearer ${KEY}`,
				accept: 'application/json',
				'content-type': 'application/json'
			}
		});
		// 423 = another operation is still running on the project
		if ((res.status === 423 || res.status >= 500) && attempt < 10) {
			await sleep(3000);
			continue;
		}
		const body = await res.json().catch(() => ({}));
		if (!res.ok)
			throw new Error(
				`Neon ${init.method ?? 'GET'} ${path.split('?')[0]}: ${res.status} ${body.message ?? ''}`
			);
		return body;
	}
}

async function waitFor(projectId, operations = []) {
	for (const op of operations) {
		for (let i = 0; i < 40; i++) {
			const { operation } = await neon(`/projects/${projectId}/operations/${op.id}`);
			if (operation.status === 'finished') break;
			if (operation.status === 'failed' || operation.status === 'error')
				throw new Error(`Neon operation ${operation.action} failed`);
			await sleep(1500);
		}
	}
}

async function allProjects() {
	const out = [];
	const seen = new Set();
	const add = (list, orgId) => {
		for (const p of list ?? []) {
			if (seen.has(p.id)) continue;
			seen.add(p.id);
			out.push({ ...p, orgId });
		}
	};
	add((await neon('/projects?limit=400')).projects);
	let orgs = [];
	try {
		orgs = (await neon('/users/me/organizations')).organizations ?? [];
	} catch {
		// organization API keys can't list organizations; their projects are already listed above
	}
	for (const o of orgs) add((await neon(`/projects?limit=400&org_id=${o.id}`)).projects, o.id);
	return { projects: out, orgs };
}

async function main() {
	if (!KEY) throw new Error('NEON_API_KEY is missing');
	const { projects, orgs } = await allProjects();
	let project =
		(WANT && projects.find((p) => p.id === WANT || p.name === WANT)) ||
		projects.find((p) => /tutora/i.test(p.name)) ||
		(projects.length === 1 ? projects[0] : undefined);

	if (!project && projects.length > 1) {
		throw new Error(
			`Found ${projects.length} Neon projects and none is called "tutora". Rename the right one to "tutora" in Neon and run again.`
		);
	}
	if (!project) {
		console.log('No Neon project yet: creating "tutora" (Frankfurt, closest to Southern Africa).');
		const created = await neon('/projects', {
			method: 'POST',
			body: JSON.stringify({
				project: {
					name: 'tutora',
					region_id: 'aws-eu-central-1',
					pg_version: 17,
					...(orgs.length === 1 ? { org_id: orgs[0].id } : {})
				}
			})
		});
		project = created.project;
		await waitFor(project.id, created.operations);
	}
	console.log(`Using Neon project "${project.name}".`);

	const { branches } = await neon(`/projects/${project.id}/branches`);
	const branch = branches.find((b) => b.default) ?? branches.find((b) => b.primary) ?? branches[0];
	const { roles } = await neon(`/projects/${project.id}/branches/${branch.id}/roles`);
	const { databases } = await neon(`/projects/${project.id}/branches/${branch.id}/databases`);
	const db = databases.find((d) => d.name === 'neondb') ?? databases[0];
	const role =
		roles.find((r) => r.name === db?.owner_name) ?? roles.find((r) => !r.protected) ?? roles[0];
	if (!db || !role) throw new Error('The Neon project has no database or role');

	if (RESET) {
		const r = await neon(
			`/projects/${project.id}/branches/${branch.id}/roles/${encodeURIComponent(role.name)}/reset_password`,
			{ method: 'POST' }
		);
		if (r.role?.password) mask(r.role.password);
		await waitFor(project.id, r.operations);
		console.log('Database password reset: the old one no longer works.');
	}

	const q = new URLSearchParams({
		branch_id: branch.id,
		database_name: db.name,
		role_name: role.name,
		pooled: 'false'
	});
	const { uri } = await neon(`/projects/${project.id}/connection_uri?${q}`);
	const u = new URL(uri);
	mask(u.password);
	u.searchParams.delete('channel_binding');
	if (!u.searchParams.has('sslmode')) u.searchParams.set('sslmode', 'require');
	mask(u.toString());
	if (process.env.GITHUB_ENV) appendFileSync(process.env.GITHUB_ENV, `DATABASE_URL=${u}\n`);
	else console.log('(not in GitHub Actions: address not written anywhere)');
	console.log('Database address ready (hidden).');
}

main().catch((e) => {
	console.log(`::error::${e.message}`);
	process.exit(1);
});
