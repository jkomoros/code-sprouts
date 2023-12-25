import {
	assertUnreachable
} from './util.js';

type expectedChar = {
	type: ']',
	expectsNext: 'start-value' | 'continue-value';
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

StreamingJSONParser accumulates character-by-chaacter of JSON by repeated calls to ingest().

It accepts a partial JSON string and terminates it as quickly as possible to make it valid and tries to prase it.

For example, it will take a string like `{"abc":{"a`, complete it to `{"abc":{"a":null}}` and then parse it.

It's useful for when a JSON response is streaming from an LLM and will be partial until it's done.

It will reject and ignore characters outside of a JSON blob. This means it will natively be resilient to the LLM returning something like:

```
Here's your result:
```json
{
	"message": "foo"
}
```
*/
export class StreamingJSONParser {
	private _stack : expectedChar[];
	//TODO: make this input
	private _input : string;
	private _rawInput : string;
	private _cachedJSON? : unknown;

	constructor() {
		this._stack = [];
		this._input = '';
		this._rawInput = '';
	}

	//Returns if we should process or skip chars that are outside what we expect
	//right now. This helps us skip markdown for example.
	skipChar(char : string) : boolean {
		//Whitespace always allwoed
		if (!char.trim()) return false;
		//TODO: also reject things outside what we're expecting right now.
		if (this._stack.length == 0) {
			//Haven't yet started. Only two valid chars are '{' or '['
			if (char == '{') return false;
			if (char == '[') return false;
			return true;
		}
		const item = this._stack[0];
		const type = item.type;
		switch (type) {
		case '"':
			//Inside a string everything is allowed
			return false;
		case ']':
			//TODO: be more discerning here
			return false;
		case '}':
			//TODO: be more discerning here
			return false;
		default:
			assertUnreachable(type);
		}
		return false;
	}

	//Ingests more streaming characters of JSON.
	ingest(partial : string) : void {

		//Each time we enter an object context we push another item on here to tell us if the next thing to expect is a string.	
		for (const char of partial) {
			//We consume char no matter what.
			this._rawInput += char;

			if (this.skipChar(char)) continue;

			let charIsEscape = false;
			//If we're not in a string, the character is not whitespace, we're in an
			//object or array context, and we haven't started the value yet, note that it's
			//now started.
			if (!inString(this._stack) && char.trim() && this._stack.length && (this._stack[0].type == '}' || this._stack[0].type == ']') && this._stack[0].expectsNext == 'start-value') this._stack[0].expectsNext = 'continue-value';
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
				this._stack.unshift({type: ']', expectsNext: 'continue-value'});
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
				if (this._stack[0].type == '}') this._stack[0].expectsNext = 'start-required-key';
				if (this._stack[0].type == ']') this._stack[0].expectsNext = 'start-value';
				break;
			}
			if (this._stack.length && this._stack[0].type == '"') this._stack[0].lastCharIsEscape = charIsEscape;
			this._input += char;
		}
		this._cachedJSON = undefined;
	}

	//Returns the full text that has been ingested so far.
	get input() : string {
		return this._input;
	}

	get rawInput() : string {
		return this._rawInput;
	}

	//Does the smallest amount of mangling necessary to make the partial JSON result into a valid json result and return it.
	json() : unknown {
		//TODO: allow passing a defaulted shape that can be used to not put in
		//'null' but the right completion type. The type should have every thing
		//down to leaf values required (so e.g. an optional object hsould be
		//provided so we can see what the leaf types are)
		if (this._cachedJSON !== undefined) return this._cachedJSON;
		let finalString = this._input.trim();
		if (!finalString) return null;
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
			} else if (char == ']') {
				const next = item.expectsNext;
				switch(next) {
				case 'continue-value':
					finalString += '';
					break;
				case 'start-value':
					finalString += 'null';
					break;
				default:
					assertUnreachable(next);
				}
			} else {
				assertUnreachable(char);
			}
			finalString += char;
		}
		try {
			const result = JSON.parse(finalString);
			this._cachedJSON = result;
			return result;
		} catch(error) {
			console.warn(`Could not parse partial json *${finalString}*: ${error}`);
			//Sometimes the bot gives back invalid formatting.
			return null;
		}
	}

	//incrementalProperty extracts the property via propertyGetter, then ingests
	//chunk, then does it again, and returns any chunk that has changed before
	//ingestion. This is useful if you have e.g. a `userMessage` property and
	//want to stream in its value as it streams in, but not other updates to
	//object. Your propertyGetter may throw, which will be treated as a ''.
	incrementalProperty(chunk : string, propertyGetter : (obj: unknown) => string) : string {
		const previousCompletedJSON = this.json();
		this.ingest(chunk);
		let previousProperty : string = '';
		try {
			previousProperty = propertyGetter(previousCompletedJSON);
		} catch {
			previousProperty = '';
		}
		const newJSON = this.json();
		let newProperty : string = '';
		try {
			newProperty = propertyGetter(newJSON);
		} catch {
			newProperty = '';
		}
		if (newProperty.startsWith(previousProperty)) return newProperty.slice(previousProperty.length);
		return newProperty;
	}

}