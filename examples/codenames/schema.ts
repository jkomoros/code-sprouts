//A card with one word printed on it.
type CodenameCard = string;
//A single-word clue that a spymaster gives to their team to try to get them to guess cards. These must adhere to the rules of Codenames about clues, including that they may not be the text of any of the cards.
type CodenameClue = string;

type CodenameTurn = {
  //The clue the spymaster gave
  clue: CodenameClue,
  //The guesses the team gave, in order. If they touch one that isn't theirs, the rest of the turn is over.
  guess: CodenameCard[]
}

type CardType = 'red' //Red team. On key card, is a red square with a circle.
  | 'blue' //Blue team. On key card, is a blue square with a circle.
  | 'assassin' //Assassin. On key card, is a black square with an x.
  | 'bystander' //Bystander. On a key card, is an empty beige square.
  | 'guessed' //for cards that have already been guessed by a player so far this game, and removed from play.
  | 'unknown' //The initial state, for when the image of the cards has been scanned but not yet the key card.

type CodenamesGame = {
  //The team that our conversational partner is the spymaster for.
  team: 'blue' | 'red',
 //25 cards, in order form left to right, top to bottom. As the cards are guessed, they flip to 'guessed' state, removing them from play.
  cards: {
      [card : CodenameCard]: CardType
  },
  redTurns: CodenameTurn[],
  blueTurns: CodenameTurn[]
}