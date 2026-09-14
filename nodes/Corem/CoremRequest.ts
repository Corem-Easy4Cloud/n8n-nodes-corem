import type { IDataObject, IExecuteFunctions, IHttpRequestMethods } from 'n8n-workflow';

// Builds the multipart body with Node's built-in FormData/Blob (global since
// Node 18, no import needed) instead of the `form-data` package, so this node
// has zero runtime dependencies. "documento" is appended as a plain string (not
// a Blob) because the backend's Converter<String, CreaDocumentoDto> binds it
// from the part's string value, not via content-negotiated file parsing -
// wrapping it in a Blob would add a filename and make Spring treat it as an
// uploaded file instead.
export async function coremMultipartRequest(
	this: IExecuteFunctions,
	endpoint: string,
	documento: IDataObject,
	file: { buffer: Buffer; filename: string; contentType?: string },
) {
	const credentials = await this.getCredentials('coremApi');
	const baseUrl = (credentials.baseUrl as string).replace(/\/+$/, '');

	const form = new FormData();
	form.append('documento', JSON.stringify(documento));
	form.append(
		'file',
		new Blob([file.buffer], { type: file.contentType || 'application/octet-stream' }),
		file.filename,
	);

	return this.helpers.httpRequestWithAuthentication.call(this, 'coremApi', {
		method: 'POST',
		url: `${baseUrl}/api${endpoint}`,
		body: form as unknown as IDataObject,
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
