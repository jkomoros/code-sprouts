export const focusElementIfNoOtherFocus = (input : HTMLElement) : void => {
	if (document.activeElement === document.body) input.focus();
};

export const eleFromEvent = <E extends HTMLElement = HTMLButtonElement>(e: Event, type: new () => E): E => {
	for (const candidate of e.composedPath()) {
		if (candidate instanceof type) return candidate as E;
	}

	throw new Error(`No element of type ${type.name} found in event path`);
};

export const baseFileName = (filename : string) : string => {
	const parts = filename.split('.');
	return parts.slice(0, parts.length - 1).join('.');
};