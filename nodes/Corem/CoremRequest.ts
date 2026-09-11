import type { IDataObject, IExecuteFunctions, IHttpRequestMethods } from 'n8n-workflow';

// Raw requests (used for binary exports) return a Buffer instead of JSON:
// centralize that distinction here so callers only pass an encoding when
// they need one.
export async function coremRequest(
	this: IExecuteFunctions,
	method: IHttpRequestMethods,
	endpoint: string,
	body?: IDataObject,
	qs?: IDataObject,
	encoding?: 'arraybuffer',
) {
	const credentials = await this.getCredentials('coremApi');
	const baseUrl = (credentials.baseUrl as string).replace(/\/+$/, '');

	return this.helpers.httpRequestWithAuthentication.call(this, 'coremApi', {
		method,
		url: `${baseUrl}/api${endpoint}`,
		body,
		qs,
		json: encoding === undefined,
		encoding,
		returnFullResponse: encoding !== undefined,
	});
}
