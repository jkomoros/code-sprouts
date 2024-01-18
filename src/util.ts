import {
	DIRECTORY_LISTING_FILE
} from './constants.js';

import {
	Path,
	FinalPath,
	DirectoryInfo,
	DirectoryListingFile,
	sproutBaseNameSchema,
	FileListingType
} from './types.js';

export const assertUnreachable = (x : never) : never => {
	throw new Error('Exhaustiveness check failed: ' + String(x));
};

//eslint-disable-next-line @typescript-eslint/no-explicit-any
export const mergeObjects = <T extends Record<string, any>>(base: T, extend: T): T => {
	if (typeof extend !== 'object' || extend === null) {
		return extend;
	}

	const merged: Partial<T> = { ...base };

	for (const key in extend) {
		if (Object.prototype.hasOwnProperty.call(extend, key)) {
			const baseValue = base[key];
			const extendValue = extend[key];

			if (typeof extendValue === 'object' && extendValue !== null && !Array.isArray(extendValue)) {
				merged[key] = mergeObjects(
					typeof baseValue === 'object' && baseValue !== null ? baseValue : {} as T[Extract<keyof T, string>],
					extendValue
				) as T[Extract<keyof T, string>];
			} else {
				merged[key] = extendValue as T[Extract<keyof T, string>];
			}
		}
	}

	return merged as T;
};

//path should be a non-final path, like `examples/codenames` or `github.com/jkomoros/code-sprout/examples/codenames`
//it will return either '' if it is not a remote path, or the domain name if it is.
export const pathIsRemote = (path : Path) : string => {
	const parts = path.split('/');
	if (parts.length == 0) return '';
	const firstPart = parts[0];
	//We assume that if it has a dot, it's a remote path.
	return firstPart.includes('.') ? firstPart : '';
};

export const makeFinalPath = (path : Path) : FinalPath => {
	return pathIsRemote(path) ? `https://${path}` : path;
};

export const joinPath = (...parts: Path[]): Path => {
	// Assuming the parts are URL segments, this will join them with '/' separators
	const intermediate = parts.join('/');
	return intermediate.split('/').filter(val => val !== '').join('/');
};

export const normalizeSproutPath = (path : Path) : Path => {
	if (path.startsWith('https://')) path = path.slice('https://'.length);
	if (path.endsWith('/')) path = path.slice(0, -1);
	return path;
};

export const shortenDisplayPath = (path : Path) : Path => {
	const parts = path.split('/');
	if (parts.length <= 3) return path;
	//Replace the middle parts with ellipses
	return [parts[0], '...', parts[parts.length - 1]].join('/');
};

const randomCharSetNumbers = '0123456789';
const randomCharSetLetters = 'abcdef';
const randomCharSet = randomCharSetNumbers + randomCharSetLetters;

export const randomString = (length : number, charSet = randomCharSet) => {
	let text = '';
	for (let i = 0; i < length; i++) {
		text += charSet.charAt(Math.floor(Math.random() * charSet.length));
	}
	return text;
};

export const trimExtraNewlines = (input : string) : string => {
	//Process the input to replace any runs of more than two newlines with two newlines.
	return input.replace(/\n{3,}/g, '\n\n');
};

export const deleteFileFromDirectoryInfo = (info : DirectoryInfo, path : Path) : void => {
	const parts = path.split('/');
	if (parts.length === 0) throw new Error('Invalid path');
	const firstPart = parts[0];
	if (parts.length === 1) {
		//We're at the end of the path.
		if (firstPart in info) {
			delete info[firstPart];
			return;
		}
		throw new Error(`File not found: ${path}`);
	}
	if (firstPart in info) {
		const directory = info[firstPart];
		if (!directory) throw new Error(`Couldn't find ${directory}`);
		if (typeof directory == 'string') throw new Error(`${directory} is a file not a directory`);
		return deleteFileFromDirectoryInfo(directory, parts.slice(1).join('/'));
	}
	throw new Error(`File not found: ${path}`);
};

export const deleteDirectoryFromDirectoryInfo = (info : DirectoryInfo, path : Path) : void => {
	const parts = path.split('/');
	if (parts.length === 0) throw new Error('Invalid path');
	const firstPart = parts[0];
	if (parts.length === 1) {
		//We're at the end of the path.
		if (firstPart in info) {
			const directory = info[firstPart];
			if (!directory) throw new Error(`Couldn't find ${directory}`);
			if (typeof directory == 'string') throw new Error(`${directory} is a file not a directory`);
			//this just kind of gets rid of all subdirectories and files implicitly.
			delete info[firstPart];
			return;
		}
		throw new Error(`Directory not found: ${path}`);
	}
	if (firstPart in info) {
		const directory = info[firstPart];
		if (!directory) throw new Error(`Couldn't find ${directory}`);
		if (typeof directory == 'string') throw new Error(`${directory} is a file not a directory`);
		return deleteDirectoryFromDirectoryInfo(directory, parts.slice(1).join('/'));
	}
	throw new Error(`File not found: ${path}`);
};

export const readFileFromDirectoryInfo = (info : DirectoryInfo, path : Path) : string => {
	const parts = path.split('/');
	if (parts.length === 0) throw new Error('Invalid path');
	const firstPart = parts[0];
	if (parts.length === 1) {
		//We're at the end of the path.
		if (firstPart in info) {
			const result = info[firstPart];
			if (typeof result != 'string') throw new Error(`${path} was a folder not a file`);
			return result;
		}
		throw new Error(`File not found: ${path}`);
	}
	if (firstPart in info) {
		const directory = info[firstPart];
		if (!directory) throw new Error(`Couldn't find ${directory}`);
		if (typeof directory == 'string') throw new Error(`${directory} is a file not a directory`);
		return readFileFromDirectoryInfo(directory, parts.slice(1).join('/'));
	}
	throw new Error(`File not found: ${path}`);
};

