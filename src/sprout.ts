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
	Conversation,
	ConversationMessageSprout,
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

import {
	assertUnreachable,
	joinPath,
	randomString,
	trimExtraNewlines
} from './util.js';

import {
	ConversationSignaller
} from './signaller.js';

//A manual conversion of types.ts:conversationTurnSchema
const CONVERSATION_TURN_SCHEMA_FIRST_PART = `type ConversationTurn = {
	type: 'subInstruction';
	//The subInstruction to have summarized for us, before responding to the user.
	subInstructionToDescribe: {{SUB_INSTRUCTION_NAMES}};
} | `;
const CONVERSATION_TURN_SCHEMA_SECOND_PART = `{
  type: 'default',{{PATCH_SUB_SCHEMA}}
  //The message that will be shown to the user.
  messageForUser: string
}`;
const CONVERSATION_TURN_PATCH_SUB_SCHEMA = `
  //The change to make to the current state object based on this turn. If no modification needs to be made, can just be [].
  patch : JSONPatchRFC6902,`;

const CONVERSATION_TURN_SCHEMA = CONVERSATION_TURN_SCHEMA_FIRST_PART + CONVERSATION_TURN_SCHEMA_SECOND_PART;

const printableConversationTurnSchema = (includeState : boolean, subInstructions : SubInstructionsMap) : string => {
	const secondPart = CONVERSATION_TURN_SCHEMA_SECOND_PART.replace('{{PATCH_SUB_SCHEMA}}', includeState ? CONVERSATION_TURN_PATCH_SUB_SCHEMA : '');
	if (Object.keys(subInstructions).length == 0) return secondPart;
	const subInstructionNames = Object.keys(subInstructions).map(name => `'${name}'`).join(' | ');
	const firstPart = CONVERSATION_TURN_SCHEMA.replace('{{SUB_INSTRUCTION_NAMES}}', subInstructionNames);
	return firstPart + secondPart;
};

//Set true while debugging
const AGGRESSIVE_LOGGING = false;

type SproutOptions = {
	ai? : AIProvider,
	debugLogger? : Logger,
	//If true, and a file is not compiled, it will fail.
	disallowCompilation? : boolean,
	disallowFormatting? : boolean
};

export type ConversationTurnOptions = {
	//Will be called with streaming incremental user-visible results.
	streamLogger? : StreamLogger,
	//Will be called with streaming raw turn object results
	debugStreamLogger? : Logger,
	subInstruction? : SubInstructionsName
}

const markDownQuoteText = (input : string) : string => {
	return input.split('\n').map(line => `> ${line}`).join('\n');
};

