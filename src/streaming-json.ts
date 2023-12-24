import {
	assertUnreachable
} from './util.js';

type expectedChar = {
	type: ']'
} | {
	type: '"',
	lastCharIsEscape: boolean
} | {
	type: '}',
	expectsNext: 'start-optional-key' | 'start-required-key' | 'continue-key' | 'start-value' | 'continue-value' | 'colon' | 'comma'
};

//TODO: move this into StreamingJSONParser
const inString =(stack : expectedChar[]) : boolean => {
	if (stack.length == 0) return false;
	const item = stack[0];
	return item.type == '"';
};

/*

parsePartialJSON accepts a partial JSON string and terminates it as quickly as possible to make it valid and tries to prase it.

For example, it will take a string like `{"abc":{"a`, complete it to `{"abc":{"a":null}}` and then parse it.

It's useful for when a JSON response is streaming from an LLM and will be partial until it's done.

*/
export class StreamingJSONParser {
	_stack : expectedChar[];
	_result : string;
	_cachedJSON? : unknown;

	constructor() {
		this._stack = [];
		this._result = '';
	}

	//Ingests more streaming characters of JSON.
	ingest(partial : string) : void {
		//Each time we enter an object context we push another item on here to tell us if the next thing to expect is a string.	
		for (const char of partial) {
			let charIsEscape = false;
			//If we're not in a string, the character is not whitespace, we're in an
			//object context, and we haven't started the value yet, note that it's
			//now started.
			if (!inString(this._stack) && char.trim() && this._stack.length && this._stack[0].type == '}' && this._stack[0].expectsNext == 'start-value') this._stack[0].expectsNext = 'continue-value';
			switch(char) {
			case '\\':
				//This can only happen within a string if it's valid json anyway
				charIsEscape = true;
				break;
			case '"':
				if (this._stack[0].type == '"' && this._stack[0].lastCharIsEscape) break;
				
				if (inString(this._stack)) {
					//Indirect because after .shift() typescript otherwise would still think thingsToTerminate[0] will be "\""
					const currentLastThing = this._stack[0];
					if (!this._stack.length || currentLastThing.type != '"') throw new Error('String was not terminated by string');
					this._stack.shift();
					if (this._stack[0].type == '}') {
						if (this._stack[0].expectsNext == 'continue-key') {
							this._stack[0].expectsNext = 'colon';
						} else {
							this._stack[0].expectsNext = 'comma';
						}
					}
				} else {
					this._stack.unshift({type: '"', lastCharIsEscape: false});
					for (const item of this._stack) {
						if (item.type != '}') continue;
						if (item.expectsNext == 'start-optional-key' || item.expectsNext == 'start-required-key') {
							item.expectsNext = 'continue-key';
							break;
						}
					}
				}
				break;
			case '[':
				if (inString(this._stack)) break;
				this._stack.unshift({type: ']'});
				break;
			case ']':
				if (inString(this._stack)) break;
				if (!this._stack.length || this._stack[0].type != ']') throw new Error('Array not terminated');
				this._stack.shift();
				break;
			case '{':
				if (inString(this._stack)) break;
				this._stack.unshift({type: '}', expectsNext: 'start-optional-key'});
				break;
			case '}':
				if (inString(this._stack)) break;
				if (!this._stack.length || this._stack[0].type != '}') throw new Error('Object not terminated');
				this._stack.shift();
				break;
			case ':':
				if (inString(this._stack)) break;
				if (this._stack[0].type != '}') break;
				this._stack[0].expectsNext = 'start-value';
				break;
			case ',':
				if (inString(this._stack)) break;
				if (this._stack[0].type != '}') break;
				this._stack[0].expectsNext = 'start-required-key';
				break;
			}
			if (this._stack.length && this._stack[0].type == '"') this._stack[0].lastCharIsEscape = charIsEscape;
		}
		this._result += partial;
		this._cachedJSON = undefined;
	}

	//Returns the full text that has been ingested so far.
	get string() : string {
		return this._result;
	}

	//Does the smallest amount of mangling necessary to make the partial JSON result into a valid json result and return it.
	json() : unknown {
		if (this._cachedJSON !== undefined) return this._cachedJSON;
		let finalString = this._result;
		if (!this._result) return null;
		for (const item of this._stack) {
			const char = item.type;
			if (char == '}') {
				const next = item.expectsNext;
				switch(next) {
				case 'colon':
					finalString += ':null';
					break;
				case 'comma':
					finalString += '';
					break;
				case 'start-optional-key':
					//It can be an empty object
					finalString += '';
					break;
				case 'start-required-key':
					finalString += '"":null';
					break;
				case 'continue-key':
					//The string was already closed in an earlier iteration
					finalString += ':null';
					break;
				case 'start-value':
					finalString += 'null';
					break;
				case 'continue-value':
					finalString += '';
					break;
				default:
					assertUnreachable(next);
				}
			} else if (char == '"') {
				//We need to do an extra ending quote otherwise it won't terminate the string
				if (item.lastCharIsEscape) finalString += '"';
			}
			finalString += char;
		}
		try {
			const result = JSON.parse(finalString);
			this._cachedJSON = result;
			return result;
		} catch(error) {
			throw new Error(`Could not parse partial json *${finalString}*: ${error}`);
		}
	}
}