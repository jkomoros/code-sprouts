export type State = {
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
        //Whether the character has been introduced in the story yet
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