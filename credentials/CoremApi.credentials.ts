import type {
	ICredentialTestRequest,
	ICredentialType,
	IHttpRequestOptions,
	INodeProperties,
} from 'n8n-workflow';

// Corem is multi-tenant with one subdomain per customer (acme.corem.cloud in
// production): there is no fixed host, so Base URL is always required together
// with the API Key.
export class CoremApi implements ICredentialType {
	name = 'coremApi';

	displayName = 'Corem API';

	icon = { light: 'file:../nodes/Corem/corem.svg', dark: 'file:../nodes/Corem/corem.dark.svg' } as const;

	documentationUrl = 'https://corem.cloud';

	properties: INodeProperties[] = [
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: '',
			placeholder: 'https://acme.corem.cloud',
			description: 'The address of your Corem domain, without a trailing slash',
			required: true,
		},
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			description:
				'The API Key of a Corem service account (Settings > OAuth2.0 > "Service Account"). It is shown only once, when created.',
			required: true,
		},
	];

	// The backend (AccountServizioApiKeyAuthFilter) expects the key in the
	// Api-Key header, not as a Bearer token: the generic httpHeaderAuth
	// shortcut based on Authorization cannot be used here.
	authenticate = {
		type: 'generic',
		properties: {
			headers: {
				'Api-Key': '={{$credentials.apiKey}}',
			},
		},
	} as const;

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl}}/api',
			url: '/workflow/event-types',
			method: 'GET',
		} as IHttpRequestOptions,
	};
}
