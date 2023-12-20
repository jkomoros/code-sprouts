import {
    z
} from 'zod';

const pathSchema = z.string();

export type Path = z.infer<typeof pathSchema>;