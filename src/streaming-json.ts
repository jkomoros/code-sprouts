import {
    assertUnreachable
} from './util';

type expectedChar = {
	type: ']'
} | {
	type: '"',
	lastCharIsEscape: boolean
} | {
	type: '}',
	expectsNext: 'start-optional-key' | 'start-required-key' | 'continue-key' | 'start-value' | 'continue-value' | 'colon' | 'comma'
};

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
export const parseStreamingJSON = (partialJSON : string) : unknown => {

	//TODO: allow a partial parsing when you know you're going to be calling
	//this iteratively like we do in runSprout. It would have an inner function
	//that returns a partial parse result.

	//TODO: this logic is extremely complex. There's likely more tests to be added and edge cases :grimace:

	if (!partialJSON) return null;
	const stack : expectedChar[] = [];
	//Each time we enter an object context we push another item on here to tell us if the next thing to expect is a string.	
	for (const char of partialJSON) {
		let charIsEscape = false;
		//If we're not in a string, the character is not whitespace, we're in an
		//object context, and we haven't started the value yet, note that it's
		//now started.
		if (!inString(stack) && char.trim() && stack.length && stack[0].type == '}' && stack[0].expectsNext == 'start-value') stack[0].expectsNext = 'continue-value';
		switch(char) {
		case '\\':
			//This can only happen within a string if it's valid json anyway
			charIsEscape = true;
			break;
		case '"':
			if (stack[0].type == '"' && stack[0].lastCharIsEscape) break;
			
			if (inString(stack)) {
				//Indirect because after .shift() typescript otherwise would still think thingsToTerminate[0] will be "\""
				const currentLastThing = stack[0];
				if (!stack.length || currentLastThing.type != '"') throw new Error('String was not terminated by string');
				stack.shift();
				if (stack[0].type == '}') {
					if (stack[0].expectsNext == 'continue-key') {
						stack[0].expectsNext = 'colon';
					} else {
						stack[0].expectsNext = 'comma';
					}
				}
			} else {
				stack.unshift({type: '"', lastCharIsEscape: false});
				for (const item of stack) {
					if (item.type != '}') continue;
					if (item.expectsNext == 'start-optional-key' || item.expectsNext == 'start-required-key') {
                        item.expectsNext = 'continue-key';
                        break;
                    }
				}
			}
			break;
		case '[':
			if (inString(stack)) break;
			stack.unshift({type: ']'});
			break;
		case ']':
			if (inString(stack)) break;
			if (!stack.length || stack[0].type != ']') throw new Error('Array not terminated');
			stack.shift();
			break;
		case '{':
			if (inString(stack)) break;
			stack.unshift({type: '}', expectsNext: 'start-optional-key'});
			break;
		case '}':
			if (inString(stack)) break;
			if (!stack.length || stack[0].type != '}') throw new Error('Object not terminated');
			stack.shift();
			break;
		case ':':
			if (inString(stack)) break;
			if (stack[0].type != '}') break;
			stack[0].expectsNext = 'start-value';
			break;
		case ',':
			if (inString(stack)) break;
			if (stack[0].type != '}') break;
			stack[0].expectsNext = 'start-required-key';
			break;
		}
		if (stack.length && stack[0].type == '"') stack[0].lastCharIsEscape = charIsEscape;
	}
	let finalString = partialJSON;
	for (const item of stack) {
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
		return JSON.parse(finalString);
	} catch(error) {
		throw new Error(`Could not parse partial json *${finalString}*: ${error}`);
	}
};