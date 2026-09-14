import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';
import {
	attendanceFields,
	documentFields,
	emailFields,
	operationProperties,
	requestFields,
	resourceProperty,
	userFields,
} from './CoremProperties';
import { coremMultipartRequest, coremRequest } from './CoremRequest';
import {
	getCompaniesForAttendance,
	getCompaniesForUser,
	getRoles,
	getSitesForAttendance,
	getSitesForDocument,
	getSitesForUser,
	getTeamsForAttendance,
	getTeamsForDocument,
	getUsersForDocument,
} from './loadOptions';

export class Corem implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Corem',
		name: 'corem',
		icon: { light: 'file:corem.svg', dark: 'file:corem.dark.svg' },
		group: ['output'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Interact with Corem (attendance, requests and user management)',
		defaults: { name: 'Corem' },
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		usableAsTool: true,
		credentials: [{ name: 'coremApi', required: true }],
		properties: [
			resourceProperty,
			...operationProperties,
			...emailFields,
			...requestFields,
			...userFields,
			...attendanceFields,
			...documentFields,
		],
	};

	methods = {
		loadOptions: {
			getSitesForUser,
			getCompaniesForUser,
			getRoles,
			getSitesForAttendance,
			getCompaniesForAttendance,
			getTeamsForAttendance,
			getSitesForDocument,
			getTeamsForDocument,
			getUsersForDocument,
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const resource = this.getNodeParameter('resource', 0) as string;
		const operation = this.getNodeParameter('operation', 0) as string;
		const supportedCombinations = [
			'email.send',
			'request.changeStatus',
			'request.get',
			'user.create',
			'user.get',
			'attendance.exportSummary',
			'document.create',
			'document.get',
		];
		if (!supportedCombinations.includes(`${resource}.${operation}`)) {
			throw new NodeOperationError(this.getNode(), `Unsupported operation: ${resource}.${operation}`);
		}

		for (let i = 0; i < items.length; i++) {
			try {
				if (resource === 'email' && operation === 'send') {
					const body = {
						destinatario: this.getNodeParameter('recipient', i) as string,
						oggetto: this.getNodeParameter('subject', i) as string,
						messaggio: this.getNodeParameter('message', i) as string,
					};
					await coremRequest.call(this, 'POST', '/workflow/email', body);
					returnData.push({ json: { success: true }, pairedItem: { item: i } });
					continue;
				}

				if (resource === 'request' && operation === 'changeStatus') {
					const requestId = this.getNodeParameter('requestId', i) as number;
					const comment = this.getNodeParameter('comment', i, '') as string;
					const body = {
						stato: this.getNodeParameter('status', i) as string,
						commento: comment || null,
					};
					await coremRequest.call(this, 'PUT', `/workflow/richieste/${requestId}/stato`, body);
					returnData.push({ json: { success: true }, pairedItem: { item: i } });
					continue;
				}

				if (resource === 'request' && operation === 'get') {
					const requestId = this.getNodeParameter('requestId', i) as number;
					const response = await coremRequest.call(this, 'GET', `/richieste/${requestId}`);
					returnData.push({ json: response as IDataObject, pairedItem: { item: i } });
					continue;
				}

				if (resource === 'user' && operation === 'create') {
					// The password is never requested here: the backend generates it
					// and delivers it to the new user via the welcome email
					// (username + password).
					const additionalFields = this.getNodeParameter('additionalFields', i, {}) as {
						timezone?: string;
						language?: string;
						fiscalCode?: string;
						employeeId?: string;
						dateOfBirth?: string;
						residenceCity?: string;
						residenceAddress?: string;
						iban?: string;
					};
					const body = {
						nome: this.getNodeParameter('firstName', i) as string,
						cognome: this.getNodeParameter('lastName', i) as string,
						email: this.getNodeParameter('email', i) as string,
						username: this.getNodeParameter('username', i) as string,
						sedeId: this.getNodeParameter('siteId', i) as number,
						societaId: this.getNodeParameter('companyId', i) as number,
						ruoloIds: this.getNodeParameter('roleIds', i) as number[],
						timezone: additionalFields.timezone || 'Europe/Rome',
						lingua: additionalFields.language || 'it',
						codiceFiscale: additionalFields.fiscalCode || null,
						matricola: additionalFields.employeeId || null,
						dataNascita: additionalFields.dateOfBirth
							? additionalFields.dateOfBirth.slice(0, 10)
							: null,
						cittaResidenza: additionalFields.residenceCity || null,
						indirizzoResidenza: additionalFields.residenceAddress || null,
						iban: additionalFields.iban || null,
					};
					const response = await coremRequest.call(this, 'POST', '/workflow/utenti', body);
					returnData.push({ json: response as IDataObject, pairedItem: { item: i } });
					continue;
				}

				if (resource === 'user' && operation === 'get') {
					const userId = this.getNodeParameter('userId', i) as number;
					const response = (await coremRequest.call(this, 'GET', '/utenti', undefined, {
						si: 'false',
						utente_id: String(userId),
					})) as IDataObject[];
					const user = response[0];
					if (!user) {
						throw new NodeOperationError(this.getNode(), `User ${userId} not found`, {
							itemIndex: i,
						});
					}
					returnData.push({ json: user, pairedItem: { item: i } });
					continue;
				}

				if (resource === 'attendance' && operation === 'exportSummary') {
					const format = this.getNodeParameter('format', i) as string;
					const startDate = (this.getNodeParameter('startDate', i) as string).slice(0, 10);
					const endDate = (this.getNodeParameter('endDate', i) as string).slice(0, 10);
					const siteId = this.getNodeParameter('siteId', i, '') as string;
					const teamId = this.getNodeParameter('teamId', i, '') as string;
					const companyId = this.getNodeParameter('companyId', i, '') as string;
					const binaryPropertyName = this.getNodeParameter(
						'binaryPropertyName',
						i,
						'data',
					) as string;

					const qs: Record<string, string> = { data_inizio: startDate, data_fine: endDate };
					if (siteId) qs.sede_id = siteId;
					if (teamId) qs.team_id = teamId;
					if (companyId) qs.societa_id = companyId;

					const response = await coremRequest.call(
						this,
						'GET',
						`/presenze/sintetiche/${format}`,
						undefined,
						qs,
						'arraybuffer',
					);

					const binaryData = await this.helpers.prepareBinaryData(
						Buffer.from(response.body as ArrayBuffer),
						`attendance-summary-${startDate}-${endDate}.xlsx`,
					);

					returnData.push({
						json: {},
						binary: { [binaryPropertyName]: binaryData },
						pairedItem: { item: i },
					});
					continue;
				}

				if (resource === 'document' && operation === 'create') {
					const additionalFields = this.getNodeParameter('additionalFields', i, {}) as {
						description?: string;
						readOnly?: boolean;
						siteIds?: number[];
						teamIds?: number[];
						userIds?: number[];
					};
					const inputBinaryField = this.getNodeParameter('inputBinaryField', i) as string;
					const attachment = this.helpers.assertBinaryData(i, inputBinaryField);
					const attachmentBuffer = await this.helpers.getBinaryDataBuffer(i, inputBinaryField);

					const documento = {
						titolo: this.getNodeParameter('title', i) as string,
						descrizione: additionalFields.description || null,
						solaLettura: additionalFields.readOnly ?? false,
						sedeIds: additionalFields.siteIds || [],
						teamIds: additionalFields.teamIds || [],
						utenteIds: additionalFields.userIds || [],
					};

					const response = await coremMultipartRequest.call(this, '/workflow/documenti', documento, {
						buffer: attachmentBuffer,
						filename: attachment.fileName || 'document',
						contentType: attachment.mimeType,
					});
					returnData.push({ json: response as IDataObject, pairedItem: { item: i } });
					continue;
				}

				if (resource === 'document' && operation === 'get') {
					const documentId = this.getNodeParameter('documentId', i) as number;
					const response = await coremRequest.call(this, 'GET', `/documenti/${documentId}`);
					returnData.push({ json: response as IDataObject, pairedItem: { item: i } });
					continue;
				}

			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({ json: { error: (error as Error).message }, pairedItem: { item: i } });
					continue;
				}
				// httpRequestWithAuthentication already wraps HTTP failures into a
				// NodeApiError, stashing Corem's real { code, description } body at
				// error.context.data. `instanceof NodeApiError` is not reliable here
				// (n8n-node dev loads n8n-workflow from a separate copy than the
				// running n8n instance, so the class identity differs) - patch the
				// description structurally instead of branching on instanceof, so
				// this works whether or not the two copies match.
				const wrapped = error as { context?: { data?: { description?: string } }; description?: string };
				const coremDescription = wrapped.context?.data?.description;
				if (coremDescription) wrapped.description = coremDescription;
				throw new NodeApiError(this.getNode(), error as JsonObject, { itemIndex: i });
			}
		}

		return [returnData];
	}
}
