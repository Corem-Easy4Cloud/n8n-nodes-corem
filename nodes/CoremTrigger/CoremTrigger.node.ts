import type {
	IDataObject,
	IHookFunctions,
	ILoadOptionsFunctions,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
	IWebhookFunctions,
	IWebhookResponseData,
} from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';

export class CoremTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Corem Trigger',
		name: 'coremTrigger',
		icon: { light: 'file:../Corem/corem.svg', dark: 'file:../Corem/corem.dark.svg' },
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["eventType"]}}',
		description: 'Starts the workflow when a Corem event occurs',
		defaults: { name: 'Corem Trigger' },
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'coremApi', required: true }],
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				// Corem calls the webhook asynchronously and does not read the
				// response: acknowledge as soon as the node has parsed the payload.
				responseMode: 'onReceived',
				path: 'webhook',
			},
		],
		properties: [
			{
				displayName: 'Event Type Name or ID',
				name: 'eventType',
				type: 'options',
				typeOptions: { loadOptionsMethod: 'getEventTypes' },
				default: '',
				required: true,
				description: 'The Corem event that starts this workflow. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
			},
		],
	};

	methods = {
		loadOptions: {
			async getEventTypes(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const credentials = await this.getCredentials('coremApi');
				const baseUrl = (credentials.baseUrl as string).replace(/\/+$/, '');

				const response = (await this.helpers.httpRequestWithAuthentication.call(
					this,
					'coremApi',
					{
						method: 'GET',
						url: `${baseUrl}/api/workflow/event-types`,
						qs: { lang: 'en' },
						json: true,
					},
				)) as Array<{ value: string; label: string }>;

				return response.map((eventType) => ({ name: eventType.label, value: eventType.value }));
			},
		},
	};

	webhookMethods = {
		default: {
			// There is no endpoint to look up an existing subscription by event
			// type/URL, but the backend's create call is idempotent (it upserts on
			// clientId + eventType + webhookUrl), so it is safe to always report
			// "not subscribed yet" and let create run again.
			async checkExists(this: IHookFunctions): Promise<boolean> {
				return false;
			},

			async create(this: IHookFunctions): Promise<boolean> {
				const credentials = await this.getCredentials('coremApi');
				const baseUrl = (credentials.baseUrl as string).replace(/\/+$/, '');
				const webhookUrl = this.getNodeWebhookUrl('default');
				const eventType = this.getNodeParameter('eventType') as string;

				const response = (await this.helpers.httpRequestWithAuthentication.call(
					this,
					'coremApi',
					{
						method: 'POST',
						url: `${baseUrl}/api/workflow`,
						body: { eventType, webhookUrl },
						json: true,
					},
				)) as { id: number };

				const staticData = this.getWorkflowStaticData('node');
				staticData.subscriptionId = response.id;

				return true;
			},

			async delete(this: IHookFunctions): Promise<boolean> {
				const staticData = this.getWorkflowStaticData('node') as IDataObject;
				const subscriptionId = staticData.subscriptionId;
				if (subscriptionId === undefined) return true;

				const credentials = await this.getCredentials('coremApi');
				const baseUrl = (credentials.baseUrl as string).replace(/\/+$/, '');

				await this.helpers.httpRequestWithAuthentication.call(this, 'coremApi', {
					method: 'DELETE',
					url: `${baseUrl}/api/workflow/${subscriptionId}`,
					json: true,
				});

				delete staticData.subscriptionId;
				return true;
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const bodyData = this.getBodyData();

		return {
			workflowData: [this.helpers.returnJsonArray(bodyData)],
		};
	}
}
