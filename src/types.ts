import {
	z
} from 'zod';

import {
	jsonPatchRFC6902Schema
} from './types_json_patch.js';


import {
	absoluteRegExp
} from './util.js';

import OpenAI from 'openai';

import { Stream } from 'openai/streaming.js';

export const pathSchema = z.string();

export type Path = z.infer<typeof pathSchema>;

export type FinalPath = string;

export type FileListingType = 'file' | 'directory' | 'both';

const DEFAULT_NAME_REGEXP = new RegExp('[a-zA-Z0-9_-]+');

export const SPROUT_BASE_NAME_REG_EX = absoluteRegExp(new RegExp('[a-zA-Z_-][a-zA-Z0-9_-]*'));

export const sproutBaseNameSchema = z.string().regex(SPROUT_BASE_NAME_REG_EX);

export type SproutBaseName = z.infer<typeof sproutBaseNameSchema>;

export const sproutNameSchema = z.string();

export type SproutName = z.infer<typeof sproutNameSchema>;

export const sproutStateSchema = z.record(z.string(), z.unknown());
//The state a given sprout defines. This library doesn't really care too much as long as it's JSONable.
export type SproutState = z.infer<typeof sproutStateSchema>;

//Note: when changing, re-run `npm run generate:schemas` and update README.md's section 'sprout.json fields'
export const sproutConfigSchema = z.object({
	version: z.literal(0),
	title: z.optional(z.string().describe('The title of the sprout')),
	description: z.optional(z.string().describe('A description of the sprout')),
	allowImages : z.optional(z.boolean().describe('Whether the bot allows images')),
	allowFormatting: z.optional(z.boolean().describe('Whether the bot should return markdown formatting'))
});

export type SproutConfig = z.infer<typeof sproutConfigSchema>;

const environmentSchema = z.object({
	openai_api_key : z.string().optional()
});

export type Environment = z.infer<typeof environmentSchema>;

const subInstructionNameSchema = z.string().regex(absoluteRegExp(DEFAULT_NAME_REGEXP));

export type SubInstructionsName = z.infer<typeof subInstructionNameSchema>;

const subInstructionsFilenameSchema = z.string().regex(absoluteRegExp(new RegExp(DEFAULT_NAME_REGEXP.source + '\\.md')));

export type SubInstructionsFilename = z.infer<typeof subInstructionsFilenameSchema>;

const subInstructionRecordSchema = z.object({
	summary: z.string(),
	instructions: z.string()
});

export const subInstructionsMapSchema = z.record(subInstructionNameSchema, subInstructionRecordSchema);

export type SubInstructionsMap = z.infer<typeof subInstructionsMapSchema>;

//TODO: better validation
export const imageURLSchema = z.string();

export type ImageURL = z.infer<typeof imageURLSchema>;

const promptComponentImageSchema = z.object({
	image: imageURLSchema
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
	name: sproutNameSchema,
	config: sproutConfigSchema,
	baseInstructions: z.string(),
	subInstructions: subInstructionsMapSchema,
	schemaText: z.string(),
	starterState: sproutStateSchema
});

export type CompiledSprout = z.infer<typeof compiledSproutSchema>;

export type Fetcher = {
	localWriteablePath : Path;
	pathIsLocalWriteable(path : Path) : boolean;
	fileFetch(path : Path) : Promise<string>;
	fileExists(path : Path) : Promise<boolean>;
	//Returns items in the given directory, not including the directory itself.
	listDirectory(path : Path, type: FileListingType) : Promise<Path[]>;
	listSprouts(basePaths? : string[]) : Promise<Path[]>;
	mayWriteFile(path : Path) : boolean;
	writeFile(path : Path, data : string) : Promise<void>;
};

export type FetcherWithoutListSprouts = Omit<Fetcher, 'listSprouts'>;

export const directoryListingFileSchema = z.object({
	directories: z.array(sproutNameSchema),
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
export type PromptStream = Stream<OpenAI.ChatCompletionChunk>;

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

const conversationMessageUserSchema = z.object({
	speaker: z.literal('user'),
	message: promptSchema
});

const conversationMessageSproutSchema = z.object({
	speaker: z.literal('sprout'),
	message: promptSchema,
	state: sproutStateSchema.optional()
});

export type ConversationMessageSprout = z.infer<typeof conversationMessageSproutSchema>;

const conversationMessageSchema = z.discriminatedUnion('speaker', [conversationMessageUserSchema, conversationMessageSproutSchema]);

export type ConversationMessage = z.infer<typeof conversationMessageSchema>;

const conversationSchema = z.array(conversationMessageSchema);

export type Conversation = z.infer<typeof conversationSchema>;

export type Logger = (...messages : string[]) => void;

//Logs each input with no newlines.
export type StreamLogger = (input : string) => void;

//NOTE: has to be kept in sync manually with DirectoryInfo.
export const directoryInfoSchema : z.Schema<DirectoryInfo> = z.record(
	z.string(),
	z.union([
		z.string(),
		z.lazy(() => directoryInfoSchema)
	])
);

//NOTE: has to be kept in sync manually with directoryInfoSchema.
export type DirectoryInfo = {
	[file : string]: string | DirectoryInfo
}

//NOTE: needs to be kept up to date with file structure in constants.ts
export const packagedSproutSchema = z.object({
	'directory.json': z.string(),
	'sprout.json': z.string(),
	'sprout.compiled.json': z.string(),
	'instructions.md': z.string(),
	'schema.ts': z.string().optional(),
	sub_instructions: z.record(subInstructionsFilenameSchema, z.string()).optional()
});

//TODO: get rid of NakedPackagedSprout
//NOTE: needs to be kept up to date with file structure in constants.ts
export type NakedPackagedSprout = {
	'sprout.json' : string,
	//If changing this location, also change NakedUncompiledPackagedSprout
	'sprout.compiled.json' : string,
	'instructions.md': string,
	//If changing the remaining keys, update NakedUncompiledPackagedSproutNotNeedingAI
	'schema.ts'? : string
	'sub_instructions'?: {
		[mdFile : SubInstructionsFilename]: string
	},
}
export type NakedUncompiledPackagedSprout = Omit<NakedPackagedSprout, 'sprout.compiled.json'>;

//TODO: figur eout a name that's not a pardoy of itself.
export type NakedUncompiledPackagedSproutNotNeedingAI = Omit<NakedUncompiledPackagedSprout, 'schema.ts' | 'sub_instructions'>;

//This type is allowed to be used anywhere a DirectoryInfo is.
export type PackagedSprout = z.infer<typeof packagedSproutSchema>;