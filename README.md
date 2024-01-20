# Code Sprouts
<img src='images/manifest/icon-96x96.png?raw=true' align='right' />
This is a very simple tool to help create simple interactive bots that are primarily programmed using plain language, as well as a bit of structured state management.

You can see a live demo at https://code-sprouts.org.

In the webapp, you can select a sprout to run from the dropdown, or add a sprout. You can paste a remote URL pointing to a sprout that lives elsewhere and it will run it. At any time, you can share your URL with someone else and it will run the same sprout you're running.

## Running

Install dependencies with `npm install`.

Open a terminal window and run `npm run start`.

You can now interact with the app at `https://localhost:8081`.

You can also interact with your sprouts from the command line via `node build/src/index.js`.

The first time you run either the webapp or the CLI it will ask you to set your OPENAI_API_KEY if not already set.

## Overview of Code Sprouts

Think of Code Sprouts like OpenAI's GPTs, but hosted wherever you want them to be, and with more intricate possibilities for complex logic.

OpenAI's GPTs are simple pre-built configurations that provide ChatGPT with a starting prompt to tell it how to behave with the user. Users can "install" these bots by visiting ChatGPT and going to its directory. These bots allow tinkerers--even ones without a technical background--to create custom bots that reflect their expertise and goals. GPTs are great, but they are only usable within the proto-aggregator of ChatGPT. At this era of ecosystem development, it's time for open-ended tinkering across the whole ecosystem.

Code Sprouts are run by a viewer. This project is the canonical viewer; you can host your own instance, or use https://code-sprouts.web.app/ for convenience.

A viewer is pointed at a specific Code Sprout to execute it. A Code Sprout is a folder of static, declarative configuration describing the behavior of the sprout. A user would point their viewer at the sprout folder. This viewer allows doing that easily from the URL: `https://code-sprouts.web.app/view/raw.githubusercontent.com/jkomoros/code-sprouts/main/examples/eliza` would load up the code sprout hosted at `https://raw.githubusercontent.com/jkomoros/code-sprouts/main/examples/eliza`. The default web app comes preloaded with a few examples accessible via a drop-down.

Because Code Sprouts are declarative and static, **the sprout cannot view any information about the user**, including the messages sent to the bot or the user's API keys. The only thing a sprout's owner would be able to tell is that someone somewhere fetched the sprout configuration.

The Code Sprout folder has a few files within it declaring the behavior of the sprout (described in the next section). Sprouts can also be "compiled" into a single file containing all of the processed configuration. This allows viewers to run the sprout with only a single fetch and without additional processing. If the compiled version is not available, the viewer falls back on fetching the individual files.

You can create sprouts by hand by creating files in the `sprouts/` directory, or by using a GUI editor in the webapp to create private, local sprouts.

