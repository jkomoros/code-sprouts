import {
	OpenAI
} from 'openai';

import {
	CompletionInfo,
	PromptOptions
} from './types.js';

//TODO: streaming prompt response too
export const computePromptOpenAI = async (modelName : string, apiKey : string, prompt : string, modelInfo : CompletionInfo, opts : PromptOptions) : Promise<string> => {
	
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