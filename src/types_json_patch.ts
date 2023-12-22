import {
	z
} from 'zod';

// Define schema for each operation type
const addOpSchema = z.object({
	op: z.literal('add'),
	path: z.string(),
	value: z.unknown(),
});

const removeOpSchema = z.object({
	op: z.literal('remove'),
	path: z.string(),
});

const replaceOpSchema = z.object({
	op: z.literal('replace'),
	path: z.string(),
	value: z.unknown(),
});

const moveOpSchema = z.object({
	op: z.literal('move'),
	from: z.string(),
	path: z.string(),
});

const copyOpSchema = z.object({
	op: z.literal('copy'),
	from: z.string(),
	path: z.string(),
});

const testOpSchema = z.object({
	op: z.literal('test'),
	path: z.string(),
	value: z.undefined(),
});

// Union schema for any JSON Patch operation
const jsonPatchOpSchema = z.union([
	addOpSchema,
	removeOpSchema,
	replaceOpSchema,
	moveOpSchema,
	copyOpSchema,
	testOpSchema,
]);

// Schema for a JSON Patch document (an array of operations)
const jsonPatchDocumentSchema = z.array(jsonPatchOpSchema);

export const jsonPatchRFC6902Schema = jsonPatchDocumentSchema;

export type JSONPatchRFC6902 = z.infer<typeof jsonPatchRFC6902Schema>;