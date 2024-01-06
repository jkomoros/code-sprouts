
import {
	computePromptAnthropic,
	computePromptStreamAnthropic, 
	computeTokenCountAnthropic
} from './anthropic.js';

import {
	computePromptOpenAI,
	computePromptStreamOpenAI,
	computeTokenCountOpenAI
} from './openai.js';

import {
	TypedObject
} from './typed-object.js';

import {
	CompletionInfo,
	CompletionModelID,
	APIKeys,
	ModelProvider,
	Prompt,
	PromptComponentImage,
	PromptOptions,
	PromptStream,
	modelProvider
} from './types.js';

import {
	assertUnreachable,
	mergeObjects
} from './util.js';

import {
	ChatCompletionChunk
} from 'openai/resources/index.js';

import {
	MessageStreamEvent
} from '@anthropic-ai/sdk/resources/beta/messages.js';

export const extractModel = (model : CompletionModelID) : [name : ModelProvider, modelName : string] => {
	const parts = model.split(':');
	if (parts.length != 2) throw new Error('Model didn\'t have : as expected');
	return [modelProvider.parse(parts[0]), parts[1]];
};

const BASE_OPENAI_COMPLETION_INFO = {
	compute: computePromptOpenAI,
	computeStream: computePromptStreamOpenAI
};

const BASE_ANTHROPIC_COMPLETION_INFO = {
	compute: computePromptAnthropic,
	computeStream: computePromptStreamAnthropic
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
		maxTokens: 8192,
		supportsFunctionCalling: true
	},
	'openai.com:gpt-4-32k': {
		...BASE_OPENAI_COMPLETION_INFO,
		maxTokens: 32768,
		supportsFunctionCalling: true
	},
	'openai.com:gpt-4-1106-preview': {
		...BASE_OPENAI_COMPLETION_INFO,
		maxTokens: 4096,
		supportsJSONResponseFormat: true,
		supportsFunctionCalling: true
	},
	'openai.com:gpt-4-vision-preview': {
		...BASE_OPENAI_COMPLETION_INFO,
		maxTokens: 4096,
		supportsImages: true
	},
	'anthropic.com:claude-2.1': {
		...BASE_ANTHROPIC_COMPLETION_INFO,
		maxTokens: 4096
	}
};

export const DEFAULT_MODEL_STACK : CompletionModelID[] = [
	//Use the default small model
	'openai.com:gpt-4',
	//Use the new one if necessary
	'openai.com:gpt-4-1106-preview',
	//Use the long one if necessary
	'openai.com:gpt-4-32k',
	//Use the image one if necessary
	'openai.com:gpt-4-vision-preview'
];

type ProviderInfo = {
	defaultCompletionModel: CompletionModelID,
}

export const INFO_BY_PROVIDER : {[name in ModelProvider]: ProviderInfo} = {
	'openai.com': {
		defaultCompletionModel: 'openai.com:gpt-3.5-turbo',
	},
	'anthropic.com': {
		defaultCompletionModel: 'anthropic.com:claude-2.1',
	}
};

export const computePrompt = async (prompt : Prompt, model: CompletionModelID, keys : APIKeys, opts : PromptOptions = {}) : Promise<string> => {
	//Throw if the completion model is not a valid value

	const [provider, modelName] = extractModel(model);

	const apiKey = keys[provider];
	if (!apiKey) throw new Error ('Unset API key');

	const modelInfo = COMPLETIONS_BY_MODEL[model];

	if (promptIncludesImage(prompt) && !modelInfo.supportsImages) throw new Error('Prompt includes an image, but for a prompt type that doesnt support images');

	return modelInfo.compute(modelName, apiKey, prompt, modelInfo, opts);
};

