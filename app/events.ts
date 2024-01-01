
const DIALOG_SHOULD_CLOSE_EVENT_NAME = 'dialog-should-close';

type DialogShouldCloseEventDetail = {
	cancelled: boolean
};

export type DialogShouldCloseEvent = CustomEvent<DialogShouldCloseEventDetail>;

export const makeDialogShouldCloseEvent = (cancelled : boolean) : DialogShouldCloseEvent => {
	return new CustomEvent(DIALOG_SHOULD_CLOSE_EVENT_NAME, {composed: true, detail:{cancelled}});
};