import type {
	FieldType,
	ILoadOptionsFunctions,
	INodePropertyOptions,
	ResourceMapperField,
	ResourceMapperFields,
} from 'n8n-workflow';

interface TagApiItem {
	etichetta: string;
	tagHTML: string;
	tipo: string;
	metadata?: { valori?: string[] };
}

interface ComposizioneItemApiItem {
	id: number;
	tag: TagApiItem;
	obbligatorio: boolean;
}

interface RequestTypeComposizioneApiResponse {
	modello: { composizione: ComposizioneItemApiItem[] };
}

// Each request type has its own, per-tenant-configurable set of fields (e.g. Leave
// might have "start date/end date", Remote Work just "date"): the backend stores
// them under Tipo Richiesta > Modello > Composizione and there is no fixed schema,
// so it has to be discovered at runtime instead of hardcoded like the other resources.
//
// File attachment fields (tagHTML "file") are excluded: they require a separate
// endpoint (PUT /richieste/{id}/allegato/{datoId}) not handled by the Create operation.
const toResourceMapperField = (item: ComposizioneItemApiItem): ResourceMapperField | null => {
	const { tag } = item;
	const base = {
		id: `dato_${item.id}`,
		displayName: tag.etichetta,
		defaultMatch: false,
		canBeUsedToMatch: false,
		required: item.obbligatorio,
		display: true,
	};

	let type: FieldType;
	let options: INodePropertyOptions[] | undefined;

	switch (tag.tagHTML) {
		case 'date':
			type = 'dateTime';
			break;
		case 'number':
			type = 'number';
			break;
		case 'checkbox':
			type = 'boolean';
			break;
		case 'select':
			type = 'options';
			options = (tag.metadata?.valori ?? []).map((valore) => ({ name: valore, value: valore }));
			break;
		case 'file':
			return null;
		default:
			type = 'string';
	}

	return { ...base, type, options };
};

export async function getRequestFields(
	this: ILoadOptionsFunctions,
): Promise<ResourceMapperFields> {
	const requestTypeId = this.getNodeParameter('requestTypeId') as string;
	if (!requestTypeId) return { fields: [] };

	const credentials = await this.getCredentials('coremApi');
	const baseUrl = (credentials.baseUrl as string).replace(/\/+$/, '');

	const response = (await this.helpers.httpRequestWithAuthentication.call(this, 'coremApi', {
		method: 'GET',
		url: `${baseUrl}/api/richieste/tipi/${requestTypeId}`,
		qs: { composizione: 'true' },
		json: true,
	})) as RequestTypeComposizioneApiResponse;

	const fields = response.modello.composizione
		.map(toResourceMapperField)
		.filter((field): field is ResourceMapperField => field !== null);

	return { fields };
}