export const computeStream = async (prompt : Prompt, model: CompletionModelID, keys : APIKeys, opts: PromptOptions = {}) : Promise<PromptStream> => {
	//Throw if the completion model is not a valid value

	const [provider, modelName] = extractModel(model);

	const apiKey = keys[provider];
	if (!apiKey) throw new Error ('Unset API key');

	const modelInfo = COMPLETIONS_BY_MODEL[model];

	if (promptIncludesImage(prompt) && !modelInfo.supportsImages) throw new Error('Prompt includes an image, but for a prompt type that doesnt support images');

	if (!modelInfo.computeStream) throw new Error(`${modelName} does not support streaming`);

	return modelInfo.computeStream(modelName, apiKey, prompt, modelInfo, opts);
};

export const computeTokenCount = async (text : Prompt, model : CompletionModelID) : Promise<number> => {
	
	const [provider, modelName] = extractModel(model);
	
	//Check to make sure it's a known model in a way that will warn when we add new models.
	switch(provider) {
	case 'openai.com':
		return computeTokenCountOpenAI(modelName, text);
	case 'anthropic.com':
		return computeTokenCountAnthropic(modelName, text);
	default:
		assertUnreachable(provider);
	}
	return -1;
};

const modelMatches = (model : CompletionModelID, opts : PromptOptions = {}) : boolean => {
	const requirements = opts.modelRequirements;
	if (!requirements) return true;
	const modelInfo = COMPLETIONS_BY_MODEL[model];
	for (const key of TypedObject.keys(requirements)) {
		if (!modelMatches) break;
		switch(key) {
		case 'imageInput':
			const requireImage = requirements.imageInput || false;
			if (!requireImage) continue;
			if (!modelInfo.supportsImages) return false;
			break;
		case 'jsonResponse':
			const requireJsonResponse = requirements.jsonResponse || false;
			if (!requireJsonResponse) continue;
			if (!modelInfo.supportsJSONResponseFormat) return false;
			break;
		case 'contextSizeAtLeast':
			const contextSizeAtLeast = requirements.contextSizeAtLeast || -1;
			if (contextSizeAtLeast < 0) continue;
			if (modelInfo.maxTokens < contextSizeAtLeast) return false;
			break;
		case 'modelProvider':
			let modelProvider = requirements.modelProvider;
			if (!modelProvider) continue;
			if (!Array.isArray(modelProvider)) modelProvider = [modelProvider];
			const [provider] = extractModel(model);
			if (!modelProvider.includes(provider)) return false;
			break;
		default:
			assertUnreachable(key);
		}
	}
	return true;
};

const IMAGE_DATA_PLACEHOLDER = '<image-data>';

export const textForPrompt = (prompt : Prompt, includeImageNote = false) : string => {
	if (!Array.isArray(prompt)) prompt = [prompt];
	const result : string[] = [];
	for (const part of prompt) {
		if (typeof part == 'string') {
			result.push(part);
			continue;
		}
		if (part.image) {
			if (includeImageNote) result.push(IMAGE_DATA_PLACEHOLDER);
			continue;
		}
		throw new Error(`Unknown prompt part ${JSON.stringify(part)}`);
	}
	return result.join('\n');
};

export const promptIncludesImage = (prompt : Prompt) : boolean => {
	return promptImages(prompt).length > 0;
};

export const promptImages = (prompt : Prompt) : PromptComponentImage[] => {
	if (!Array.isArray(prompt)) prompt = [prompt];
	return prompt.filter(item => typeof item == 'object' && item.image) as PromptComponentImage[];
};

export const debugTextForPrompt = (prompt : Prompt) : string => {
	if (!Array.isArray(prompt)) prompt = [prompt];
	const result : string[] = [];
	for (const part of prompt) {
		if (typeof part == 'string') {
			result.push(part);
			continue;
		}
		let actualPart : unknown = part;
		if (part.image) {
			actualPart = {
				image: IMAGE_DATA_PLACEHOLDER
			};
		}
		result.push(JSON.stringify(actualPart, null, '\t'));
	}
	return result.join('\n');
};

//Wrap them in one object to pass around instead of passing around state everywhere else.
export class AIProvider {
	private _models : CompletionModelID[];
	private _keys : APIKeys;
	private _opts: PromptOptions;

