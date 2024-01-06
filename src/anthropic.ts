import Anthropic from '@anthropic-ai/sdk';

import {
	CompletionInfo,
	Prompt,
	PromptOptions
} from './types.js';

import {
	textForPrompt
} from './llm.js';

export const computePromptStreamAnthropic = async (modelName : string, apiKey : string, prompt : Prompt, modelInfo : CompletionInfo, _opts : PromptOptions) => {
	const anthropic = new Anthropic({apiKey});
	
	const config : Anthropic.Beta.MessageCreateParamsStreaming = {
		model: modelName,
		messages: [
			{
				role: 'user',
				content: textForPrompt(prompt)
			}
		],
		//Explicitly don't limit max_tokens.
		max_tokens: modelInfo.maxTokens,
		stream: true
	};

	const stream = await anthropic.beta.messages.stream(config);

	return stream;
};

export const computePromptAnthropic = async (modelName : string, apiKey : string, prompt : Prompt, modelInfo : CompletionInfo, _opts : PromptOptions) : Promise<string> => {
	//TODO: factor out with computePromptStreamAnthropic
	const anthropic = new Anthropic({
		apiKey,
	});
	
	
	const config : Anthropic.Beta.MessageCreateParamsNonStreaming = {
		model: modelName,
		messages: [
			{
				role: 'user',
				content: textForPrompt(prompt)
			}
		],
		//Explicitly don't limit max_tokens.
		max_tokens: modelInfo.maxTokens
	};

	const response = await anthropic.beta.messages.create(config);

	const blocks = response.content;

	return blocks.map(block => {
		if (block.type != 'text') throw new Error('Unexpected block type');
		return block.text;
	}).join('\n');

};

export const computeTokenCountAnthropic = async (_modelName : string,  prompt : Prompt) : Promise<number> => {
	//TODO: this is not correct, but the tokenzier does not work in the browser yet: 
	//https://github.com/anthropics/anthropic-tokenizer-typescript/issues/7
	
	//Anthropic's input token window is so high that it doesn't really matter in practice.
	return textForPrompt(prompt).split(' ').length;
};