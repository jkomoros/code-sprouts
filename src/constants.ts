export const SPROUT_EXAMPLE_DIR = 'examples';
export const SPROUT_SPROUT_DIR = 'sprouts';

export const DEFAULT_SPROUT_DIRECTORIES = [SPROUT_SPROUT_DIR, SPROUT_EXAMPLE_DIR];

//Also in .vscode/settings.json
export const DIRECTORY_LISTING_FILE = 'directory.json';

//Relative to the sprout root
//Note: when any of these are changed, also change types.ts:PackagedSprout
export const SPROUT_INSTRUCTIONS_PATH = 'instructions.md';
export const SPROUT_SCHEMA_PATH = 'schema.ts';
export const SPROUT_SUBINSTUCTIONS_DIR = 'sub_instructions';
//Note: also update .vscode/settings.json when changing these next ones
export const SPROUT_CONFIG_PATH = 'sprout.json';
export const SPROUT_COMPILED_PATH = 'sprout.compiled.json';

export const BASE_SPROUT_PATHS = [SPROUT_INSTRUCTIONS_PATH, SPROUT_SCHEMA_PATH, SPROUT_CONFIG_PATH];
export const BASE_SPROUT_DIRECTORIES = [SPROUT_SUBINSTUCTIONS_DIR];
export const FILE_EXTENSIONS_IN_SPROUT = ['.md', '.ts', '.json'];