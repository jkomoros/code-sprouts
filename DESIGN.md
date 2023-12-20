
What I kind of want is a little harness / wrapper around the OpenAI completion APIs. It would have a top-level description of the behavior, a list of actions that it can do and a high level description, and then a typescript schema annotated with the meaning of each field.

The idea is that the GPT wouldn't get the full context window, but only the prompt + current state object + last user message + any specific command instructions it asked for last turn. Each turn the GPT would provide at least one of: a response to show the user, a JSONDiff to update the state object, and an instruction to get more detail on how to use.

The user wouldn't see anything except the messages that are supposed to be shown to them. Then the harness would handle diffing the state object and providing the new one in the next prompt completion.

And the instructions would be automatically summarized in the prompts.

Directory structure:

- /
  - README.md
  - .state/
    //state sharded by named runner.
    - default-demo/
        info.json - Contains pointers to e.g. the current active session, etc.
        - compiled/
            - prompt.md - The compiled main prompt (instructions.md + schema.ts + summarized instructions)
        - sessions/
            //The whole back and forth.
            - abbccdef.json 
  - build/
    //Compiled runners
  - src/
    //Files to run it
  - examples/
    // a folder is 'runnable' by having a known shape.
    - default-demo/
        - config.json - Confgiures things like 'how many past user messages to share.'
        - instructions.md - Intiial instructions at the top of each (minus sub-expression instruction)
        - schema.ts - A typescript file that just defines the typescript schema. It's not actually compiled.
        - sub_instructions/
            - (An optional list of sub_instructions, which will be compiled. The name of the file is the name of the sub_instruction. The LLM can request more info on each one in a turn)
        - endpoints/
            - (Something zod-shaped for things into and out of)
  - sprouts/
    (Not checked into version contorl, the place for someone to define their own sprouts)

TODO - Have a way to have zod-shaped endpoints that are validated by Zod.
TODO - figure out a way to include images.

TODO - Figure out should the overall state schema be in Typescript or Zod? Zod doesn't handle duplication... but does give you a verifier. And also allows a way to express defaults. Maybe have it be defined in Zod, but then auto-translated to typescript? Or vice versa? Vice versa probably works. 

Example:

----

 have the following typescript schema:

```
type ResponseType = 'a' | 'b' | 'c'
type Response = {
  type: ResponseType, //default: 'a'
  message: string, 
  turns: number //default: 1
  subObject?: {
    a: string,
    b: number
  }
}

```

Write a zod schema to match this, as well as a function to return a new object matching Response, with defaults set to the default empty value of the type (e.g. '' for string, 0 for number, empty for an optional property) or the explicitly commented default

Produces 

```
import { z } from 'zod';

const ResponseType = z.union([z.literal('a'), z.literal('b'), z.literal('c')]);

const Response = z.object({
  type: ResponseType.default('a'),
  message: z.string(),
  turns: z.number().default(1),
  subObject: z.object({
    a: z.string(),
    b: z.number()
  }).optional()
});

function createDefaultResponse(): z.infer<typeof Response> {
  return Response.parse({});
}
```

----

Response from the LLM: 
type LLMResponse = {
    //Message to show to the user
    messageToUser: string,
    //A diff of the state to apply.
    diff?: JSONDiff
} | {
    //An instruction to get more description of. Nothing will show to the user.
    requestInstruction: InstructionType
}

type BaseSessionTurn = {
    timestamp: Timestamp,
}

type UserSessionTurn = BaseSessionTurn & {
    type: 'user'
    userMessage: string 
}

type LLMRequestInstructionSessionTurn = BaseSessionTurn & {
    type: 'instruction',
    requestInstruction: InstructionType
}

type LLMUserMessageSessionTurn = BaseSessionTurn & {
    type: 'message',
    messageToUser: string,
    diff? : JSONDiff
}

type SystemSessionTurn = {
    type: 'system',
    systemMessage: string
}

type SessionTurn = UserSessionTurn
    | LLMRequestInstructionSessionTurn
    | LLMUserMessageSessionTurn
    | SystemSessionTurn;

type Session = {
    turns: SessionTurn[]
}