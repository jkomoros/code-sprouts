import {
    z
} from 'zod';

const sproutConfigSchema = z.object({
    version: z.literal('0')
});

export type SproutConfig = z.infer<typeof sproutConfigSchema>;