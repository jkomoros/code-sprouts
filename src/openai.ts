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
	
	const stream = await openai.chat.completions.create({
		model: modelName,
		messages: [
			{
				role: 'user',
				content: prompt
			}
		],
		response_format: {
			type: responseType
		},
		stream: true
		//TODO: allow passing other parameters
	});

	return stream;
};

export const computePromptOpenAI = async (modelName : string, apiKey : string, prompt : string, modelInfo : CompletionInfo, opts : PromptOptions) : Promise<string> => {
	//TODO: factor out with computePromptStreamOpenAI
	const openai = new OpenAI({
		apiKey
	});
	
	const responseType = modelInfo.supportsJSONResponseFormat && opts.jsonResponse ? 'json_object' : 'text';
	
	const response = await openai.chat.completions.create({
		model: modelName,
		messages: [
			{
				role: 'user',
				content: prompt
			}
		],
		response_format: {
			type: responseType
		}
		//TODO: allow passing other parameters
	});

	//TODO: ideally we'd have stronger typing here 
	return response.choices[0].message?.content || '';

};

export const computeTokenCountOpenAI = async (_modelName : string,  text : string) : Promise<number> => {
	const tokenizer = await import('gpt-tok');

	return tokenizer.encode(text).length;
};