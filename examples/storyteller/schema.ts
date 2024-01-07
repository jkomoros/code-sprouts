export type State = {
    //The name of the child in the story.
    protagonistName?: string;
    //Settings for stories, things like "jungle" or "castle"
    setting?: string;
    //Sentence-long summaries of major events in the story so far.
    events: string[];
}