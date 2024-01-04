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
	DirectoryInfo,
	Fetcher,
	FetcherWithoutListSprouts,
	Logger,
	NakedUncompiledPackagedSprout,
	NakedUncompiledPackagedSproutNotNeedingAI,
	PackagedSprout,
	Path,
	Prompt,
	SproutConfig,
	SproutName,
	SproutState,
	StreamLogger,
	SubInstructionsFilename,
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
	SPROUT_SUBINSTUCTIONS_DIR
} from './constants.js';

import {
	z
} from 'zod';

import fastJSONPatch from 'fast-json-patch';

import {
	assertUnreachable,
	joinPath,
	makeDirectoryInfo,
	randomString,
	trimExtraNewlines,
	writeFileToDirectoryInfo,
	deepEqual
} from './util.js';

import {
	ConversationSignaller
} from './signaller.js';

import {
	overlayFetcher
} from './fetcher-overlay.js';

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
	disallowFormatting? : boolean,
	//if provided, then reads and writes into the sprout's files will be done into this packaged sprout instead.
	packagedSprout? : DirectoryInfo
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

let _fetcher : Fetcher = fetcherImpl;

export class Sprout {
	private _path : Path;
	// A null means it is affirmatively non existent.
	private _aiProvider? : AIProvider;

	//TODO: do this for the _doCompile too.
	private _inProgressFetchUncompiled? : Promise<NakedUncompiledPackagedSprout>;
	private _inProgressFetchCompiled? : Promise<CompiledSprout | null>;

	private _disallowCompilation : boolean;
	private _disallowFormatting : boolean;
	private _uncompiledPackage? : NakedUncompiledPackagedSprout;
	private _compiledSprout? : CompiledSprout | null;
	private _debugLogger? : Logger;
	private _id : string;
	private _conversation : Conversation;
	private _fetcher : FetcherWithoutListSprouts;

	static setFetcher(input : Fetcher) : void {
		_fetcher = input;
	}

	static getFetcher() : Fetcher {
		//TODO: it's kind of weird that everyone rendeveous here, shouldn't there be another way of retrieving it?
		return _fetcher;
	}

