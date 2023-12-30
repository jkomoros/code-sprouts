import fetcherImpl from './fetcher-browser.js';

import {
	AIProvider,
	debugTextForPrompt,
	promptImages,
	promptIncludesImage,
	textForPrompt
} from './llm.js';

import {
	CompiledSprout,
	Fetcher,
	Logger,
	Path,
	Prompt,
	SproutConfig,
	SproutName,
	SproutState,
	StreamLogger,
	SubInstructionsMap,
	SubInstructionsName,
	compiledSproutSchema,
	partialConversationTurnSchema,
	sproutConfigSchema,
	strictConversationTurnSchema
} from './types.js';

import {
	StreamingJSONParser
} from './streaming-json.js';

import {
	SPROUT_COMPILED_PATH,
	SPROUT_CONFIG_PATH,
	SPROUT_INSTRUCTIONS_PATH,
	SPROUT_SCHEMA_PATH,
	BASE_SPROUT_PATHS,
	BASE_SPROUT_DIRECTORIES,
	FILE_EXTENSIONS_IN_SPROUT,
	SPROUT_SUBINSTUCTIONS_DIR,
	DIRECTORY_LISTING_FILE
} from './constants.js';

import {
	z
} from 'zod';

import fastJSONPatch from 'fast-json-patch';
import { joinPath } from './util.js';
import { ConversationSignaller } from './signaller.js';

//A manual conversion of types.ts:conversationTurnSchema
const CONVERSATION_TURN_SCHEMA_FIRST_PART = `type ConversationTurn = {
	type: 'subInstruction';
	//The subInstruction to have summarized for us, before responding to the user.
	subInstructionToDescribe: {{SUB_INSTRUCTION_NAMES}};
} | `;
const CONVERSATION_TURN_SCHEMA_SECOND_PART = `{
  type: 'default',
  //The message that will be shown to the user.
  messageForUser: string
  //The change to make to the current state object based on this turn. If no modification needs to be made, can just be [].
  patch : JSONPatchRFC6902
}`;

const CONVERSATION_TURN_SCHEMA = CONVERSATION_TURN_SCHEMA_FIRST_PART + CONVERSATION_TURN_SCHEMA_SECOND_PART;

const conversationTurnSchema = (subInstructions : SubInstructionsMap) : string => {
	if (Object.keys(subInstructions).length == 0) return CONVERSATION_TURN_SCHEMA_SECOND_PART;
	const subInstructionNames = Object.keys(subInstructions).map(name => `'${name}'`).join(' | ');
	return CONVERSATION_TURN_SCHEMA.replace('{{SUB_INSTRUCTION_NAMES}}', subInstructionNames);
};

//Set true while debugging
const AGGRESSIVE_LOGGING = false;

type SproutOptions = {
	ai? : AIProvider,
	debugLogger? : Logger,
	//If true, and a file is not compiled, it will fail.
	disallowCompilation? : boolean
};

export type ConversationTurnOptions = {
	//Will be called with streaming incremental user-visible results.
	streamLogger? : StreamLogger,
	//Will be called with full messages
	debugLogger? : Logger,
	//Will be called with streaming raw turn object results
	debugStreamLogger? : Logger,
	subInstruction? : SubInstructionsName
}

let fetcher : Fetcher = fetcherImpl;

export class Sprout {
	private _path : Path;
	private _config?: SproutConfig;
	// A null means it is affirmatively non existent.
	private _compiledData? : CompiledSprout | null;
	private _baseInstructions? : string;
	private _subInstructions? : SubInstructionsMap;
	private _schemaText? : string;
	private _aiProvider? : AIProvider;
	private _disallowCompilation : boolean;
	private _debugLogger? : Logger;
	private _userMessages : Prompt[];
	private _states: SproutState[];

	static setFetcher(input : Fetcher) : void {
		fetcher = input;
	}

	constructor(path : Path, opts : SproutOptions = {}) {
		const {
			ai,
			debugLogger,
			disallowCompilation
		} = opts;
		this._path = path;
		this._aiProvider = ai;
		this._debugLogger = debugLogger;
		this._disallowCompilation = Boolean(disallowCompilation);
		this._userMessages = [];
		this._states = [];
	}

	get name() : SproutName {
		//TODO: return the last path component
		return this._path;
	}

	async allowImages() : Promise<boolean> {
		const config = await this.config();
		if(!config.allowImages) return false;
		if (!this._aiProvider) throw new Error('This currently requires an AI provider');
		try {
			this._aiProvider.modelForOptions({
				modelRequirements: {
					imageInput: true
				}
			});
			return true;
		} catch(err) {
			return false;
		}
	}

	async compiled() : Promise<boolean> {
		const compiled = await this._compiled();
		return Boolean(compiled);
	}