Code Sprouts are not exactly like GPTs. A few differences:
- Creators and end-users must (currently) provide their own `OPENAI_API_KEY` to a viewer to run each sprout.
- Creators can host their configuration anywhere they want, and end-users can use whatever sprout viewer they want.
- Code Sprouts do not currently support uploading additional content to do RAG-style bots.
- Code Sprouts allow more complex state management logic and instruction management than GPTs.
- Code Sprouts can use other LLM providers. Anthropic support is ready to enable as soon as they [allow their SDK to run in browsers](https://github.com/anthropics/anthropic-sdk-typescript/issues/248).

## Creating a Sprout

This section walks through creating a sprout by creating files. The web app also has a GUI for creating sprouts. Just click the plus icon next to the sprout selector and you can start editing a sprout live without writing any code.

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

Let's work through `examples/eliza` example to make this more concrete.

First, look at its `sprout.json`:

```
{
    "version": 0,
    "title": "Eliza",
    "description": "A bot to emualte the original ELIZA bot"
}
```

Everything in this file except for version is optional. The existence of this file with a valid version is how the library can tell that a given folder is supposed to be interpreted as a sprout.

`instructions.md` is where the meat of the bot is, and it is also simple:

```
Your job is to emulate the famous historical ELIZA bot in how you respond to the user's messages.

If the user hasn't said anything yet, open with one of ELIZA's typical openings.
```

Based on this configuration, for each conversation turn the bot is given something like this as its prompt:

```
Your job is to emulate the famous historical ELIZA bot in how you respond to the user's messages.

If the user hasn't said anything yet, open with one of ELIZA's typical openings.

The last user message (VERY IMPORTANT that you respond to this):
# User:
> <INITIAL>

It is VERY IMPORTANT that you should respond with only a literal JSON object (not wrapped in markdown formatting or other formatting) matching this schema:
{
  type: 'default',
  //The message that will be shown to the user.
  messageForUser: string
}
```

On later conversation turns, it will also receive a transcript of the conversation up until that point, too:

```
Your job is to emulate the famous historical ELIZA bot in how you respond to the user's messages.

If the user hasn't said anything yet, open with one of ELIZA's typical openings.

The previous conversation (for context only):
# Sprout:
> Hello. How are you doing today?
# User:
> I'm doing fine!
# Sprout:
> I'm glad to hear that you're doing fine. What has been on your mind lately?

The last user message (VERY IMPORTANT that you respond to this):
# User:
> I'm feeling very content.

It is VERY IMPORTANT that you should respond with only a literal JSON object (not wrapped in markdown formatting or other formatting) matching this schema:
{
  type: 'default',
  //The message that will be shown to the user.
  messageForUser: string
}
```

Sometimes however you want to represent more state to the bot than just the discussion.

Let's look now at a more complex example, `examples/limerick`.

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

The presence of `schema.ts` is what tells the library to help the bot manage state on its behalf.

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

The last user message (VERY IMPORTANT that you respond to this):
# User:
> <INITIAL>

Your current state is:
{
	"limerickTopic": ""
}

It is VERY IMPORTANT that you should respond with only a literal JSON object (not wrapped in markdown formatting or other formatting) matching this schema:
{
  type: 'default',
  //The message that will be shown to the user.
  messageForUser: string
  //The change to make to the current state object based on this turn. If no modification needs to be made, can just be [].
  patch : JSONPatchRFC6902
}

Provide a patch to update the state object based on the users's last message and your response.
```

On subsequent turns, a fresh history is passed to the bot, including the last messages from the user and the updated state object after the patch from the last turn was applied.

This example uses the state for only very simple purposes, but it's possible to build very complex experiences with more state. For example, here's the `schema.ts` for `examples/storytellers`:

```
export type State = {
    //The names of the authors that are stylistic influences the user told us about.
    stylisticInfluences?: string[]
    //The name of the child in the story.
    protagonistName?: string;
    //Settings for stories, things like "jungle" or "castle".
    setting?: string;
    //Characters other than the protagonist.
    characters : {
        //The name of the character
        name: string,
        //A short description of the character
        description: string,
        //Whether the character has been introduced in the story yet (or was provied by the user)
        established : boolean,
        //Things like 'brother' or 'friend'
        relationshipToProtagonist?: string,
        //Any characteristics that have been established about the character
        characteristics?: string[]
    }[]
    //Sentence long descriptions of any established plot points in the story
    //that should be respected in future parts of the story. For example, this
    //might include things like "The knight's sister is the queen".
    plotPoints: string[];
}
```

More complex sprouts might have sub-instructions, which are summarized for the bot and it can ask for more detail on before responding. You can look at `examples/codenames` for a complex example.

### sprout.json fields

#### formatVersion : number

Required. The version of the format, currently only accepts `0`.

#### title (optional) : string

The title of the bot to show to the user

#### description (optional) : string

The description of the bot to show to the user

#### allowImages (optional) : boolean

If true, then the bot will alow image input.

#### allowFormatting (optional) : boolean

If true, then the bot will be told it may return markdown formatting

#### forkedFrom (optional) : URL string

If provided, describes the sprout that this was forked from.

## Deploying

`npx firebase use <your-project-id>`
`npm run deploy`

## Why not just build this as a GPT?

GPTs are a great way to build things like this. However, there's a few problems.

First, GPTs have no way to hide part of their response from a user. For the pattern of maintaining state by repeating it after every turn, this provides a lot of mess.

Second, for brevity we want state object updates to be a patch, not having to repeat the whole object each time.

Finally, ChatGPT is a proto-aggregator. That's convenient, but the more you invest in building experiences for it, the more you're ensuring that it's the only source of user demand in the future--and the more beholden you will be to it as a creator. Having your own GPT-like experiences outside of an aggregator allows you to experiment without worrying about empowering a proto-aggregator.

Another benefit of this approach: by running locally on the user's browser, it requires the bot configuration to be fully public: view-source-able. This view-source-ability is one of the things that helps tinkerers learn from others and create cool new things, and is perfect for the "community gardening" phase.

Finally, LLMs excel at text, so it's natural the first interface for them is "chat". But chat isn't the be-all-end-all interaction paradigm; it is rather a specific instantiation of a more general thing (see, for example https://komoroske.com/threads ). The way code sprouts are architected, it's more about the sprout suggesting a new thing to add to the shared output (which, to start, is a chat log). This format will allow more innovation in UX.

## What is the logic of doing it this way?

This approach is in someways exactly the opposite of how most LLM-powered things are done.

Most LLM-powered features put LLMs in the driver's seat, and everything else is downstream of their choices.

Code Sprout is an experiment that uses LLMs as a kind of general-purpose english language programming language that can be used as a sub-component of a system a human author structured. LLMs not as jockey, but horse. LLMs not as the machine, but a cog in a larger machine.

Instead of the fundamental concept being a conversation that the user and the bot are appending to, the fundamental concept is a single converastion turn where the sprout is provided some context (managed by the harness) to respond to with an update. Today, the context always includes a summary of the conversation to date, but in the future it might not. Today, the reponse always has a user visbile message, but in the future it might not. You could imagine, for example, a bot that draws on a shared canvas with a user. In this reframe, the conversation is not the fundamental semantic, but actually a special-case semantic constructed on top of the framework provided context -> bot action semantic.

Code Sprout's approach comes out of a few observations: LLMs can sometimes "lose the plot" on what they're supposed to be doing and how to do it... especially if the back and forth conversation with a human gets very long. Code Sprout puts the LLM on rails and constantly reminds them what they are supposed to do. It uses LLMs as a kind of general purpose "extract out of this english message the corresponding domain-specific state diff".

The traditional LLM approach is best for open-ended, mostly english tasks. The Code Sprout approach might be better for mostly-structured-but-kind-of-squishy-in-the-middle kinds of use cases. Which kind of task will it turn out to be more common for people to apply LLMs to? I have no idea!

It might turn out that this approach works well in a lot of useful cases; it might turn out it doens't work at all except in a set of hyper specific contrived use cases. That's why it's good to experiment and see if it makes any sense!