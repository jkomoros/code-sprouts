import {
	Sprout
} from '../src/sprout.js';

//TODO: accept a way to signal that this should stop (for example, right now if you select a different codename it doesn't end).
export const runSproutInBrowser = async (sprout : Sprout) => {
	await sprout.validate();

	const active = true;
	//TODO: support images
	while(active) {
		//TODO: stream to output
		const message = await sprout.conversationTurn({
			//For some reason if you don't pass a stream logger it doesn't work.
			streamLogger: () => {}
		});
		console.log('result', message);
		//TODO: better UI to allow user to provide a response.
		const response = prompt(`The AI said:\n${message}\n\nWhat is your response?`);
		sprout.provideUserResponse(response || '');
	}
};