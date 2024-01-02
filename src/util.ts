import {
	DIRECTORY_LISTING_FILE
} from './constants.js';

import {
	TypedObject
} from './typed-object.js';

import {
	Path,
	FinalPath,
	PackagedSprout,
	CompiledSprout,
	DirectoryInfo,
	DirectoryListingFile,
	Fetcher,
	NakedDirectoryInfo,
	NakedPackagedSprout,
	FileInfo,
	sproutBaseNameSchema
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

export const makeDirectoryInfo = (naked : NakedDirectoryInfo, timestamp : string) : DirectoryInfo => {
	const result : DirectoryInfo = {
		directories: {},
		files: {}
	};
	for (const [name, value] of Object.entries(naked)) {
		if (typeof value === 'object') {
			result.directories[name] = makeDirectoryInfo(value, timestamp);
			continue;
		}
		result.files[name] = {
			content: value,
			lastModified: timestamp
		};
	}
	const directoryListing : DirectoryListingFile = {
		directories: Object.keys(result.directories),
		files: Object.keys(result.files)
	};
	result.files['directory.json'] = {
		content: JSON.stringify(directoryListing, null, '\t'),
		lastModified: timestamp
	};
	return result;
};

//TODO: this is currently unused.
export const packagedSproutFromCompiled = (compiled : CompiledSprout) : PackagedSprout => {
	const sprout : NakedPackagedSprout = {
		'sprout.json': JSON.stringify(compiled.config, null, '\t'),
		'instructions.md': compiled.baseInstructions,
		'sprout.compiled.json': JSON.stringify(compiled, null, '\t'),
	};
	if (compiled.schemaText) {
		sprout['schema.ts'] = compiled.schemaText;
	}
	if (Object.keys(compiled.subInstructions).length > 0) {
		sprout.sub_instructions = {};
		for (const [key, value] of Object.entries(compiled.subInstructions)) {
			sprout.sub_instructions[key] = value.instructions;
		}
	}
	return makeDirectoryInfo(sprout, compiled.lastUpdated) as PackagedSprout;
};

export const writeDirectoryInfo = async (fetcher : Fetcher, info : DirectoryInfo, path : Path = '') : Promise<void> => {
	for (const [directory, directoryInfo] of TypedObject.entries(info.directories)) {
		await writeDirectoryInfo(fetcher, directoryInfo, joinPath(path, directory));
	}
	for (const [filename, fileInfo] of TypedObject.entries(info.files)) {
		const filePath = joinPath(path, filename);
		await fetcher.writeFile(filePath, fileInfo.content);
	}
};

const readFileInfoFromDirectoryInfo = (info : DirectoryInfo, path : Path) : FileInfo => {
	const parts = path.split('/');
	if (parts.length === 0) throw new Error('Invalid path');
	const firstPart = parts[0];
	if (parts.length === 1) {
		//We're at the end of the path.
		if (firstPart in info.files) {
			return info.files[firstPart];
		}
		throw new Error(`File not found: ${path}`);
	}
	if (firstPart in info.directories) {
		return readFileInfoFromDirectoryInfo(info.directories[firstPart], parts.slice(1).join('/'));
	}
	throw new Error(`File not found: ${path}`);
};

export const readFileFromDirectoryInfo = (info : DirectoryInfo, path : Path) : string => {
	const fileInfo =  readFileInfoFromDirectoryInfo(info, path);
	return fileInfo.content;
};

export const fileLastUpdatedFromDirectoryInfo = (info : DirectoryInfo, path : Path) : Date => {
	const fileInfo = readFileInfoFromDirectoryInfo(info, path);
	return new Date(fileInfo.lastModified);
};

export const listDirectoryFromDirectoryInfo = (info : DirectoryInfo, path : Path) : Path[] => {
	const parts = path.split('/');
	if (parts.length === 0) throw new Error('Invalid path');
	const firstPart = parts[0];
	if (parts.length === 1) {
		//We're at the end of the path.
		if (!(firstPart in info.directories)) return [];
		return Object.keys(info.directories[firstPart].directories);
	}
	if (firstPart in info.directories) {
		return listDirectoryFromDirectoryInfo(info.directories[firstPart], parts.slice(1).join('/'));
	}
	throw new Error(`File not found: ${path}`);
};

const directoryListingForDirectoryInfo = (info : DirectoryInfo) : DirectoryListingFile => {
	return {
		directories: Object.keys(info.directories),
		files: Object.keys(info.files)
	};
};

//Note: modifies directory in place. It keeps directory.json up to date.
export const writeFileToDirectoryInfo = (info : DirectoryInfo, path : Path, data : string) : void => {
	const parts = path.split('/');
	if (parts.length === 0) throw new Error('Invalid path');
	const firstPart = parts[0];
	if (parts.length === 1) {
		//We're at the end of the path.
		info.files[firstPart] = {
			content: data,
			lastModified: new Date().toISOString() 
		};
		info.files[DIRECTORY_LISTING_FILE] = {
			content: JSON.stringify(directoryListingForDirectoryInfo(info), null, '\t'),
			lastModified: new Date().toISOString()
		};
		return;
	}
	if (!(firstPart in info.directories)) {
		info.directories[firstPart] = {
			directories: {},
			files: {}
		};
	}
	return writeFileToDirectoryInfo(info.directories[firstPart], parts.slice(1).join('/'), data);
};

export const absoluteRegExp = (r : RegExp) : RegExp => {
	return new RegExp('^' + r.source + '$');
};

export const sproutBaseNameLegal = (proposedName : string) : boolean => {
	const parseResult = sproutBaseNameSchema.safeParse(proposedName);
	return parseResult.success;
};
