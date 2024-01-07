export type State = {
    //The name of the child in the story.
    protagonistName?: string;
    //Settings for stories, things like "jungle" or "castle".
    setting?: string;
    //Sentence long descriptions of any established plot points in the story
    //that should be respected in future parts of the story. For example, this
    //might include things like "The knight's sister is the queen".
    plotPoints: string[];
}