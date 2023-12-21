import {
	openai
} from '@polymath-ai/ai';

//TODO: streaming prompt response too
export const computePromptOpenAI = async (modelName : string, apiKey : string, prompt : string) : Promise<string> => {
	const response = await fetch(openai(apiKey).chatCompletion({
		model: modelName,
		messages: [
			{
				role: 'user',
				content: prompt
			}
		]
		//TODO: allow passing other parameters
	}));

	//TODO: ideally we'd have stronger typing here 
	const result = await response.json();
	return result.choices[0].message?.content || '';
};

export const computeTokenCountOpenAI = async (_modelName : string,  text : string) : Promise<number> => {
	const tokenizer = await import('gpt-tok');

	return tokenizer.encode(text).length;
};