	async compile() : Promise<void> {
		if (await this.compiled()) {
			if (this._debugLogger) this._debugLogger(`${this.name}: Already compiled`);
			return;
		}
		if (!fetcher.writable) {
			if (this._debugLogger) this._debugLogger(`${this.name}: Not writable, not compiling`);
			return;
		}
		const result : CompiledSprout = {
			version: 0,
			lastUpdated: new Date().toISOString(),
			name: this.name,
			config: await this.config(),
			baseInstructions: await this.baseInstructions(),
			subInstructions: await this.subInstructions(),
			schemaText: await this.schemaText(),
			starterState: await this.starterState()
		};
		if (this._debugLogger) this._debugLogger(`${this.name}: Compiling`);
		fetcher.writeFile(joinPath(this._path, SPROUT_COMPILED_PATH), JSON.stringify(result, null, '\t'));
		this._compiledData = result;
	}

	private async _filesToCheckForCompilation() : Promise<Path[]> {
		const result = [...BASE_SPROUT_PATHS];
		for (const directory of BASE_SPROUT_DIRECTORIES) {
			const items = await fetcher.listDirectory(joinPath(this._path, directory));
			for (const item of items) {
				if (!FILE_EXTENSIONS_IN_SPROUT.some(ext => item.endsWith(ext))) continue;
				if (item == DIRECTORY_LISTING_FILE) continue;
				result.push(joinPath(directory, item));
			}
		}
		return result;
	}

	private async _compiled() : Promise<CompiledSprout | null> {
		if (this._compiledData === undefined) {
			const compiledSproutPath = joinPath(this._path, SPROUT_COMPILED_PATH);
			if (await fetcher.fileExists(compiledSproutPath)) {
				const compiledData = await fetcher.fileFetch(compiledSproutPath);
				//Tnis will throw if invalid shape.
				const parseResult = compiledSproutSchema.safeParse(JSON.parse(compiledData));
				if (parseResult.success) {
					const data = parseResult.data;
					const compiledLastUpdated = new Date(data.lastUpdated);
					//TODO: we use fetcher.writable as a proxy for "can do quick last-updated checks".
					if (fetcher.writable) {
						for (const file of await this._filesToCheckForCompilation()) {
							const path = joinPath(this._path, file);
							if (!await fetcher.fileExists(path)) continue;
							const lastUpdated = await fetcher.fileLastUpdated(path);
							if (lastUpdated > compiledLastUpdated) {
								//If any of the base files are newer than the compiled file, we need to recompile.
								this._compiledData = null;
								if(this._debugLogger) this._debugLogger(`${this.name}: Compiled file out of date: ${path} is newer than ${compiledSproutPath}`);
								return null;
							}
						}
					}
					this._compiledData = data;
				} else {
					if(this._debugLogger) this._debugLogger(`${this.name}: Compiled file invalid: ${JSON.stringify(parseResult.error.errors, null, '\t')}`);
					this._compiledData = null;
				}
			} else {
				if(this._debugLogger) this._debugLogger(`${this.name}: No compiled file`);
				this._compiledData = null;
			}
		}
		if (!this._compiledData && this._disallowCompilation) throw new Error(`${this.name}: No compiled file and disallowCompilation is true`);
		return this._compiledData;
	}

	async config() : Promise<SproutConfig> {
		const compiled = await this._compiled();
		if(compiled) return compiled.config;

		if (!this._config) {
			const sproutConfigPath = joinPath(this._path, SPROUT_CONFIG_PATH);
			if (!await fetcher.fileExists(sproutConfigPath)) {
				throw new Error(`${this.name}: Config file ${sproutConfigPath} not found`);
			}
			const configData = await fetcher.fileFetch(sproutConfigPath);
			//Tnis will throw if invalid shape.
			const config = sproutConfigSchema.parse(JSON.parse(configData));
			if (!config) throw new Error(`${this.name}: No config`);
			this._config = config;
		}
		if (!this._config) throw new Error(`${this.name}: Couldn't create sprout`);
		return this._config;
	}

	async baseInstructions() : Promise<string> {
		const compiled = await this._compiled();
		if(compiled) return compiled.baseInstructions;

		if (this._baseInstructions === undefined) {
			const sproutInstructionsPath = joinPath(this._path, SPROUT_INSTRUCTIONS_PATH);
			if (!await fetcher.fileExists(sproutInstructionsPath)) {
				throw new Error(`${this.name}: Instruction file ${sproutInstructionsPath} not found`);
			}
			this._baseInstructions = await fetcher.fileFetch(sproutInstructionsPath);
		}
		if (this._baseInstructions === undefined) throw new Error(`${this.name}: No instructions`);
		return this._baseInstructions;
	}

