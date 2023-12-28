import {
	Sprout
} from '../src/sprout.js';

//TODO: accept a way to signal that this should cancel.
export const runSprout = async (sprout : Sprout) => {
	await sprout.validate();

	const active = true;
	//TODO: support images
	while(active) {
		//TODO: stream to output
		const message = await sprout.conversationTurn();
		console.log('result', message);
		//TODO: better UI to allow user to provide a response.
		const response = prompt('What is your response?');
		sprout.provideUserResponse(response || '');
	}
};