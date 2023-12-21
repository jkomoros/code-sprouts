import {
	z
} from 'zod';

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
	'openai.com:gpt-4-32k'
]);

export type CompletionModelID = z.infer<typeof completionModelID>;

export const modelProvider = z.enum([
	'openai.com'
]);

export type ModelProvider = z.infer<typeof modelProvider>;

//TODO: note that sprout.ts:ConversationTurnSchema needs to match this shape.
const converationTurnSchema = z.object({
	userMessage: z.string().describe('The message that will be shown to the user'),
	//TODO: also allow JSON Patch (RFC 6902) 
});

export type ConversationTurn = z.infer<typeof converationTurnSchema>;