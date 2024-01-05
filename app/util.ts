export const focusElementIfNoOtherFocus = (input : HTMLElement) : void => {
	if (document.activeElement === document.body) input.focus();
};

export const eleFromEvent = <E extends HTMLElement = HTMLButtonElement>(e: Event, type: new () => E): E => {
	for (const candidate of e.composedPath()) {
		if (candidate instanceof type) return candidate as E;
	}

	throw new Error(`No element of type ${type.name} found in event path`);
};