const textConversation = (conversation : Conversation) : string => {
	return conversation.map(turn => {
		const speaker = turn.speaker;
		switch(speaker){
		case 'user':
			return `# User:\n${markDownQuoteText(textForPrompt(turn.message, true))}`;
		case 'sprout':
			return `# Sprout:\n${markDownQuoteText(textForPrompt(turn.message, true))}`;
		default:
			assertUnreachable(speaker);
		}
	}).join('\n');
};

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
	private _disallowFormatting : boolean;
	private _debugLogger? : Logger;
	private _id : string;
	private _conversation : Conversation;
	//If compilation notes that it's out of date, it will store in here which
	//ones are not to be trusted.
	private _outOfDateFiles : Record<Path, boolean> = {};

	static setFetcher(input : Fetcher) : void {
		fetcher = input;
	}

	static getFetcher() : Fetcher {
		//TODO: it's kind of weird that everyone rendeveous here, shouldn't there be another way of retrieving it?
		return fetcher;
	}

	constructor(path : Path, opts : SproutOptions = {}) {
		const {
			ai,
			debugLogger,
			disallowCompilation,
			disallowFormatting
		} = opts;
		this._path = path;
		this._aiProvider = ai;
		this._debugLogger = debugLogger;
		this._disallowCompilation = Boolean(disallowCompilation);
		this._disallowFormatting = Boolean(disallowFormatting);
		this._id = randomString(8);
		this._conversation = [];
	}

	//A random ID for this sprout. Convenient to debug sprout identity issues.
	get id() : string {
		return this._id;
	}

	get name() : SproutName {
		//TODO: return the last path component
		return this._path;
	}

	get conversation() : Conversation {
		return this._conversation;
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

	async allowFormatting() : Promise<boolean> {
		const config = await this.config();
		if (!config.allowFormatting) return false;
		return !this._disallowFormatting;
	}

	async compiled() : Promise<boolean> {
		const compiled = await this._compiled();
		return Boolean(compiled) && Object.keys(this._outOfDateFiles).length == 0;
	}

	async compile() : Promise<void> {
		if (await this.compiled()) {
			if (this._debugLogger) this._debugLogger(`${this.name}: Already compiled`);
			return;
		}
		const compiledPath = joinPath(this._path, SPROUT_COMPILED_PATH);
		if (!fetcher.mayWriteFile(compiledPath)) {
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
		fetcher.writeFile(compiledPath, JSON.stringify(result, null, '\t'));
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
					if (fetcher.supportsLastUpdated()) {
						this._outOfDateFiles = {};
						for (const file of await this._filesToCheckForCompilation()) {
							const path = joinPath(this._path, file);
							if (!await fetcher.fileExists(path)) continue;
							const lastUpdated = await fetcher.fileLastUpdated(path);
							if (lastUpdated === null) break;
							if (lastUpdated > compiledLastUpdated) {
								//If any of the base files are newer than the compiled file, we need to recompile.
								if(this._debugLogger) this._debugLogger(`${this.name}: Compiled file out of date: ${path} is newer than ${compiledSproutPath}`);
								this._outOfDateFiles[path] = true;
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
		const sproutConfigPath = joinPath(this._path, SPROUT_CONFIG_PATH);

		const compiled = await this._compiled();
		if(compiled && !this._outOfDateFiles[sproutConfigPath]) return compiled.config;

		if (!this._config) {
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
		const sproutInstructionsPath = joinPath(this._path, SPROUT_INSTRUCTIONS_PATH);

		const compiled = await this._compiled();
		if(compiled && !this._outOfDateFiles[sproutInstructionsPath]) return compiled.baseInstructions;

		if (this._baseInstructions === undefined) {
			
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
		const subInstructionNeedsCompilation = Object.keys(this._outOfDateFiles).some(file => file.includes('/' + SPROUT_SUBINSTUCTIONS_DIR + '/'));
		if(compiled && !subInstructionNeedsCompilation) return compiled.subInstructions;

		if (this._subInstructions === undefined) {
			this._subInstructions = {};
			//TODO: make sure this will return [] if the directory doesn't exist.
			const items = await fetcher.listDirectory(joinPath(this._path, SPROUT_SUBINSTUCTIONS_DIR));
			for (const item of items) {
				const path = joinPath(this._path, SPROUT_SUBINSTUCTIONS_DIR, item);
				if (!path.endsWith('.md')) continue;
				const name = item.replace(/\.md$/, '');
				if (!this._outOfDateFiles[path] && compiled && compiled.subInstructions[name]) {
					this._subInstructions[name] = compiled.subInstructions[name];
					continue;
				}
				const instructions = await fetcher.fileFetch(path);
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
		const sproutSchemaPath = joinPath(this._path, SPROUT_SCHEMA_PATH);

		const compiled = await this._compiled();
		if(compiled && !this._outOfDateFiles[sproutSchemaPath]) return compiled.schemaText;

		if (this._schemaText === undefined) {
			if (await fetcher.fileExists(sproutSchemaPath)) {
				//TODO: validate this is valid typescript
				this._schemaText = await fetcher.fileFetch(sproutSchemaPath);
			} else {
				//An empty schema is valid
				this._schemaText = '';
			}
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

		const sproutSchemaPath = joinPath(this._path, SPROUT_SCHEMA_PATH);

		const compiled = await this._compiled();
		if(compiled && !this._outOfDateFiles[sproutSchemaPath]) return compiled.starterState;

		const schemaText = await this.schemaText();
		if (!schemaText) return {};
		//TODO: don't use an LLM for this / cache the result so we don't have to run it each time
		if (!this._aiProvider) throw new Error('This currently requires an AI provider');
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
		//Iterate backwards through the conversation until we find a state.
		for (let i = this._conversation.length - 1; i >= 0; i--) {
			const turn = this._conversation[i];
			if (turn.speaker != 'sprout') continue;
			if (turn.state) return turn.state;
		}
		return await this.starterState();
	}

	//Returns the previous conversation, not including the most recent 
	previousMessages() : [previousConversation : Conversation, lastUserMessage : Prompt] {
		const conversation : Conversation = [];
		let seenSproutMessage = false;
		let lastUserMessage : Prompt | null = null;
		//Iterate through the conversation in reverse order
		for (let i = this._conversation.length - 1; i >= 0; i--) {
			const turn = this._conversation[i];
			const speaker = turn.speaker;
			switch(speaker){
			case 'sprout':
				if (!seenSproutMessage) {
					seenSproutMessage = true;
					continue;
				}
				break;
			case 'user':
				if (!lastUserMessage) {
					lastUserMessage = turn.message;
					continue;
				}
				break;
			}
			conversation.unshift(turn);
		}
		return [conversation, lastUserMessage || ''];
	}

	//Returns the next prompt to return.
	async prompt(subInstruction? : SubInstructionsName) : Promise<Prompt> {
		const baseInstructions = await this.baseInstructions();
		const schemaText = await this.schemaText();

		const includeState = schemaText != '';

		const state = await this.lastState();

		const subInstructions = await this.subInstructions();

		const allowFormatting = await this.allowFormatting();

		const allowImages = await this.allowImages();

		if (subInstruction && !subInstructions[subInstruction]) throw new Error(`No sub-instruction ${subInstruction}`);

		const [previousConversation, lastUserMessage] = this.previousMessages();

		let instructions = `${baseInstructions}

${allowImages ? 'You can also accept images as input. If you are provided an image, give a more descriptive natural language description of the state change you make in response to the image.' : ''}

${includeState ? `You will manage your state in an object conforming to the following schema:
${schemaText}

When relevant or requested, summarize the state in a way that a non-technical user would understand. If the user explicitly asks what is in the state object, reproduce it exactly.
` : ''}

${subInstruction ? `Here is information on the sub-instruction ${subInstruction}:\n${subInstructions[subInstruction].instructions}` :
		Object.keys(subInstructions).length ? `Here are sub-instructions you can request information on providing their name:
		${Object.entries(subInstructions).map(([name, info]) => `* '${name}': ${info.summary}`).join('\n')}` :
			''}

${previousConversation.length ? 'The previous conversation (for context only):\n' + textConversation(previousConversation) : ''}

The last user message (VERY IMPORTANT that you respond to this):
${(textConversation([{speaker: 'user', message: lastUserMessage || '<INITIAL>'}]))}

${includeState ? `Your current state is:
${JSON.stringify(state, null, '\t')}
` : ''}

It is VERY IMPORTANT that you should respond with only a literal JSON object (not wrapped in markdown formatting or other formatting) matching this schema:
${printableConversationTurnSchema(includeState, subInstruction ? {} : subInstructions)}

${allowFormatting ? 'Your messageForUser may include markdown formatting if appropriate.' : ''}

${includeState ? 'Provide a patch to update the state object based on the users\'s last message and your response.'
		: ''}`;

		instructions = trimExtraNewlines(instructions);

		if (!lastUserMessage) return instructions;	

		if (promptIncludesImage(lastUserMessage)) {
			return [
				instructions,
				...promptImages(lastUserMessage)
			];
		}

		return instructions;

	}

	provideUserResponse(response : Prompt) : void {
		this._conversation = [
			...this._conversation,
			{
				speaker: 'user',
				message: response
			}
		];
	}

	async managesState() : Promise<boolean> {
		const schemaText = await this.schemaText();
		return schemaText != '';
	}

	private prepareForConversation() : ConversationMessageSprout {
		const sproutResponse : ConversationMessageSprout = {
			speaker: 'sprout',
			message: ''
		};
		this._conversation = [
			...this._conversation,
			sproutResponse
		];
		return sproutResponse;
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
	private async conversationTurn(signaller : ConversationSignaller, sproutResponse : ConversationMessageSprout, opts : ConversationTurnOptions = {}) : Promise<string> {
		const {debugStreamLogger, streamLogger, subInstruction} = opts;
		if (!this._aiProvider) throw new Error('No AI provider');
		const config = await this.config();
		const prompt = await this.prompt(subInstruction);
		const includeState = await this.managesState();
		const promptHasImages = promptIncludesImage(prompt);
		if (!config.allowImages && promptHasImages) throw new Error('Prompt includes images but images are not allowed');
		if (this._debugLogger) this._debugLogger(`Prompt:\n${debugTextForPrompt(prompt)}`);
		const stream = await this._aiProvider.promptStream(prompt, {
			jsonResponse: true,
			debugLogger: this._debugLogger,
			modelRequirements: {
				//It's not possible to allowImages and imageInput at the same time currently, because no openai model allows both.
				jsonResponse: !promptHasImages,
				imageInput: promptHasImages
			}
		});
		const parser = new StreamingJSONParser();
		const iterator = stream[Symbol.asyncIterator]();
		//eslint-disable-next-line no-constant-condition
		while (true) {
			const iteratorResult = await Promise.race([
				iterator.next(),
				signaller.doneSignal(this)
			]);

			if (signaller.done(this)) return '';
			
			if (typeof iteratorResult == 'undefined') throw new Error('Undefined iterator result');
			if (iteratorResult.done) break;
			const chunk = iteratorResult.value;

			if (chunk.choices.length == 0) throw new Error('No choices');
			if (this._debugLogger && AGGRESSIVE_LOGGING) this._debugLogger('Chunk:\n' + JSON.stringify(chunk, null, '\t'));
			const choice = chunk.choices[0];
			if (choice.finish_reason && choice.finish_reason != 'stop') throw new Error(`Unexpected chunk stop reason: ${choice.finish_reason}`);
			const content = choice.delta.content || '';
			const incrementalUserMessage = parser.incrementalProperty(content, (input: unknown) : string => {
				return partialConversationTurnSchema.parse(input).messageForUser || '';
			});
			if (debugStreamLogger) debugStreamLogger(content);
			//Only call the user-stream loggers if there's some content to log.
			if (incrementalUserMessage) {
				if (streamLogger) streamLogger(incrementalUserMessage);
				sproutResponse.message += incrementalUserMessage;
			}
		}
		//Add a newline at the end for the next line
		if (streamLogger) streamLogger('\n');
		if (this._debugLogger && AGGRESSIVE_LOGGING) {
			this._debugLogger(`Raw Turn: ${parser.rawInput}`);
			this._debugLogger(`Trimmed Turn: ${parser.input}`);
		}
		let turnJSON : unknown = {};
		try {
			turnJSON = parser.json();
		} catch(err) {
			throw new Error(`Could not parse JSON: ${parser.input}: ${err}`);
		}
		if (!turnJSON) throw new Error('Empty json');

		//Just thonk on an empty patch if we're in a mode where we're not supposed to have a patch.
		//TODO: this feels kind of hacky, ideally we'd have a function that wraps the schema and does this.
		if (!includeState) {
			if (turnJSON && typeof turnJSON == 'object' && Object.keys(turnJSON).length) (turnJSON as {patch: []}).patch = [];
		}

		const turn = strictConversationTurnSchema.parse(turnJSON);
		if (this._debugLogger) this._debugLogger(`Turn:\n${JSON.stringify(turn, null, '\t')}`);

		if (turn.type == 'subInstruction') {
			return await this.conversationTurn(signaller, sproutResponse, {...opts, subInstruction: turn.subInstructionToDescribe});
		}

		const oldState = await this.lastState();
		//fastJSONPatch applies the patch in place by default. The second true is for mutateDocumen: false
		const newState = fastJSONPatch.applyPatch(oldState, fastJSONPatch.deepClone(turn.patch), false, false).newDocument;
		sproutResponse.state = newState;
		if (this._debugLogger) this._debugLogger(`New State:\n${JSON.stringify(newState, null, '\t')}`);
		return turn.messageForUser;
	}

	async run(signaller : ConversationSignaller) : Promise<void> {

		await this.validate();

		while(!signaller.done(this)) {
			//We don't have conversationTurn start the conversation, because we
			//want a new, empty sprout message to exist by the time
			//streamStarted is called.
			const sproutResponse = this.prepareForConversation();
			await Promise.race([
				signaller.streamStarted(this),
				signaller.doneSignal(this)
			]);
			if (signaller.done(this)) break;
			await Promise.race([
				this.conversationTurn(
					signaller,
					sproutResponse,
					{
						//Use a => to bind to this
						streamLogger: (message : string) => signaller.streamIncrementalMessage(this, message),
						debugStreamLogger: (message : string) => signaller.streamIncrementalDebugMessage(this, message),
					}
				),
				signaller.doneSignal(this)
			]);
			if (signaller.done(this)) break;
			await Promise.race([
				signaller.streamStopped(this, await this.lastState()),
				signaller.doneSignal(this)
			]);
			if(signaller.done(this)) break;
			const response = await Promise.race([
				signaller.getUserMessage(this),
				signaller.doneSignal(this)
			]);
			if (signaller.done(this)) break;
			//Checking for void
			if (!response) break;
			this.provideUserResponse(response || '');
		}
	}
}