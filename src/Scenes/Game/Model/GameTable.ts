import { UpdateFunction } from "../../../Model/SceneState";
import { Empty, UserId } from "../../../Model/ServerMessage";
import { CardData, CardSign } from "./CardData";
import { DeckType, GameFlag, PlayerFlag, PlayerPocketType, PlayerRole, PocketType, TablePocketType } from "./CardEnums";
import { CardId, DeckShuffledUpdate, Duration, MoveCardUpdate, MoveCubesUpdate, MoveTrainUpdate, PlayerId } from "./GameUpdate";
import { TargetSelector, newTargetSelector } from "./TargetSelector";

export interface Id {
    id: number
};

/// players and cards are sorted by id so that finding an object in those arrays is O(log n)
export function searchIndexById<T extends Id>(values: T[], target: number): number {
    let left: number = 0;
    let right: number = values.length - 1;
  
    while (left <= right) {
      const mid: number = Math.floor((left + right) / 2);
  
      if (values[mid].id === target) return mid;
      if (target < values[mid].id) right = mid - 1;
      else left = mid + 1;
    }
  
    return left;
}

export function searchById<T extends Id>(values: T[], target: number): T | null {
    const value = values.at(searchIndexById(values, target));
    return value?.id === target ? value : null;
}

export function insertSorted<T extends Id>(values: T[], elem: T) {
    values.splice(searchIndexById(values, elem.id), 0, elem);
}

/// Takes as arguments an array of values, an id and a mapping function
/// This function finds the element with the specified id and returns a new array of values
/// with the found object modified according to the mapper function
export function editById<T extends Id>(values: T[], id: number | number[], mapper: UpdateFunction<T>): T[] {
    return values.map(value => {
        if (typeof(id) === 'number' ? value.id === id : id.includes(value.id)) {
            return mapper(value);
        } else {
            return value;
        }
    });
}

export type PocketId = { name: TablePocketType } | { name: PlayerPocketType, player: PlayerId } | null;

export interface CardImage {
    image: string;
    sign?: CardSign;
}

export type CardAnimation =
    { flipping: { cardImage?: CardImage, backface?: string } & Duration } |
    { turning: Duration } |
    { flash: Duration } |
    { short_pause: Empty };

type CardDeckOrData = { deck: DeckType } | CardData;

interface CardBase<T extends CardDeckOrData> extends Id {
    cardData: T;
    pocket: PocketId;

    inactive: boolean;
    num_cubes: number;
    
    animation?: CardAnimation;
    animationKey: number;
}

export type Card = CardBase<CardDeckOrData>;
export type KnownCard = CardBase<CardData>;

function parseCardImage(image: string, deck: string): string {
    return image.includes('/') ? image : `${deck}/${image}`;
}

export function getCardImage(card: Card): CardImage | undefined {
    if (isCardKnown(card)) {
        const cardData = card.cardData;
        const colonIndex = cardData.image.indexOf(':');
        const imageFront = colonIndex >= 0 ? cardData.image.substring(0, colonIndex) : cardData.image;
        return {
            image: parseCardImage(imageFront, cardData.deck),
            sign: cardData.sign.rank !== 'none' && cardData.sign.suit !== 'none' ? cardData.sign : undefined
        };
    }
    return undefined;
};

export function getCardBackface(card: Card): string {
    if (isCardKnown(card)) {
        const cardData = card.cardData;
        const colonIndex = cardData.image.indexOf(':');
        if (colonIndex >= 0) {
            return parseCardImage(cardData.image.substring(colonIndex + 1), cardData.deck);
        }
    }
    return 'backface/' + card.cardData.deck;
}

export function newPocketId(pocketName: PocketType, player: PlayerId | null = null): PocketId {
    if (pocketName === 'none') {
        return null;
    } else if (player && pocketName.startsWith('player_')) {
        return { name: pocketName as PlayerPocketType, player };
    } else {
        return { name: pocketName as TablePocketType };
    }
}

export function newCard(id: CardId, deck: DeckType, pocket: PocketId): Card {
    return {
        id,
        cardData: { deck },
        pocket,
        inactive: false,
        num_cubes: 0,
        animationKey: 0
    };
}

export function isCardKnown(card: Card): card is KnownCard {
    return 'name' in card.cardData;
}

export type PlayerPockets = Record<PlayerPocketType, CardId[]>;

export type TablePockets = Record<TablePocketType, CardId[]>;

export type PlayerAnimation =
    { flipping_role: { role: PlayerRole } & Duration } |
    { player_hp: { hp: number} & Duration } |
    { player_death: Duration };

export interface Player extends Id {
    user_id: UserId;
    status: {
        role: PlayerRole,
        hp: number,
        gold: number,
        flags: PlayerFlag[]
    };
    pockets: PlayerPockets;

    animation?: PlayerAnimation;
    animationKey: number;
}

export function newPlayer(id: PlayerId, user_id: UserId): Player {
    return {
        id, user_id,
        status: {
            role: 'unknown',
            hp: 0,
            gold: 0,
            flags: []
        },
        pockets: {
            player_hand: [],
            player_table: [],
            player_character: [],
            player_backup: []
        },
        animationKey: 0
    };
}

export interface DeckCards {
    cards: CardId[];
}

export interface PlayerMoveId {
    from: PlayerId,
    to: PlayerId
};

export interface MovePlayersUpdate {
    players: PlayerMoveId[];
}

export type TableAnimation =
    { move_card: MoveCardUpdate & Duration } |
    { move_cubes: MoveCubesUpdate & Duration } |
    { deck_shuffle: DeckShuffledUpdate & DeckCards & Duration } |
    { move_train: MoveTrainUpdate & Duration } |
    { move_players: MovePlayersUpdate & Duration };

export interface GameTable {
    myUserId: UserId;
    self_player?: PlayerId;

    players: Player[];
    cards: Card[];
    
    pockets: TablePockets;

    alive_players: PlayerId[];
    dead_players: PlayerId[];

    status: {
        num_cubes: number;
        train_position: number;
        flags: GameFlag[];
        current_turn?: PlayerId;
    };
    
    animation?: TableAnimation;
    animationKey: number;

    selector: TargetSelector;
}

export function newGameTable(myUserId: UserId): GameTable {
    return {
        myUserId,
        
        players: [],
        cards: [],

        pockets: {
            main_deck: [],
            discard_pile: [],
            selection: [],
            shop_deck: [],
            shop_selection: [],
            shop_discard: [],
            hidden_deck: [],
            scenario_deck: [],
            scenario_card: [],
            wws_scenario_deck: [],
            wws_scenario_card: [],
            button_row: [],
            stations: [],
            train: [],
            train_deck: []
        },

        alive_players: [],
        dead_players: [],

        status: {
            num_cubes: 0,
            train_position: 0,
            flags: [],
        },

        animationKey: 0,
        selector: newTargetSelector()
    };
}

export function findCard(cards: Card[], id: CardId): Card {
    const card = searchById(cards, id);
    if (!card) {
        throw new Error(`Card not found: ${id}`);
    }
    return card;
}

export function getCard(table: GameTable, id: CardId): Card {
    return findCard(table.cards, id);
}

export function findPlayer(players: Player[], id: PlayerId): Player {
    const player = searchById(players, id);
    if (!player) {
        throw new Error(`Player not found: ${id}`);
    }
    return player;
}

export function getPlayer(table: GameTable, id: PlayerId): Player {
    return findPlayer(table.players, id);
}