	async subInstructions() : Promise<SubInstructionsMap> {
		const compiled = await this._compiled();
		if(compiled) return compiled.subInstructions;

		if (this._subInstructions === undefined) {
			this._subInstructions = {};
			//TODO: make sure this will return [] if the directory doesn't exist.
			const items = await fetcher.listDirectory(joinPath(this._path, SPROUT_SUBINSTUCTIONS_DIR));
			for (const item of items) {
				const path = joinPath(this._path, SPROUT_SUBINSTUCTIONS_DIR, item);
				if (!path.endsWith('.md')) continue;
				const instructions = await fetcher.fileFetch(path);
				const name = item.replace(/\.md$/, '');
				const summary = await this.summaryForSubInstruction(instructions);
				this._subInstructions[name] = {
					summary,
					instructions
				};
			}
		}
		if (this._subInstructions === undefined) throw new Error(`${this.name}: No sub-instructions`);
		return this._subInstructions;
	}

	private async summaryForSubInstruction(instruction : string) : Promise<string> {
		const prompt = `Provide a short summary (no longer than 10 words) for the following instructions:

${instruction}

----
Return a json object matching this schema:
type Result = {
	summary: string
}`;

		if (!this._aiProvider) throw new Error('This currently requires an AI provider');
		const summary = await this._aiProvider.prompt(prompt, {
			jsonResponse: true,
			modelRequirements: {
				jsonResponse: true,
			}
		});

		const json = JSON.parse(summary);
		const summarySchema = z.object({
			summary: z.string()
		});
		const result = summarySchema.parse(json);
		return result.summary;
	}

	async schemaText() : Promise<string> {
		const compiled = await this._compiled();
		if(compiled) return compiled.schemaText;

		if (this._schemaText === undefined) {
			const sproutSchemaPath = joinPath(this._path, SPROUT_SCHEMA_PATH);
			if (!await fetcher.fileExists(sproutSchemaPath)) {
				throw new Error(`${this.name}: Schema file ${sproutSchemaPath} not found`);
			}
			//TODO: validate this is valid typescript
			this._schemaText = await fetcher.fileFetch(sproutSchemaPath);
		}
		if (this._schemaText === undefined) throw new Error(`${this.name}: No schema`);
		return this._schemaText;
	}

	//throws if invalid
	async validate() : Promise<void> {
		//Will throw if invalid
		await this.config();
		await this.baseInstructions();
		await this.schemaText();
	}

	async starterState() : Promise<SproutState> {
		const compiled = await this._compiled();
		if(compiled) return compiled.starterState;
		//TODO: don't use an LLM for this / cache the result so we don't have to run it each time
		if (!this._aiProvider) throw new Error('This currently requires an AI provider');
		const schemaText = await this.schemaText();
		const prompt = `Return the JSON of a default/empty object conforming to this typescript schema (following comments on defaults):
${schemaText}
`;
		const rawJSON = await this._aiProvider.prompt(prompt, {
			jsonResponse: true,
			modelRequirements: {
				jsonResponse: true
			}
		});
		return JSON.parse(rawJSON);
	}

	async lastState() : Promise<SproutState> {
		if (this._states.length == 0) {
			this._states.push(await this.starterState());
		}
		return this._states[this._states.length -1];
	}

	//Returns the next prompt to return.
	async prompt(subInstruction? : SubInstructionsName) : Promise<Prompt> {
		const baseInstructions = await this.baseInstructions();
		const schemaText = await this.schemaText();

		const state = await this.lastState();

		const config = await this.config();

		const subInstructions = await this.subInstructions();

		if (subInstruction && !subInstructions[subInstruction]) throw new Error(`No sub-instruction ${subInstruction}`);

		const previousUserMessages = this._userMessages.slice(0, this._userMessages.length - 1);
		const lastUserMessage = this._userMessages[this._userMessages.length - 1];

		const instructions = `${baseInstructions}

You will manage your state in an object conforming to the following schema:
${schemaText}

When relevant or requested, summarize the state in a way that a non-technical user would understand. If the user explicitly asks what is in the state object, reproduce it exactly.

${subInstruction ? `Here is information on the sub-instruction ${subInstruction}:\n${subInstructions[subInstruction].instructions}` :
		Object.keys(subInstructions).length ? `Here are sub-instructions you can request information on providing their name:
		${Object.entries(subInstructions).map(([name, info]) => `* '${name}': ${info.summary}`).join('\n')}` :
			''}

Your current state is:
${JSON.stringify(state, null, '\t')}

${previousUserMessages.length ? 'The previous user messages (for context only):\n' + previousUserMessages.map(message => textForPrompt(message)).join('\n---\n') + '\n---\n' : ''}

The last user message (VERY IMPORTANT that you respond to this):

${lastUserMessage ? textForPrompt(lastUserMessage) + '\n---\n' : '<INITIAL>\n---\n'}

It is VERY IMPORTANT that you should respond with only a literal JSON object (not wrapped in markdown formatting or other formatting) matching this schema:
${conversationTurnSchema(subInstruction ? {} : subInstructions)}

${config.allowImages ? 'You can also accept images as input. If you are provided an image, give a more descriptive natural language description of the state change you make in response to the image.' : 'You are not configured to receive images from the user'}

Provide a patch to update the state object based on the users's last message and your response.`;

		if (!this._userMessages.length) return instructions;

		const lastMessage = this._userMessages[this._userMessages.length - 1];
		if (promptIncludesImage(lastMessage)) {
			return [
				instructions,
				...promptImages(lastMessage)
			];
		}

		return instructions;

	}

