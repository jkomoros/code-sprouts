export const assertUnreachable = (x : never) : never => {
	throw new Error('Exhaustiveness check failed: ' + String(x));
};

/*

parsePartialJSON accepts a partial JSON string and terminates it as quickly as possible to make it valid and tries to prase it.

For example, it will take a string like `{"abc":{"a`, complete it to `{"abc":{"a":null}}` and then parse it.

It's useful for when a JSON response is streaming from an LLM and will be partial until it's done.

*/
export const parsePartialJSON = (partialJSON : string) : unknown => {

	//TODO: this logic is extremely complex. There's likely more tests to be added and edge cases :grimace:

	if (!partialJSON) return null;
	const thingsToTerminate : ('"' | ']' | '}')[] = [];
	let previousCharWasEscape = false;
	let inString = false;
	//Each time we enter an object context we push another item on here to tell us if the next thing to expect is a string.
	const objectExpectsNext : ('start-key' | 'continue-key' | 'value' | 'colon' | 'comma')[] = [];
	
	for (const char of partialJSON) {
		let charIsEscape = false;
		switch(char) {
		case '\\':
			charIsEscape = true;
			break;
		case '"':
			if (previousCharWasEscape) break;
			
			if (inString) {
				//Indirect because after .shift() typescript otherwise would still think thingsToTerminate[0] will be "\""
				const currentLastThing = thingsToTerminate[0];
				if (!thingsToTerminate.length || currentLastThing != '"') throw new Error('String was not terminated by string');
				thingsToTerminate.shift();
				if (thingsToTerminate[0] == '}') {
					if (objectExpectsNext[0] == 'continue-key') {
						objectExpectsNext[0] = 'colon';
					} else {
						objectExpectsNext[0] = 'comma';
					}
				}
			} else {
				thingsToTerminate.unshift('"');
				if (objectExpectsNext[0] == 'start-key') objectExpectsNext[0] = 'continue-key';
			}
			inString = !inString;
			break;
		case '[':
			if (inString) break;
			thingsToTerminate.unshift(']');
			break;
		case ']':
			if (inString) break;
			if (!thingsToTerminate.length || thingsToTerminate[0] != ']') throw new Error('Array not terminated');
			thingsToTerminate.shift();
			break;
		case '{':
			if (inString) break;
			thingsToTerminate.unshift('}');
			objectExpectsNext.unshift('start-key');
			break;
		case '}':
			if (inString) break;
			if (!thingsToTerminate.length || thingsToTerminate[0] != '}') throw new Error('Object not terminated');
			thingsToTerminate.shift();
			objectExpectsNext.unshift();
			break;
		case ':':
			if (inString) break;
			if (thingsToTerminate[0] != '}') break;
			objectExpectsNext[0] = 'value';
			break;
		case ',':
			if (inString) break;
			if (thingsToTerminate[0] != '}') break;
			objectExpectsNext[0] = 'start-key';
			break;
		}
		previousCharWasEscape = charIsEscape;
	}
	let finalString = partialJSON;
	for (const char of thingsToTerminate) {
		if (char == '}') {
			const next = objectExpectsNext.shift();
			if (!next) throw new Error('Empty objectExpectsNext');
			switch(next) {
			case 'colon':
				finalString += ':null';
				break;
			case 'comma':
				finalString += '';
				break;
			case 'start-key':
				//It can be an empty object
				finalString += '';
				break;
			case 'continue-key':
				//The string was already closed in an earlier iteration
				finalString += ':null';
				break;
			case 'value':
				finalString += '';
				break;
			default:
				assertUnreachable(next);
			}
		}
		finalString += char;
	}
	try {
		return JSON.parse(finalString);
	} catch(error) {
		throw new Error(`Could not parse partial json *${finalString}*: ${error}`);
	}
};