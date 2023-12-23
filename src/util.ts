export const assertUnreachable = (x : never) : never => {
	throw new Error('Exhaustiveness check failed: ' + String(x));
};

export const completeAndParseJSON = (partialJSON : string) : unknown => {
	try {
		return JSON.parse(partialJSON);
	} catch(error) {
		switch(partialJSON.slice(-1, 1)) {
		case '"':
			partialJSON += '}';
			break;
		default:
			partialJSON += '"}';
			break;
		}
		return JSON.parse(partialJSON);
	}
};