	provideUserResponse(response : Prompt) : void {
		this._userMessages.push(response);
	}

	/*
		conversationTurn does the next LLM turn of a discussion, as visible to a
		user.

		It prompts the LLM with the current state and last received user message
		(via provideUserResponse).

		It returns the next message to show to the user. The calling context
		should display it to the user, pass any new response from a user via
		provideUserResponse, and then call conversationTurn() again.
	*/
	async conversationTurn(opts : ConversationTurnOptions = {}) : Promise<string> {
		const {debugLogger, debugStreamLogger, streamLogger, subInstruction} = opts;
		if (!this._aiProvider) throw new Error('No AI provider');
		const config = await this.config();
		const prompt = await this.prompt(subInstruction);
		const promptHasImages = promptIncludesImage(prompt);
		if (!config.allowImages && promptHasImages) throw new Error('Prompt includes images but images are not allowed');
		if (debugLogger) debugLogger(`Prompt:\n${debugTextForPrompt(prompt)}`);
		const stream = await this._aiProvider.promptStream(prompt, {
			jsonResponse: true,
			debugLogger,
			modelRequirements: {
				//It's not possible to allowImages and imageInput at the same time currently, because no openai model allows both.
				jsonResponse: !promptHasImages,
				imageInput: promptHasImages
			}
		});
		const parser = new StreamingJSONParser();
		for await (const chunk of stream) {
			if (chunk.choices.length == 0) throw new Error('No choices');
			if (debugLogger && AGGRESSIVE_LOGGING) debugLogger('Chunk:\n' + JSON.stringify(chunk, null, '\t'));
			const choice = chunk.choices[0];
			if (choice.finish_reason && choice.finish_reason != 'stop') throw new Error(`Unexpected chunk stop reason: ${choice.finish_reason}`);
			const content = choice.delta.content || '';
			const incrementalUserMessage = parser.incrementalProperty(content, (input: unknown) : string => {
				return partialConversationTurnSchema.parse(input).messageForUser || '';
			});
			if (debugStreamLogger) debugStreamLogger(content);
			if (streamLogger) streamLogger(incrementalUserMessage);
		}
		//Add a newline at the end for the next line
		if (streamLogger) streamLogger('\n');
		if (debugLogger && AGGRESSIVE_LOGGING) {
			debugLogger(`Raw Turn: ${parser.rawInput}`);
			debugLogger(`Trimmed Turn: ${parser.input}`);
		}
		let turnJSON : unknown = {};
		try {
			turnJSON = parser.json();
		} catch(err) {
			throw new Error(`Could not parse JSON: ${parser.input}: ${err}`);
		}
		if (!turnJSON) throw new Error('Empty json');
		const turn = strictConversationTurnSchema.parse(turnJSON);
		if (debugLogger) debugLogger(`Turn:\n${JSON.stringify(turn, null, '\t')}`);

		if (turn.type == 'subInstruction') {
			return await this.conversationTurn({...opts, subInstruction: turn.subInstructionToDescribe});
		}

		const oldState = await this.lastState();
		//fastJSONPatch applies the patch in place by default. The second true is for mutateDocumen: false
		const newState = fastJSONPatch.applyPatch(oldState, fastJSONPatch.deepClone(turn.patch), false, false).newDocument;
		this._states.push(newState);
		if (debugLogger) debugLogger(`New State:\n${JSON.stringify(newState, null, '\t')}`);
		return turn.messageForUser;
	}

	async run(signaller : ConversationSignaller) : Promise<void> {

		await this.validate();

		//TODO: support images
		while(!signaller.done) {
			await signaller.streamStarted(this);
			await this.conversationTurn({
				//Use a => to bind to this
				streamLogger: (message : string) => signaller.streamIncrementalMessage(this, message),
				debugLogger: this._debugLogger
			});
			await signaller.streamStopped(this, await this.lastState());
			const response = await signaller.getUserMessage();
			if (!response) {
				signaller.finish();
				break;
			}
			this.provideUserResponse(response || '');
		}
	}
}