export const listDirectoryFromDirectoryInfo = (info : DirectoryInfo, path : Path, type: FileListingType) : Path[] => {
	const parts = path.split('/');
	if (parts.length === 0) throw new Error('Invalid path');
	const firstPart = parts[0];
	if (parts.length === 1) {
		//We're at the end of the path.
		if (!(firstPart in info)) return [];
		const directory = info[firstPart];
		if (typeof directory == 'string') throw new Error(`${path} is a file not a directory`);
		switch (type) {
		case 'both':
			return Object.keys(directory);
		case 'directory':
			return Object.keys(directory).filter(key => typeof directory[key] != 'string');
		case 'file':
			return Object.keys(directory).filter(key => typeof directory[key] == 'string');
		default:
			assertUnreachable(type);
		}
	}
	if (firstPart in info) {
		const directory = info[firstPart];
		if (typeof directory == 'string') throw new Error(`${path} is a file not a directory`);
		return listDirectoryFromDirectoryInfo(directory, parts.slice(1).join('/'), type);
	}
	throw new Error(`File not found: ${path}`);
};

const directoryListingForDirectoryInfo = (info : DirectoryInfo) : DirectoryListingFile => {
	return {
		directories: Object.keys(info).filter(key => typeof info[key] != 'string'),
		files: Object.keys(info).filter(key => typeof info[key] == 'string')
	};
};

//Modifies the info and sub-infos in place to add an up-to-date directory
//listing for each folder.
export const addDirectoryListings = (info : DirectoryInfo) : void => {
	info[DIRECTORY_LISTING_FILE] = JSON.stringify(directoryListingForDirectoryInfo(info), null, '\t');
	for (const contents of Object.values(info)) {
		if (typeof contents == 'string') continue;
		addDirectoryListings(contents);
	}
};

export const writeDirectoryToDirectoryInfo = (info : DirectoryInfo, path : Path, dir : DirectoryInfo) : void => {
	for (const [dirPath, dirValue] of Object.entries(dir)) {
		if (typeof dirValue == 'string') {
			writeFileToDirectoryInfo(info, joinPath(path, dirPath), dirValue);
		}
		else {
			writeDirectoryToDirectoryInfo(info, joinPath(path, dirPath), dirValue);
		}
	}
};

//Note: modifies directory in place. It keeps directory.json up to date.
export const writeFileToDirectoryInfo = (info : DirectoryInfo, path : Path, data : string) : void => {
	const parts = path.split('/');
	if (parts.length === 0) throw new Error('Invalid path');
	const firstPart = parts[0];
	if (parts.length === 1) {
		//We're at the end of the path.
		info[firstPart] = data;
		info[DIRECTORY_LISTING_FILE] = JSON.stringify(directoryListingForDirectoryInfo(info), null, '\t');
		return;
	}
	if (!(firstPart in info)) {
		info[firstPart] = {};
	}
	const directory = info[firstPart];
	if (!directory || typeof directory == 'string') throw new Error(`${path} is to a file`);
	return writeFileToDirectoryInfo(directory, parts.slice(1).join('/'), data);
};

export const absoluteRegExp = (r : RegExp) : RegExp => {
	return new RegExp('^' + r.source + '$');
};

export const sproutBaseNameLegal = async (proposedName : string) : Promise<boolean> => {
	//This function does not need to be async, but some embedding contexts will
	//override this in an async way.
	const parseResult = sproutBaseNameSchema.safeParse(proposedName);
	return parseResult.success;
};

const LOG_DEEP_EQUAL_DIFFERENCES = false;

//Tests for deep eqaulity of a and b. note: not yet tested for anythong other
//than objects, arrays, strings, numbers, bools.∑ If a and b are too non-equal
//objecst, and objectChecker is provided, then if both return true from
//objectChecker then deepEqual will short-circuit and return true.
export const deepEqual = (a : unknown, b : unknown, objectChecker : ((object: unknown) => boolean) | null = null) : boolean => {
	if (a === b) return true;
	if (!a || !b) return false;
	if (typeof a != 'object' || typeof b != 'object') return false;
	if (Array.isArray(a)) {
		if (!Array.isArray(b)) return false;
		if (a.length != b.length) return false;
		for (const [i, val] of a.entries()) {
			if (!deepEqual(b[i], val, objectChecker)) return false;
		}
		return true;
	}
	if (objectChecker && objectChecker(a) && objectChecker(b)) return true;
	//Two objects
	if (Object.keys(a).length != Object.keys(b).length) {
		if (LOG_DEEP_EQUAL_DIFFERENCES) {
			const aKeys = new Set(Object.keys(a));
			const bKeys = new Set(Object.keys(b));
			if (aKeys.size > bKeys.size) {
				const difference = [...aKeys].filter(x => !bKeys.has(x));
				console.log('a has keys ', difference, 'that b lacks', a, b);
			} else {
				const difference = [...bKeys].filter(x => !aKeys.has(x));
				console.log('b has keys ', difference, 'that a lacks', a, b);
			}
		}
		return false;
	}
	const stringKeyedB = b as {[key : string] : unknown};
	for (const [key, val] of Object.entries(a)) {
		if (!deepEqual(val, stringKeyedB[key], objectChecker)) {
			if (LOG_DEEP_EQUAL_DIFFERENCES) {
				console.log('Key', key, ' is different in a and b: ', val, stringKeyedB[key], a, b);
			}
			return false;
		}
	}
	return true;
};

export const clone = <T extends object>(input : T) : T => {
	//TODO: a proper implementation for this. Doesn't structuredClone work?
	return JSON.parse(JSON.stringify(input));
};