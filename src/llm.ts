import {
	computePromptOpenAI,
	computeTokenCountOpenAI
} from './openai.js';

import {
	CompletionModelID,
    Environment,
	ModelProvider,
	modelProvider
} from './types.js';

import {
	assertUnreachable
} from './util.js';

export const extractModel = (model : CompletionModelID) : [name : ModelProvider, modelName : string] => {
	const parts = model.split(':');
	if (parts.length != 2) throw new Error('Model didn\'t have : as expected');
	return [modelProvider.parse(parts[0]), parts[1]];
};

type CompletionInfo = {
	maxTokens: number;	
	compute: (modelName : string, apiKey : string, prompt : string) => Promise<string>
};

export const COMPLETIONS_BY_MODEL : {[name in CompletionModelID] : CompletionInfo } = {
	'openai.com:gpt-3.5-turbo': {
		maxTokens: 4096,
		compute: computePromptOpenAI
	},
	'openai.com:gpt-3.5-turbo-16k': {
		//According to gpt-3.5-turbo-16k
		maxTokens: 16384,
		compute: computePromptOpenAI
	},
	'openai.com:gpt-4': {
		maxTokens: 8192,
		compute: computePromptOpenAI
	},
	'openai.com:gpt-4-32k': {
		maxTokens: 32768,
		compute: computePromptOpenAI
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

export const computePrompt = async (prompt : string, model: CompletionModelID, env : Environment) : Promise<string> => {
	//Throw if the completion model is not a valid value

	const [provider, modelName] = extractModel(model);

	const apiKey = env[INFO_BY_PROVIDER[provider].apiKeyVar];
	if (!apiKey) throw new Error ('Unset API key');

	const modelInfo = COMPLETIONS_BY_MODEL[model];

	return modelInfo.compute(modelName, apiKey, prompt);
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