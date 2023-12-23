import {
	z
} from 'zod';

import {
	jsonPatchRFC6902Schema
} from './types_json_patch.js';
import OpenAI from 'openai';

export const pathSchema = z.string();

export type Path = z.infer<typeof pathSchema>;

const sproutName = z.string();

export type SproutName = z.infer<typeof sproutName>;

//The state a given sprout defines. This library doesn't really care too much as long as it's JSONable.
export type SproutState = unknown;

export const sproutConfigSchema = z.object({
	version: z.literal(0)
});

export type SproutConfig = z.infer<typeof sproutConfigSchema>;

const environmentSchema = z.object({
	openai_api_key : z.string().optional()
});

export type Environment = z.infer<typeof environmentSchema>;

export const completionModelID = z.enum([
	'openai.com:gpt-3.5-turbo',
	'openai.com:gpt-3.5-turbo-16k',
	'openai.com:gpt-4',
	'openai.com:gpt-4-32k',
	'openai.com:gpt-4-1106-preview'
]);

export type CompletionModelID = z.infer<typeof completionModelID>;

export const modelProvider = z.enum([
	'openai.com'
]);

export type ModelProvider = z.infer<typeof modelProvider>;

export type PromptOptions = {
	jsonResponse? : boolean
};

//TODO: make this a generic type, not relying on OpenAI's structure
export type PromptStream = AsyncIterable<OpenAI.ChatCompletionChunk>;

export type CompletionInfo = {
	maxTokens: number;	
	compute: (modelName : string, apiKey : string, prompt : string, modelInfo: CompletionInfo, opts : PromptOptions) => Promise<string>,
	computeStream?: (modelName : string, apiKey : string, prompt : string, modelInfo: CompletionInfo, opts : PromptOptions) => Promise<PromptStream>,
	supportsJSONResponseFormat?: boolean
};

//TODO: use function calling instead.

//note that sprout.ts:ConversationTurnSchema needs to match this shape.
export const converationTurnSchema = z.object({
	userMessage: z.string().describe('The message that will be shown to the user'),
	patch : jsonPatchRFC6902Schema.describe('The change to make to the current state object based on this turn. If no modification needs to be made, can just be [].')
	//TODO: add a userConcludedConversation boolean, as a way for the LLM to report that the user requested conversation to be over.
});

export type ConversationTurn = z.infer<typeof converationTurnSchema>;

export type Logger = (...messages : string[]) => void;