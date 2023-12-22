import {
	OpenAI
} from 'openai';

//TODO: streaming prompt response too
export const computePromptOpenAI = async (modelName : string, apiKey : string, prompt : string) : Promise<string> => {
	
	const openai = new OpenAI({
		apiKey
	});
	
	const response = await openai.chat.completions.create({
		model: modelName,
		messages: [
			{
				role: 'user',
				content: prompt
			}
		]
		//TODO: allow passing other parameters
	});

	//TODO: ideally we'd have stronger typing here 
	return response.choices[0].message?.content || '';
};

export const computeTokenCountOpenAI = async (_modelName : string,  text : string) : Promise<number> => {
	const tokenizer = await import('gpt-tok');

	return tokenizer.encode(text).length;
};