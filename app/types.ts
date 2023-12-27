import {
	z
} from 'zod';

export const urlHashArgs = z.object({
	//No properties
	//TODO: verify there aren't multiple unncessary UPDATE_HASH events.
});

const sproutLocationSchema = z.string();

export const sproutDataMapSchema = z.record(sproutLocationSchema, z.boolean());

export type SproutDataMap = z.infer<typeof sproutDataMapSchema>;

export type URLHashArgs = z.infer<typeof urlHashArgs>;