import {
	z
} from 'zod';

export const urlHashArgs = z.object({
	//No properties
	//TODO: verify there aren't multiple unncessary UPDATE_HASH events.
});

export type URLHashArgs = z.infer<typeof urlHashArgs>;