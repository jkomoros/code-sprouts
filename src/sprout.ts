import {
    fileExists,
    fileFetch,
    joinPath
} from './fetcher.js';

import {
    AIProvider
} from './llm.js';

import {
    Path,
    SproutConfig,
    SproutName,
    sproutConfigSchema
} from './types.js';

//The state a given sprout defines. TODO: make this more tight.
type SproutState = unknown;

//Relative to the sprout root
const SPROUT_CONFIG_PATH = 'config.json';
const SPROUT_INSTRUCTIONS_PATH = 'instructions.md';
const SPROUT_SCHEMA_PATH = 'schema.ts';

export class Sprout {
    _path : Path
    _config?: SproutConfig
    _baseInstructions? : string
    _schemaText? : string
    _aiProvider? : AIProvider

    constructor(path : Path, ai? : AIProvider) {
        this._path = path;
        this._aiProvider = ai;
    }

    get name() : SproutName {
        //TODO: return the last path component
        return this._path;
    }

    async config() : Promise<SproutConfig> {
        if (!this._config) {
            const sproutConfigPath = joinPath(this._path, SPROUT_CONFIG_PATH);
            if (!await fileExists(sproutConfigPath)) {
                throw new Error(`${this.name}: Config file ${sproutConfigPath} not found`);
            }
            const configData = await fileFetch(sproutConfigPath);
            //Tnis will throw if invalid shape.
            const config = sproutConfigSchema.parse(JSON.parse(configData));
            if (!config) throw new Error(`${this.name}: No config`);
            this._config = config;
        }
        if (!this._config) throw new Error(`${this.name}: Couldn't create sprout`);
        return this._config;
    }

    async baseInstructions() : Promise<string> {
        if (this._baseInstructions === undefined) {
            const sproutInstructionsPath = joinPath(this._path, SPROUT_INSTRUCTIONS_PATH);
            if (!await fileExists(sproutInstructionsPath)) {
                throw new Error(`${this.name}: Instruction file ${sproutInstructionsPath} not found`);
            }
            this._baseInstructions = await fileFetch(sproutInstructionsPath);
        }
        if (this._baseInstructions === undefined) throw new Error(`${this.name}: No instructions`);
        return this._baseInstructions;
    }

    async schemaText() : Promise<string> {
        if (this._schemaText === undefined) {
            const sproutSchemaPath = joinPath(this._path, SPROUT_SCHEMA_PATH);
            if (!await fileExists(sproutSchemaPath)) {
                throw new Error(`${this.name}: Schema file ${sproutSchemaPath} not found`);
            }
            //TODO: validate this is valid typescript
            this._schemaText = await fileFetch(sproutSchemaPath);
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
        //TODO: don't use an LLM for this / cache the result so we don't have to run it each time
        if (!this._aiProvider) throw new Error('This currently requires an AI provider');
        const schemaText = await this.schemaText();
        const prompt = `Return the JSON of a default/empty object conforming to this typescript schema (following comments on defaults):
${schemaText}
`;
        const rawJSON = await this._aiProvider.prompt(prompt);
        return JSON.parse(rawJSON);
    }

    //Returns the next prompt to return.
    async prompt() : Promise<string> {
        const baseInstructions = await this.baseInstructions();
        const schemaText = await this.schemaText();

        const emptyObject = await this.starterState();

        //TODO: manage state and responses as diffs.
        return `${baseInstructions}

You will manage your state in an object conforming to the following schema:
${schemaText}

Your current state is:
${JSON.stringify(emptyObject, null, '\t')}`;
    }
}