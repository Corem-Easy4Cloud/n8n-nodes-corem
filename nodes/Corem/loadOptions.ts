import type { ILoadOptionsFunctions, INodePropertyOptions } from 'n8n-workflow';

interface SiteApiItem {
	id: number;
	nome: string;
}

interface CompanyApiItem {
	id: number;
	ragioneSociale: string;
}

interface RoleApiItem {
	id: number;
	nome: string;
}

interface TeamApiItem {
	id: number;
	nome: string;
}

interface UserApiItem {
	id: number;
	nome: string;
	cognome: string;
}

interface RequestTypeApiItem {
	id: number;
	etichetta: string;
}

// Lists (sites/companies/roles/teams) are not paginated: Corem always
// returns them in full in a single call.
const makeListLoader = <T>(
	endpoint: string,
	params: Record<string, string>,
	toOption: (item: T) => INodePropertyOptions,
) =>
	async function (this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
		const credentials = await this.getCredentials('coremApi');
		const baseUrl = (credentials.baseUrl as string).replace(/\/+$/, '');

		const response = (await this.helpers.httpRequestWithAuthentication.call(this, 'coremApi', {
			method: 'GET',
			url: `${baseUrl}/api${endpoint}`,
			qs: params,
			json: true,
		})) as T[];

		return response.map(toOption);
	};

const siteOption = (site: SiteApiItem): INodePropertyOptions => ({
	name: site.nome,
	value: site.id,
});
const companyOption = (company: CompanyApiItem): INodePropertyOptions => ({
	name: company.ragioneSociale,
	value: company.id,
});
const teamOption = (team: TeamApiItem): INodePropertyOptions => ({
	name: team.nome,
	value: team.id,
});
const roleOption = (role: RoleApiItem): INodePropertyOptions => ({
	name: role.nome,
	value: role.id,
});

// Scoped to the utente.crea permission: the same sites/companies/roles
// visible in the backend's "create user" action.
export const getSitesForUser = makeListLoader<SiteApiItem>(
	'/sedi',
	{ si: 'true', permesso: 'utente.crea' },
	siteOption,
);
export const getCompaniesForUser = makeListLoader<CompanyApiItem>(
	'/societa',
	{ si: 'true', permesso: 'utente.crea' },
	companyOption,
);
// GET /ruoli requires no permission: it already filters to roles assignable
// by the current principal.
export const getRoles = makeListLoader<RoleApiItem>('/ruoli', {}, roleOption);

// Scoped to the presenza.riepilogo permission, distinct from the one used
// for "create user".
export const getSitesForAttendance = makeListLoader<SiteApiItem>(
	'/sedi',
	{ si: 'true', permesso: 'presenza.riepilogo' },
	siteOption,
);
export const getCompaniesForAttendance = makeListLoader<CompanyApiItem>(
	'/societa',
	{ si: 'true', permesso: 'presenza.riepilogo' },
	companyOption,
);
export const getTeamsForAttendance = makeListLoader<TeamApiItem>(
	'/teams',
	{ si: 'true', permesso: 'presenza.riepilogo' },
	teamOption,
);

// Scoped to the documento.crea permission: the sites/teams/users a document
// can actually be shared with by the linked service account.
export const getSitesForDocument = makeListLoader<SiteApiItem>(
	'/sedi',
	{ si: 'true', permesso: 'documento.crea' },
	siteOption,
);
export const getTeamsForDocument = makeListLoader<TeamApiItem>(
	'/teams',
	{ si: 'true', permesso: 'documento.crea' },
	teamOption,
);
// GET /utenti has no si=true/permesso-scoped variant like sedi/societa/teams:
// its scoped variant instead takes "fields" (which fields to return).
export const getUsersForDocument = makeListLoader<UserApiItem>(
	'/utenti',
	{ fields: 'id,nome,cognome', permesso: 'documento.crea' },
	(user) => ({ name: `${user.nome} ${user.cognome}`, value: user.id }),
);

// GET /richieste/tipi?si=true requires no permission: any user who can create or
// list requests can pick any request type, the actual restriction happens at
// POST /richieste time (via the richiesta.crea/aperturaContoTerzi permissions).
export const getRequestTypes = makeListLoader<RequestTypeApiItem>(
	'/richieste/tipi',
	{ si: 'true' },
	(type) => ({ name: type.etichetta, value: type.id }),
);

// Scoped to richiesta.elencaAltrui: the same users whose requests can be listed
// via the "Search" operation.
export const getUsersForRequestSearch = makeListLoader<UserApiItem>(
	'/utenti',
	{ fields: 'id,nome,cognome', permesso: 'richiesta.elencaAltrui' },
	(user) => ({ name: `${user.nome} ${user.cognome}`, value: user.id }),
);

// Scoped to richiesta.aperturaContoTerzi, distinct from the read-only permission
// above: the users a request can actually be created "on behalf of".
export const getUsersForRequestCreate = makeListLoader<UserApiItem>(
	'/utenti',
	{ fields: 'id,nome,cognome', permesso: 'richiesta.aperturaContoTerzi' },
	(user) => ({ name: `${user.nome} ${user.cognome}`, value: user.id }),
);
