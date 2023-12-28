import {
	Path,
	FinalPath
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
export const pathIsRemote = (path : Path) : boolean => {
	const parts = path.split('/');
	if (parts.length == 0) return false;
	const firstPart = parts[0];
	return firstPart.includes('.');
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