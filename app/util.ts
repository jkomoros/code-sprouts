export const focusElementIfNoOtherFocus = (input : HTMLElement) : void => {
	if (document.activeElement === document.body) input.focus();
};

export const eleFromEvent = (e : Event) : HTMLElement => {
	for (const candidate of e.composedPath()) {
		if (candidate instanceof HTMLButtonElement) return candidate;
	}

	throw new Error(`No ele of type ${HTMLElement.name} found in event path`);
};