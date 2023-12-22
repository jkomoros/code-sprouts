# Code Sprout

This is a very simple tool to help create simple interactive bots that are primarily programmed using plain language, as well as a bit of structured state management.

⚠️ There's not much to see here yet. ⚠️

## Running

Install dependencies with `npm install`.

Open a terminal window and run `npm run start`.

Set an environment variable with your OPENAI_API_KEY:

`export OPENAI_API_KEY=<YOUR KEY HERE>`

Run the tool with `node build/src/index.js`

## Creating a Sprout

TODO: allow creating a non-version-controlled sprout.

A sprout is a named folder (currently within `examples/`) with the following directory shape:

```
- [sprout-name] /
  - config.json - Documents metadata about the sprout.
  - instructions.md - The top-level instructions to the bot, included in each turn.
  - schema.ts - A file that documents the state that the bot should use to store all relevant state from turn to turn, other than the most recent user message.
```

Sprouts are passed the current state object as of the last turn, and also the last user message they received, and are then asked to return a message to show to the user, and optionally a JSON Patch to modify the state object for the next turn.