	constructor(keys : APIKeys = {}, model : CompletionModelID | CompletionModelID[] = DEFAULT_MODEL_STACK, opts : PromptOptions = {}) {
		if (typeof model == 'string') model = [model];
		if (model.length == 0) throw new Error('At least one model must be provided');
		this._models = model;
		this._keys = keys;
		this._opts = opts;
	}

	modelForOptions(opts : PromptOptions) : CompletionModelID {
		if (opts.model) {
			if (!modelMatches(opts.model, opts)) throw new Error(`model ${opts.model} provided, but it does not match provided requirements`);
			return opts.model;
		}
		for (const model of this._models) {
			if (modelMatches(model, opts)) return model;
		}
		throw new Error('No model matches requirements');
	}

	private async extendPromptOptionsWithExtras(prompt: Prompt, input : PromptOptions) : Promise<PromptOptions> {
		//TODO: once there are multiple providers, we don't know which tokenCount to use for them if the model isn't provided.
		const tokenCount = await this.tokenCount(prompt, input);
		const result = {
			...input
		};
		if (!result.modelRequirements) result.modelRequirements = {};
		result.modelRequirements = {
			...result.modelRequirements,
			contextSizeAtLeast: tokenCount	
		};
		//Set a constraint on the model for the providers we have keys for.
		const providersWithAPIKeys = TypedObject.keys(this._keys).filter(key => this._keys[key]);
		//Only set a constraint if we only have a subset of keys available.
		if (providersWithAPIKeys.length != modelProvider.options.length) {

			//We want to filter down the implicit or explciit set of providers to only the ones we have keys for.
			//If it's not explicitly set, then that implicitly means "all of them match".
			let baseProviders = result.modelRequirements.modelProvider || modelProvider.options;
			if (!Array.isArray(baseProviders)) baseProviders = [baseProviders];
			const filteredProviders = baseProviders.filter(provider => providersWithAPIKeys.includes(provider));

			//This list might be [] if there are no keys, which is fine, because then there are no models that should match.
			result.modelRequirements.modelProvider = filteredProviders;
		}
		return result;
	}

	async prompt(prompt: Prompt, opts : PromptOptions = {}) : Promise<{model: CompletionModelID, result: string}> {
		opts = mergeObjects(this._opts, opts);
		opts = await this.extendPromptOptionsWithExtras(prompt, opts);
		const model = this.modelForOptions(opts);
		if (opts.debugLogger) opts.debugLogger(`Using model ${model}`);
		const result = await computePrompt(prompt, model, this._keys, opts);
		return {
			model,
			result
		};
	}

	async promptStream(prompt : Prompt, opts: PromptOptions = {}) : Promise<{model: CompletionModelID, stream: PromptStream}> {
		opts = mergeObjects(this._opts, opts);
		opts = await this.extendPromptOptionsWithExtras(prompt, opts);
		const model = this.modelForOptions(opts);
		if (opts.debugLogger) opts.debugLogger(`Using model ${model}`);
		const stream = await computeStream(prompt, model, this._keys, opts);
		return {
			model,
			stream
		};
	}

	async tokenCount(prompt : Prompt, opts : PromptOptions = {}) : Promise<number> {
		opts = mergeObjects(this._opts, opts);
		const model = this.modelForOptions(opts);
		return computeTokenCount(prompt, model);
	}
}

export const extractStreamChunk = (chunk : ChatCompletionChunk | MessageStreamEvent) : string => {
	if (!('choices' in chunk)) {
		//TODO: support anthropic
		throw new Error('Anthropic chunk type not supported yet');
	}
	if (chunk.choices.length == 0) throw new Error('No choices');
	const choice = chunk.choices[0];
	if (choice.finish_reason && choice.finish_reason != 'stop') throw new Error(`Unexpected chunk stop reason: ${choice.finish_reason}`);
	const content = choice.delta.content || '';
	return content;
};