	constructor(path : Path, opts : SproutOptions = {}) {
		const {
			ai,
			debugLogger,
			disallowCompilation,
			disallowFormatting,
			packagedSprout
		} = opts;
		this._path = path;
		this._aiProvider = ai;
		this._debugLogger = debugLogger;
		this._disallowCompilation = Boolean(disallowCompilation);
		this._disallowFormatting = Boolean(disallowFormatting);
		this._id = randomString(8);
		this._conversation = [];
		this._fetcher = packagedSprout ? overlayFetcher(_fetcher, path, packagedSprout)  : _fetcher;
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

	async fetchCompiledSprout() : Promise<CompiledSprout | null> {
		if (this._compiledSprout !== undefined) return this._compiledSprout;
		if (this._inProgressFetchCompiled) {
			return this._inProgressFetchCompiled;
		}
		this._inProgressFetchCompiled = this._actuallyFetchCompiledSprout();
		const result = await this._inProgressFetchCompiled;
		this._compiledSprout = result;
		this._inProgressFetchCompiled = undefined;
		return result;
	}

	async _actuallyFetchCompiledSprout() : Promise<CompiledSprout | null> {
		
		const compiledPath = joinPath(this._path, SPROUT_COMPILED_PATH);
		if (!await this._fetcher.fileExists(compiledPath)) {
			return null;
		}
		const compiledData = await this._fetcher.fileFetch(compiledPath);
		const json = JSON.parse(compiledData);
		const parseResult = compiledSproutSchema.safeParse(json);
		if (!parseResult.success) {
			throw new Error(`Invalid compiled sprout: ${JSON.stringify(parseResult.error.errors, null, '\t')}`);
		}
		return parseResult.data;
	}

	async fetchUncompiledPackage() : Promise<NakedUncompiledPackagedSprout>  {
		if (this._uncompiledPackage) return this._uncompiledPackage;
		if (this._inProgressFetchUncompiled) {
			return this._inProgressFetchUncompiled;
		}
		this._inProgressFetchUncompiled = this._actuallyFetchUncompiledPackage();
		const result = await this._inProgressFetchUncompiled;
		this._uncompiledPackage = result;
		this._inProgressFetchUncompiled = undefined;
		return result;
	}

	async _actuallyFetchUncompiledPackage() : Promise<NakedUncompiledPackagedSprout> {
		const sproutConfigPath = joinPath(this._path, SPROUT_CONFIG_PATH);
		const sproutConfig = await this._fetcher.fileFetch(sproutConfigPath);

		const instructionsPath = joinPath(this._path, SPROUT_INSTRUCTIONS_PATH);
		const instructions = await this._fetcher.fileFetch(instructionsPath);

		const schemaPath = joinPath(this._path, SPROUT_SCHEMA_PATH);
		let schemaText = '';
		//TODO: this double-gets.
		if (await this._fetcher.fileExists(schemaPath)) {
			schemaText = await this._fetcher.fileFetch(schemaPath);
		}

		const subInstructionsPath = joinPath(this._path, SPROUT_SUBINSTUCTIONS_DIR);
		const subInstructions : Record<SubInstructionsFilename, string> = {};
		for (const subInstruction of await this._fetcher.listDirectory(subInstructionsPath, 'file')) {
			if (!subInstruction.endsWith('.md')) continue;
			const path = joinPath(subInstructionsPath, subInstruction);
			const instructions = await this._fetcher.fileFetch(path);
			subInstructions[subInstruction] = instructions;
		}

		//We don't bother checking if files are out of date; this is jus
		const result : NakedUncompiledPackagedSprout = {
			'sprout.json': sproutConfig,
			'instructions.md': instructions,
		};
		if (schemaText) {
			result['schema.ts']	= schemaText;
		}
		if (Object.keys(subInstructions).length > 0) {
			result['sub_instructions'] = subInstructions;
		}
		return result;
	}

	//Returns null if it doesn't require compilation, or an array of strings describing the reasons it's comipled otherwise.
	private _requiresCompilation(uncompiled : NakedUncompiledPackagedSprout, previous : CompiledSprout | null) : null | string[] {
		if (!previous) return ['no previous provided'];
		const result : string[] = [];
		const configJSON = JSON.parse(uncompiled['sprout.json']);
		const config = sproutConfigSchema.parse(configJSON);
		if (!deepEqual(config, previous.config)) result.push('config not deep equal');
		if (uncompiled['instructions.md'] != previous.baseInstructions) result.push('instructions not equal');
		//This might be empty
		const uncompiledSchemaText = uncompiled['schema.ts'] || '';
		if (uncompiledSchemaText != previous.schemaText) result.push('schema.ts not equal');
		if (Object.keys(uncompiled['sub_instructions'] || {}).length != Object.keys(previous.subInstructions).length) return ['sub_instructions length not equal'];
		for (const [filename, instructions] of Object.entries(uncompiled['sub_instructions'] || {})) {
			const name = filename.replace(/\.md$/, '');
			if (!previous.subInstructions[name]) return [`sub_instructions missing ${name} in previous`];
			if (previous.subInstructions[name].instructions != instructions) result.push(`sub_instructions ${name} not equal`);
		}
		if (result.length == 0) return null;
		return result;
	}

	async compiledData(forceRefresh : boolean = false) : Promise<CompiledSprout | null> {
		if (this._compiledSprout) return this._compiledSprout;
		const compiled = await this.fetchCompiledSprout();
		if (!forceRefresh && compiled) {
			this._compiledSprout = compiled;
			return compiled;
		}

		const compiledPath = joinPath(this._path, SPROUT_COMPILED_PATH);

		//We need to try creating it.
		if (this._disallowCompilation) {
			if (compiled) {
				if (this._debugLogger) this._debugLogger(`A forcedRefresh is requested but Sprout ${this.name} is disallowed from compiling. ${compiledPath} exists, so using it`);
				return compiled;
			}
			if (this._debugLogger) this._debugLogger(`Compilation is disallowed and ${compiledPath} does not exist`);
			return null;
		}

		//TODO: wrap in a try/catch.
		const uncompiled = await this.fetchUncompiledPackage();
		const result = await this._doCompile(uncompiled, compiled);

		if (this._fetcher.mayWriteFile(compiledPath)) {
			await this._fetcher.writeFile(compiledPath, JSON.stringify(result, null, '\t'));
		}

		this._compiledSprout = result;
		return this._compiledSprout;
	}

	private _calculateConfig(uncompiled : NakedUncompiledPackagedSprout) : SproutConfig {
		const configJSON = JSON.parse(uncompiled['sprout.json']);
		return sproutConfigSchema.parse(configJSON);
	}

	private _calculateBaseInstructions(uncompiled : NakedUncompiledPackagedSprout) : string {
		return uncompiled['instructions.md'];
	}

	private _calculateSchemaText(uncompiled : NakedUncompiledPackagedSprout) : string {
		return uncompiled['schema.ts'] || '';
	}

	private async _doCompile(uncompiled : NakedUncompiledPackagedSprout, previous : CompiledSprout | null) : Promise<CompiledSprout> {
		
		//TODO: rename this once old machinery is gone.

		const version = 0 as const;
		const lastUpdated = new Date().toISOString();
		const name = this.name;

		const config = this._calculateConfig(uncompiled);

		const baseInstructions = this._calculateBaseInstructions(uncompiled);

		const schemaText = this._calculateSchemaText(uncompiled);
		
		const subInstructions : SubInstructionsMap = {};

		for(const [filename, instructions] of Object.entries(uncompiled['sub_instructions'] || {})) {
			const name = filename.replace(/\.md$/, '');
			//If the previous instructions are precisely the same, use them and continue.
			//Calculating a summary is an expensive LLM operation.
			if (previous) {
				if (previous.subInstructions[name] && previous.subInstructions[name].instructions == instructions) {
					subInstructions[name] = previous.subInstructions[name];
					continue;
				}
			}
			const summary = await this.summaryForSubInstruction(instructions);
			subInstructions[name] = {
				summary,
				instructions
			};
		}

		let starterState : Record<string, unknown> = {};

		if (schemaText) {
			//We need to caculate a starterState. Can we use the previous one or not?
			if (previous && previous.schemaText == schemaText) {
				starterState = previous.starterState;
			} else {
				starterState = await this.starterStateForSchemaText(schemaText);
			}
		}

		return {
			version,
			lastUpdated,
			name,
			config,
			baseInstructions,
			schemaText,
			subInstructions,
			starterState
		};
	}

	//This forces a recompile.
	async compile() : Promise<void> {
		await this.compiledData(true);
	}

	//This remotely fetches the package to see if it needs recompilation.
	async requiresCompilation() : Promise<boolean> {
		const compiled = await this.fetchCompiledSprout();
		const uncompiled = await this.fetchUncompiledPackage();
		const result = this._requiresCompilation(uncompiled, compiled);
		if (!result) return false;
		if (this._debugLogger) this._debugLogger(`Sprout ${this.name} compiled because ${result.join(', ')}`);
		return true;
	}

	async config() : Promise<SproutConfig> {
		const compiled = await this.compiledData();
		if(compiled) return compiled.config;
		const uncompiled = await this.fetchUncompiledPackage();
		return this._calculateConfig(uncompiled);
	}

	async baseInstructions() : Promise<string> {
		const compiled = await this.compiledData();
		if(compiled) return compiled.baseInstructions;
		const uncompiled = await this.fetchUncompiledPackage();
		return this._calculateBaseInstructions(uncompiled);
	}

	async subInstructions() : Promise<SubInstructionsMap> {
		const compiled = await this.compiledData();
		if (!compiled) throw new Error('No compiled data and no subInstructions available');
		return compiled.subInstructions;
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
		const compiled = await this.compiledData();
		if (compiled) return compiled.schemaText;
		const uncompiled = await this.fetchUncompiledPackage();
		return this._calculateSchemaText(uncompiled);
	}

	//throws if invalid
	async validate() : Promise<void> {
		//Will throw if invalid
		await this.config();
		await this.baseInstructions();
		await this.schemaText();
	}

	private async starterStateForSchemaText(schemaText : string) : Promise<SproutState> {
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

	async starterState() : Promise<SproutState> {
		const compiled = await this.compiledData();
		if(!compiled)  throw new Error('No compiled data and no starterState available');
		return compiled.starterState;
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

export const packagedSproutFromUncompiled = async (uncompiled: NakedUncompiledPackagedSprout, ai : AIProvider) : Promise<PackagedSprout> =>  {
	return packagedSproutFromUncompiledImpl(uncompiled, ai);
};

const packagedSproutFromUncompiledNotNeedingAI = async (uncompiled : NakedUncompiledPackagedSproutNotNeedingAI) : Promise<PackagedSprout> => {
	//We know we don't need AI to compile any of these provided fields so can skip adding AI.
	return packagedSproutFromUncompiledImpl(uncompiled);
};

//In this file because we need Sprout to be defined. and don't want a cycle from util.ts back t here
const packagedSproutFromUncompiledImpl = async (uncompiled : NakedUncompiledPackagedSprout, ai? : AIProvider) : Promise<PackagedSprout> => {
	const uncompiledPackedSprout = makeDirectoryInfo(uncompiled, new Date().toISOString());
	const dummySproutName = 'example';
	const sprout = new Sprout(dummySproutName, {ai, packagedSprout: uncompiledPackedSprout});
	const compiled = await sprout.compiledData();
	//TODO: can't I just verify the fetcher did something and now the file exists within it?
	writeFileToDirectoryInfo(uncompiledPackedSprout, SPROUT_COMPILED_PATH, JSON.stringify(compiled, null, '\t'));
	//This should be a reasonably safe assertion because we just wrote in the last file that needed to be there.
	return uncompiledPackedSprout as PackagedSprout;
};

export const emptySprout = async () : Promise<PackagedSprout> => {
	const config : SproutConfig = {
		version: 0
	};
	return packagedSproutFromUncompiledNotNeedingAI({
		'sprout.json': JSON.stringify(config, null, '\t'),
		'instructions.md': ''
	});
};