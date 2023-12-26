# Code Sprout

This is a very simple tool to help create simple interactive bots that are primarily programmed using plain language, as well as a bit of structured state management.

⚠️ There's not much to see here yet. ⚠️

## Running

Install dependencies with `npm install`.

Open a terminal window and run `npm run start`.

Run the tool with `node build/src/index.js`. The tool will ask for your OPENAI_API_KEY on first run if not set, and offer to save it in a `.env` file for you.

## Creating a Sprout


A sprout is a named folder (typically in `sprouts/` but with version-controlled sprouts in `examples/` too) with the following directory shape:

```
- [sprout-name] /
  - config.json - Documents metadata about the sprout.
  - instructions.md - The top-level instructions to the bot, included in each turn.
  - schema.ts - A file that documents the state that the bot should use to store all relevant state from turn to turn, other than the most recent user message.
```

Sprouts are passed the current state object as of the last turn, and also the last user message they received, and are then asked to return a message to show to the user, and optionally a JSON Patch to modify the state object for the next turn.

## What is the logic of doing it this way?

This approach is in someways exactly the opposite of how most LLM-powered things are done.

Most LLM-powered features put LLMs in the driver's seat, and everything else is downstream of their choices.

Code Sprout is an experiment that uses LLMs as a kind of general-purpose english language programming language that can be used as a sub-component of a system a human author structured. LLMs not as jockey, but horse. LLMs not as the machine, but a cog in a larger machine.

Code Sprout's approach comes out of a few observations: LLMs can sometimes "lose the plot" on what they're supposed to be doing and how to do it... especially if the back and forth conversation with a human gets very long. Code Sprout puts the LLM on rails and constantly reminds them what they are supposed to do. It uses LLMs as a kind of general purpose "extract out of this english message the corresponding domain-specific state diff".

The traditional LLM approach is best for open-ended, mostly english tasks. The Code Sprout approach might be better for mostly-structured-but-kind-of-squishy-in-the-middle kinds of use cases. Which kind of task will it turn out to be more common for people to apply LLMs to? I have no idea!

It might turn out that this approach works well in a lot of useful cases; it might turn out it doens't work at all except in a set of hyper specific contrived use cases. That's why it's good to experiment and see if it makes any sense!

## Developing

After changing the JSON format of files, run `npm run generate:schemas` to re-update schemas.