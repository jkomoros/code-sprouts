export const assertUnreachable = (x : never) : never => {
	throw new Error('Exhaustiveness check failed: ' + String(x));
};

//TODO: test this
export const completeAndParseJSON = (partialJSON : string) : unknown => {
	if (!partialJSON) return null;
	const thingsToTerminate : ('"' | ']' | '}')[] = [];
	let previousCharWasEscape = false;
	let inString = false;
	
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
				if (!thingsToTerminate.length || thingsToTerminate[0] != '"') throw new Error('String was not terminated by string');
				thingsToTerminate.shift();
			} else {
				thingsToTerminate.unshift('"');
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
			break;
		case '}':
			if (inString) break;
			if (!thingsToTerminate.length || thingsToTerminate[0] != '}') throw new Error('Object not terminated');
			thingsToTerminate.shift();
			break;
		}
		previousCharWasEscape = charIsEscape;
	}
	const finalString = partialJSON + thingsToTerminate.join('');
	try {
		return JSON.parse(finalString);
	} catch(error) {
		throw new Error(`Could not parse partial json *${finalString}*: ${error}`);
	}
};