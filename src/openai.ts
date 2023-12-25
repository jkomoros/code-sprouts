import {
	OpenAI
} from 'openai';

import {
	CompletionInfo,
	Prompt,
	PromptOptions
} from './types.js';

import {
	textForPrompt
} from './llm.js';

import {
	ChatCompletionContentPart
} from 'openai/resources/index.js';

export const computePromptStreamOpenAI = async (modelName : string, apiKey : string, prompt : Prompt, modelInfo : CompletionInfo, opts : PromptOptions) => {
	const openai = new OpenAI({
		apiKey
	});
	
	const responseType = modelInfo.supportsJSONResponseFormat && opts.jsonResponse ? 'json_object' : 'text';
	
	const config : OpenAI.ChatCompletionCreateParamsStreaming = {
		model: modelName,
		messages: [
			{
				role: 'user',
				content: contentForAPI(prompt)
			}
		],
		//Explicitly don't limit max_tokens.
		max_tokens: modelInfo.maxTokens,
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

const urlForImage = (image : Buffer) : OpenAI.ChatCompletionContentPartImage.ImageURL => {
	//TODO: isn't it kind of weird that we do the final sizing etc here?
	//Shouldn't we be passed the buffer at full size and resize here?
	const result = image.toString('base64');
	return {
		url: `data:image/jpeg;base64,${result}`
	};
};

const contentForAPI = (prompt : Prompt) : ChatCompletionContentPart[] => {
	if (!Array.isArray(prompt)) prompt = [prompt];
	return prompt.map((item) : ChatCompletionContentPart => {
		if (typeof item == 'string') {
			return {
				type: 'text',
				text: item
			};
		}
		return {
			type: 'image_url',
			image_url: urlForImage(item.image)
		};
	});
};

export const computePromptOpenAI = async (modelName : string, apiKey : string, prompt : Prompt, modelInfo : CompletionInfo, opts : PromptOptions) : Promise<string> => {
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
				content: contentForAPI(prompt)
			}
		],
		//Explicitly don't limit max_tokens.
		max_tokens: modelInfo.maxTokens
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

export const computeTokenCountOpenAI = async (_modelName : string,  prompt : Prompt) : Promise<number> => {
	const tokenizer = await import('gpt-tok');

	return tokenizer.default.encode(textForPrompt(prompt)).length;
};