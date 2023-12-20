import {
    z
} from 'zod';

const pathSchema = z.string();

export type Path = z.infer<typeof pathSchema>;

const sproutName = z.string();

export type SproutName = z.infer<typeof sproutName>;

export const sproutConfigSchema = z.object({
    version: z.literal(0)
});

export type SproutConfig = z.infer<typeof sproutConfigSchema>;