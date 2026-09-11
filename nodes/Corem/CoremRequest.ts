import type { IDataObject, IExecuteFunctions, IHttpRequestMethods } from 'n8n-workflow';

// requestWithAuthentication (the older `request`-library-based helper) is used
// here instead of httpRequestWithAuthentication only for this one case: it
// accepts a plain multipart "formData" object without requiring the `form-data`
// package as a direct dependency of this node (which the httpRequest-based
// modern helper's FormData body type would otherwise require).
export async function coremMultipartRequest(
	this: IExecuteFunctions,
	endpoint: string,
	formData: IDataObject,
) {
	const credentials = await this.getCredentials('coremApi');
	const baseUrl = (credentials.baseUrl as string).replace(/\/+$/, '');

	// eslint-disable-next-line @n8n/community-nodes/no-deprecated-workflow-functions -- see comment above: avoids adding `form-data` as a dependency just for this one multipart call
	return this.helpers.requestWithAuthentication.call(this, 'coremApi', {
		method: 'POST',
		url: `${baseUrl}/api${endpoint}`,
		formData,
		json: true,
	});
}

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
