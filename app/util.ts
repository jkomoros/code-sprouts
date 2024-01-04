export const focusElementIfNoOtherFocus = (input : HTMLElement) : void => {
	if (document.activeElement === document.body) input.focus();
};