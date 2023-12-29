import {
	z
} from 'zod';

import {
	Prompt,
	SproutState
} from '../src/types';

export const urlHashArgs = z.object({
	//No properties
	//TODO: verify there aren't multiple unncessary UPDATE_HASH events.
});

export const sproutLocationSchema = z.string();

export type SproutLocation = z.infer<typeof sproutLocationSchema>;

export const sproutDataMapSchema = z.record(sproutLocationSchema, z.boolean());

export type SproutDataMap = z.infer<typeof sproutDataMapSchema>;

export type URLHashArgs = z.infer<typeof urlHashArgs>;

export type ConversationTurn = {
	speaker: 'user'
	message: Prompt
} | {
	speaker: 'sprout',
	message: Prompt,
	state?: SproutState
};

export type Conversation = ConversationTurn[];