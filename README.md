# Code Sprout

This is a very simple tool to help create simple interactive bots that are primarily programmed using plain language, as well as a bit of structured state management.

You can see a live demo at https://code-sprouts.web.app.

In the webapp, you can select a sprout to run from the dropdown, or add a sprout. You can paste a remote URL pointing to a sprout that lives elsewhere and it will run it. At any time, you can share your URL with someone else and it will run the same sprout you're running.

## Running

Install dependencies with `npm install`.

Open a terminal window and run `npm run start`.

You can now interact with the app at `https://localhost:8081`.

You can also interact with your sprouts from the command line via `node build/src/index.js`.

The first time you run either the webapp or the CLI it will ask you to set your OPENAI_API_KEY if not already set.

## Creating a Sprout

A sprout is a named folder (typically in `sprouts/` but with version-controlled sprouts in `examples/` too) with the following directory shape:

```
- [sprout-name] /
  - sprout.json - Documents metadata about the sprout.
  - instructions.md - The top-level instructions to the bot, included in each turn.
  - schema.ts - A file that documents the state that the bot should use to store all relevant state from turn to turn, other than the most recent user message.
  - sub_instructions/ - An optional directory of sub-instructions.
    //Each file is the name of a sub-instruction the bot can consult for more information
    deal_cards.md - An example that will be called deal_cards.
```

Sprouts can be run by pointing at the sprout directory they reside in. However, running an uncompiled sprout requires fetching multiple files and possibly generating some expensive intermediate results. Sprouts can also be compiled into a single file that contains all of the information necessary to run them. When you use `npm run start` or any other node commands, the sprouts will be compiled automatically. You can also run `npm run compile:sprouts` to compile any local sprouts that require it.

Sprouts are passed the current state object as of the last turn, and also the last user message they received, and are then asked to return a message to show to the user, and optionally a JSON Patch to modify the state object for the next turn.

Let's work through `examples/default-demo` example to make this more concrete.

It defines the following base instructions in `instructions.md`:
```
Your job is to write a delightful little limerick about the topic the user has provided.

If the topic is empty, ask for the topic first.
```

It also defines the following schema to store its state: `schema.ts`;
```
export type State = {
    limerickTopic : string; 
};
```

For each turn of the conversation, the Sprout runner constructs a new prompt to
pass to the bot and get its response. It passes in the last state object and
last user message. Here's an example of the prompt passed to the bot for the first turn:

```
Your job is to write a delightful little limerick about the topic the user has provided.

If the topic is empty, ask for the topic first.

You will manage your state in an object conforming to the following schema:
export type State = {
    limerickTopic : string; 
};

When relevant or requested, summarize the state in a way that a non-technical user would understand. If the user explicitly asks what is in the state object, reproduce it exactly.

Your current state is:
{
	"limerickTopic": ""
}

The last user message (VERY IMPORTANT that you respond to this):

<INITIAL>
---

It is VERY IMPORTANT that you should respond with only a literal JSON object (not wrapped in markdown formatting or other formatting) matching this schema:
{
  type: 'default',
  //The message that will be shown to the user.
  messageForUser: string
  //The change to make to the current state object based on this turn. If no modification needs to be made, can just be [].
  patch : JSONPatchRFC6902
}

You are not configured to receive images from the user

Provide a patch to update the state object based on the users's last message and your response.
```

On subsequent turns, a fresh history is passed to the bot, including the last messages from the user and the updated state object after the patch from the last turn was applied.

More complex sprouts might have sub-instructions, which are summarized for the bot and it can ask for more detail on before responding. You can look at `examples/codenames` for a complex example.

## Deploying

`npx firebase use <your-project-id>`
`npm run deploy`

## Why not just build this as a GPT?

GPTs are a great way to build things like this. However, there's a few problems.

First, GPTs have no way to hide part of their response from a user. For the pattern of maintaining state by repeating it after every turn, this provides a lot of mess.

Second, for brevity we want state object updates to be a patch, not having to repeat the whole object each time.

Finally, ChatGPT is a proto-aggregator. That's convenient, but the more you invest in building experiences for it, the more you're ensuring that it's the only source of user demand in the future--and the more beholden you will be to it as a creator. Having your own GPT-like experiences outside of an aggregator allows you to experiment without worrying about empowering a proto-aggregator.

## What is the logic of doing it this way?

This approach is in someways exactly the opposite of how most LLM-powered things are done.

Most LLM-powered features put LLMs in the driver's seat, and everything else is downstream of their choices.

Code Sprout is an experiment that uses LLMs as a kind of general-purpose english language programming language that can be used as a sub-component of a system a human author structured. LLMs not as jockey, but horse. LLMs not as the machine, but a cog in a larger machine.

Code Sprout's approach comes out of a few observations: LLMs can sometimes "lose the plot" on what they're supposed to be doing and how to do it... especially if the back and forth conversation with a human gets very long. Code Sprout puts the LLM on rails and constantly reminds them what they are supposed to do. It uses LLMs as a kind of general purpose "extract out of this english message the corresponding domain-specific state diff".

The traditional LLM approach is best for open-ended, mostly english tasks. The Code Sprout approach might be better for mostly-structured-but-kind-of-squishy-in-the-middle kinds of use cases. Which kind of task will it turn out to be more common for people to apply LLMs to? I have no idea!

It might turn out that this approach works well in a lot of useful cases; it might turn out it doens't work at all except in a set of hyper specific contrived use cases. That's why it's good to experiment and see if it makes any sense!

## Developing

After changing the JSON format of files, run `npm run generate:schemas` to re-update schemas.