import {
	OpenAI
} from 'openai';

import {
	CompletionInfo,
	PromptOptions
} from './types.js';

export const computePromptStreamOpenAI = async (modelName : string, apiKey : string, prompt : string, modelInfo : CompletionInfo, opts : PromptOptions) => {
	const openai = new OpenAI({
		apiKey
	});
	
	const responseType = modelInfo.supportsJSONResponseFormat && opts.jsonResponse ? 'json_object' : 'text';
	
	const config : OpenAI.ChatCompletionCreateParamsStreaming = {
		model: modelName,
		messages: [
			{
				role: 'user',
				content: prompt
			}
		],
		stream: true
	};

	if (modelInfo.supportsJSONResponseFormat) {
		config.response_format = {
			type: responseType
		};
	}

	const stream = await openai.chat.completions.create(config);

	return stream;
};

export const computePromptOpenAI = async (modelName : string, apiKey : string, prompt : string, modelInfo : CompletionInfo, opts : PromptOptions) : Promise<string> => {
	//TODO: factor out with computePromptStreamOpenAI
	const openai = new OpenAI({
		apiKey
	});
	
	const responseType = modelInfo.supportsJSONResponseFormat && opts.jsonResponse ? 'json_object' : 'text';
	
	const config : OpenAI.ChatCompletionCreateParamsNonStreaming = {
		model: modelName,
		messages: [
			{
				role: 'user',
				content: prompt
			}
		]
	};

	if (modelInfo.supportsJSONResponseFormat) {
		config.response_format = {
			type: responseType
		};
	}

	const response = await openai.chat.completions.create(config);

	//TODO: ideally we'd have stronger typing here 
	return response.choices[0].message?.content || '';

};

export const computeTokenCountOpenAI = async (_modelName : string,  text : string) : Promise<number> => {
	const tokenizer = await import('gpt-tok');

	return tokenizer.encode(text).length;
};