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

const sproutState = z.record(z.string(), z.unknown());
//The state a given sprout defines. This library doesn't really care too much as long as it's JSONable.
export type SproutState = z.infer<typeof sproutState>;

//Note: when changing, re-run `npm run generate:schemas`
export const sproutConfigSchema = z.object({
	version: z.literal(0),
	title: z.optional(z.string().describe('The title of the sprout')),
	description: z.optional(z.string().describe('A description of the sprout')),
	allowImages : z.optional(z.boolean().describe('Whether the bot allows images'))
});

export type SproutConfig = z.infer<typeof sproutConfigSchema>;

const environmentSchema = z.object({
	openai_api_key : z.string().optional()
});

export type Environment = z.infer<typeof environmentSchema>;

const subInstructionNameSchema = z.string();

export type SubInstructionsName = z.infer<typeof subInstructionNameSchema>;

const subInstructionRecordSchema = z.object({
	summary: z.string(),
	instructions: z.string()
});

export const subInstructionsMapSchema = z.record(subInstructionNameSchema, subInstructionRecordSchema);

export type SubInstructionsMap = z.infer<typeof subInstructionsMapSchema>;

//TODO: better validation
const imageURL = z.string();

export type ImageURL = z.infer<typeof imageURL>;

const promptComponentImageSchema = z.object({
	image: imageURL
});

export type PromptComponentImage = z.infer<typeof promptComponentImageSchema>;

const promptComponentStringSchema = z.string();

const promptComponentSchema = z.union([promptComponentImageSchema, promptComponentStringSchema]);

export type PromptComponent = z.infer<typeof promptComponentSchema>;

export const promptSchema = z.union([promptComponentSchema, z.array(promptComponentSchema)]);

//Later we'll allow passing images, too.
export type Prompt = z.infer<typeof promptSchema>;

export const compiledSproutSchema = z.object({
	//TODO: should this be a more specific object name, to make it easier to verify it's indeded a sprout when loaded from a random place?
	version: z.literal(0),
	lastUpdated: z.string().datetime(),
	name: sproutName,
	config: sproutConfigSchema,
	baseInstructions: z.string(),
	subInstructions: subInstructionsMapSchema,
	schemaText: z.string(),
	starterState: sproutState
});

export type CompiledSprout = z.infer<typeof compiledSproutSchema>;

type BaseFetcher = {
	fileFetch(path : Path) : Promise<string>;
	fileExists(path : Path) : Promise<boolean>;
	joinPath(...parts : string[]) : Path;
	//Returns items in the given directory, not including the directory itself.
	listDirectory(path : Path) : Promise<Path[]>;
	listSprouts(basePaths? : string[]) : Promise<Path[]>;
};

type ReadOnlyFetcher = BaseFetcher & {
	writable: false
};

type WritableFetcher = BaseFetcher & {
	writable: true,
	writeFile(path : Path, data : string) : Promise<void>;
	//TODO: isn't it kind of weird that this is on writeable? Should I just have a Local or Remote fetcher?
	fileLastUpdated(path : Path) : Promise<Date>;
};

export type Fetcher = ReadOnlyFetcher | WritableFetcher;

export const directoryListingFileSchema = z.object({
	directories: z.array(sproutName),
	files: z.array(z.string())
});

export type DirectoryListingFile = z.infer<typeof directoryListingFileSchema>;

export const completionModelID = z.enum([
	'openai.com:gpt-3.5-turbo',
	'openai.com:gpt-3.5-turbo-16k',
	'openai.com:gpt-4',
	'openai.com:gpt-4-32k',
	'openai.com:gpt-4-1106-preview',
	'openai.com:gpt-4-vision-preview'
]);

export type CompletionModelID = z.infer<typeof completionModelID>;

export const modelProvider = z.enum([
	'openai.com'
]);

export type ModelProvider = z.infer<typeof modelProvider>;

export type PromptOptions = {
	//If provided, will use this model (assuming it matches requirements)
	model? : CompletionModelID,
	jsonResponse? : boolean,
	modelRequirements? : {
		jsonResponse? : boolean,
		imageInput?: boolean
		contextSizeAtLeast? : number
	},
	debugLogger? : Logger
};

//TODO: make this a generic type, not relying on OpenAI's structure
export type PromptStream = AsyncIterable<OpenAI.ChatCompletionChunk>;

export type CompletionInfo = {
	maxTokens: number;	
	compute: (modelName : string, apiKey : string, prompt : Prompt, modelInfo: CompletionInfo, opts : PromptOptions) => Promise<string>,
	computeStream?: (modelName : string, apiKey : string, prompt : Prompt, modelInfo: CompletionInfo, opts : PromptOptions) => Promise<PromptStream>,
	supportsJSONResponseFormat?: boolean,
	supportsImages?: boolean,
	supportsFunctionCalling?: boolean
};

//TODO: use function calling instead.
const defaultConversationTurnSchema = z.object({
	type: z.literal('default'),
	messageForUser: z.string().describe('The message that will be shown to the user'),
	patch : jsonPatchRFC6902Schema.describe('The change to make to the current state object based on this turn. If no modification needs to be made, can just be [].')
	//TODO: add a userConcludedConversation boolean, as a way for the LLM to report that the user requested conversation to be over.
});

const subInstructionTurnSchema = z.object({
	type: z.literal('subInstruction'),
	subInstructionToDescribe: z.string().describe('The subInstruction to have summarized for us, before responding to the user.')
});

//note that sprout.ts:ConversationTurnSchema needs to match this shape.
export const converationTurnSchema = z.union([
	subInstructionTurnSchema,
	defaultConversationTurnSchema
]);

export const strictConversationTurnSchema = z.union([
	subInstructionTurnSchema.strict(),
	defaultConversationTurnSchema.strict()
]);

export const partialConversationTurnSchema = defaultConversationTurnSchema.pick({messageForUser: true}).partial();

export type ConversationTurn = z.infer<typeof converationTurnSchema>;

export type Logger = (...messages : string[]) => void;

//Logs each input with no newlines.
export type StreamLogger = (input : string) => void;