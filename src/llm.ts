import {
	computePromptOpenAI,
	computePromptStreamOpenAI,
	computeTokenCountOpenAI
} from './openai.js';
import { TypedObject } from './typed-object.js';

import {
	CompletionInfo,
	CompletionModelID,
	Environment,
	ModelProvider,
	PromptOptions,
	PromptStream,
	modelProvider
} from './types.js';

import {
	assertUnreachable, mergeObjects
} from './util.js';

export const extractModel = (model : CompletionModelID) : [name : ModelProvider, modelName : string] => {
	const parts = model.split(':');
	if (parts.length != 2) throw new Error('Model didn\'t have : as expected');
	return [modelProvider.parse(parts[0]), parts[1]];
};

const BASE_OPENAI_COMPLETION_INFO = {
	compute: computePromptOpenAI,
	computeStream: computePromptStreamOpenAI
};

export const COMPLETIONS_BY_MODEL : {[name in CompletionModelID] : CompletionInfo } = {
	'openai.com:gpt-3.5-turbo': {
		...BASE_OPENAI_COMPLETION_INFO,
		maxTokens: 4096
	},
	'openai.com:gpt-3.5-turbo-16k': {
		...BASE_OPENAI_COMPLETION_INFO,
		//According to gpt-3.5-turbo-16k
		maxTokens: 16384,
	},
	'openai.com:gpt-4': {
		...BASE_OPENAI_COMPLETION_INFO,
		maxTokens: 8192
	},
	'openai.com:gpt-4-32k': {
		...BASE_OPENAI_COMPLETION_INFO,
		maxTokens: 32768
	},
	'openai.com:gpt-4-1106-preview': {
		...BASE_OPENAI_COMPLETION_INFO,
		maxTokens: 8192,
		supportsJSONResponseFormat: true
	},
	'openai.com:gpt-4-vision-preview': {
		...BASE_OPENAI_COMPLETION_INFO,
		//TODO: is this correct?
		maxTokens: 8192,
		supportsImages: true
	}
};

type ProviderInfo = {
	defaultCompletionModel: CompletionModelID,
	apiKeyVar : keyof Environment
}

export const INFO_BY_PROVIDER : {[name in ModelProvider]: ProviderInfo} = {
	'openai.com': {
		defaultCompletionModel: 'openai.com:gpt-3.5-turbo',
		apiKeyVar: 'openai_api_key'
	}
};

export const computePrompt = async (prompt : string, model: CompletionModelID, env : Environment, opts : PromptOptions = {}) : Promise<string> => {
	//Throw if the completion model is not a valid value

	const [provider, modelName] = extractModel(model);

	const apiKey = env[INFO_BY_PROVIDER[provider].apiKeyVar];
	if (!apiKey) throw new Error ('Unset API key');

	const modelInfo = COMPLETIONS_BY_MODEL[model];

	return modelInfo.compute(modelName, apiKey, prompt, modelInfo, opts);
};

export const computeStream = async (prompt : string, model: CompletionModelID, env : Environment, opts: PromptOptions = {}) : Promise<PromptStream> => {
	//Throw if the completion model is not a valid value

	const [provider, modelName] = extractModel(model);

	const apiKey = env[INFO_BY_PROVIDER[provider].apiKeyVar];
	if (!apiKey) throw new Error ('Unset API key');

	const modelInfo = COMPLETIONS_BY_MODEL[model];

	if (!modelInfo.computeStream) throw new Error(`${modelName} does not support streaming`);

	return modelInfo.computeStream(modelName, apiKey, prompt, modelInfo, opts);
};

export const computeTokenCount = async (text : string, model : CompletionModelID) : Promise<number> => {
	
	const [provider, modelName] = extractModel(model);
	
	//Check to make sure it's a known model in a way that will warn when we add new models.
	switch(provider) {
	case 'openai.com':
		return computeTokenCountOpenAI(modelName, text);
	default:
		assertUnreachable(provider);
	}
	return -1;
};

//Wrap them in one object to pass around instead of passing around state everywhere else.
export class AIProvider {
	_models : CompletionModelID[];
	_env : Environment;
	_opts: PromptOptions;

	//TODO: provide a default models stack

	constructor(model : CompletionModelID | CompletionModelID[], env : Environment, opts : PromptOptions = {}) {
		if (typeof model == 'string') model = [model];
		if (model.length == 0) throw new Error('At least one model must be provided');
		this._models = model;
		this._env = env;
		this._opts = opts;
	}

	modelForOptions(opts : PromptOptions) : CompletionModelID {
		for (const model of this._models) {
			const requirements = opts.modelRequirements;
			if (!requirements) return model;
			const modelInfo = COMPLETIONS_BY_MODEL[model];
			let modelMatches = true;
			for (const key of TypedObject.keys(requirements)) {
				if (!modelMatches) break;
				switch(key) {
				case 'imageInput':
					const requireImage = requirements.imageInput || false;
					if (!requireImage) continue;
					if (!modelInfo.supportsImages) {
						modelMatches = false;
					}
					break;
				case 'jsonResponse':
					const requireJsonResponse = requirements.jsonResponse || false;
					if (!requireJsonResponse) continue;
					if (!modelInfo.supportsJSONResponseFormat) {
						modelMatches = false;
					}
					break;
				default:
					assertUnreachable(key);
				}
			}
			if (modelMatches) return model;
		}
		throw new Error('No model matches requirements');
	}

	async prompt(text : string, opts : PromptOptions = {}) : Promise<string> {
		opts = mergeObjects(this._opts, opts);
		return computePrompt(text, this.modelForOptions(opts), this._env, opts);
	}

	async promptStream(text : string, opts: PromptOptions = {}) : Promise<PromptStream> {
		opts = mergeObjects(this._opts, opts);
		return computeStream(text, this.modelForOptions(opts), this._env, opts);
	}

	async tokenCount(text : string) : Promise<number> {
		return computeTokenCount(text, this.modelForOptions(this._opts));
	}
}