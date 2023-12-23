export const assertUnreachable = (x : never) : never => {
	throw new Error('Exhaustiveness check failed: ' + String(x));
};

//TODO: test this
export const completeAndParseJSON = (partialJSON : string) : unknown => {
	if (!partialJSON) return null;
	const thingsToTerminate : ('"' | ']' | '}')[] = [];
	let previousCharWasEscape = false;
	let inString = false;
	//Each time we enter an object context we push another item on here to tell us if the next thing to expect is a string.
	const objectExpectsNext : ('start-key' | 'continue-key' | 'value' | 'colon' | 'comma')[] = [];
	
	//TODO: this doesn't work. 
	//the problem is that in an object context we need to know if the string we're in is a key or the value.
	//A way to handle this is to look at the first thingsToTerminate, and if it's '}' then we need to know if we have a key but no value.

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