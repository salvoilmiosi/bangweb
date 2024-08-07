import { UpdateFunction } from "../../../Model/SceneState";
import { Empty } from "../../../Model/ServerMessage";
import { mapLast } from "../../../Utils/ArrayUtils";
import { createUnionReducer } from "../../../Utils/UnionUtils";
import { CardTarget } from "./CardTarget";
import { cardHasTag, isCardModifier, isEquipCard } from "./Filters";
import { Card, GameTable, KnownCard, Player, getCard, isCardKnown } from "./GameTable";
import { CardId, PlayerId } from "./GameUpdate";
import targetDispatch from "./TargetDispatch";
import { GamePrompt, TargetSelectorMode, RequestStatusUnion, TargetSelector, getModifierContext, getPlayableCards, getTargetSelectorStatus, isCardCurrent, isResponse, newTargetSelector } from "./TargetSelector";

export type SelectorUpdate =
    { setRequest: RequestStatusUnion } |
    { setPrompt: GamePrompt } |
    { confirmSelection: Empty } |
    { undoSelection: Empty } |
    { selectPlayingCard: KnownCard } |
    { addCardTarget: Card } |
    { addPlayerTarget: Player } |
    { addEquipTarget: Player }
;

type TargetListMapper = UpdateFunction<CardTarget[]>;

function editSelectorTargets(selector: TargetSelector, mapper: TargetListMapper): TargetSelector {
    switch (selector.mode) {
    case 'preselect':
        return {
            ...selector,
            preselection: {
                card: selector.preselection!.card,
                targets: mapper(selector.preselection!.targets)
            }
        };
    case 'target':
        return {
            ...selector,
            targets: mapper(selector.targets)
        };
    case 'modifier': 
        return {
            ...selector,
            modifiers: mapLast(selector.modifiers, mod => ({
                ...mod,
                targets: mapper(mod.targets)
            }))
        };
    default:
        throw new Error('TargetSelector: not in targeting mode');
    }
}

function appendCardTarget(selector: TargetSelector, card: CardId): TargetListMapper {
    const { effects, targets, index } = getTargetSelectorStatus(selector);
    return _ => targets.slice(0, index).concat(targetDispatch.appendCardTarget(targets.at(index), effects[index], card));
}

function appendPlayerTarget(selector: TargetSelector, player: PlayerId): TargetListMapper {
    const { effects, targets, index } = getTargetSelectorStatus(selector);
    return _ => targets.slice(0, index).concat(targetDispatch.appendPlayerTarget(targets.at(index), effects[index], player));
}

function setSelectorMode(selector: TargetSelector, mode: TargetSelectorMode): TargetSelector {
    return { ...selector, mode };
}

function handleSetRequest(table: GameTable, request: RequestStatusUnion): TargetSelector {
    const selector = newTargetSelector(request);
    if (isResponse(selector)) {
        let preselectCard: KnownCard | undefined;
        for (const pair of selector.request.respond_cards) {
            const card = getCard(table, pair.modifiers.at(0) ?? pair.card);
            if (cardHasTag(card, 'preselect')) {
                if (!preselectCard) {
                    preselectCard = card;
                } else if (preselectCard.id !== card.id) {
                    throw new Error('Multiple preselect cards in response');
                }
            }
        }
        if (preselectCard) {
            return handleAutoTargets({
                ...table,
                selector: {
                    ...selector,
                    mode: 'preselect',
                    preselection: {
                        card: preselectCard,
                        targets: []
                    }
                }
            });
        }
    }
    return selector;
}

function handleAutoSelect(table: GameTable): TargetSelector {
    const selector = setSelectorMode(table.selector, 'middle');
    const cardId = getModifierContext(selector, 'playing_card') ?? getModifierContext(selector, 'repeat_card');
    if (cardId) {
        const card = getCard(table, cardId);
        if (!isCardCurrent(selector, card) && isCardKnown(card) && getPlayableCards(selector).includes(card.id)) {
            return handleSelectPlayingCard(table, card);
        }
    }
    return selector;
}

function handleEndPreselection(table: GameTable, remove: boolean = true): TargetSelector {
    const selector = table.selector;
    if (selector.mode === 'preselect' && selector.preselection !== null) {
        if (isCardModifier(selector.preselection.card, isResponse(selector))) {
            return {
                ...selector,
                modifiers: [{
                    card: selector.preselection.card,
                    targets: selector.preselection.targets
                }],
                preselection: remove ? null : selector.preselection,
                mode: 'middle'
            };
        } else {
            return handleAutoTargets({ ...table,
                selector: {
                    ...selector,
                    playing_card: selector.preselection.card,
                    targets: selector.preselection.targets,
                    preselection: null,
                    modifiers: [],
                    mode: 'target'
                }
            })
        }
    }
    return handleAutoTargets(table);
}

function handleAutoTargets(table: GameTable): TargetSelector {
    const selector = table.selector;
    const { effects, targets, index } = getTargetSelectorStatus(selector);

    if (index >= effects.length) {
        switch (selector.mode) {
        case 'preselect':
            return handleEndPreselection(table, false);
        case 'target':
            return setSelectorMode(selector, 'finish');
        case 'modifier':
            return handleAutoSelect(table);
        }
    }

    if (index >= targets.length) {
        const value = targetDispatch.buildAutoTarget(table, effects[index]);
        if (value) {
            return handleAutoTargets({ ...table, selector: editSelectorTargets(selector, _ => targets.concat(value)) });
        }
    }
    return selector;
}

function handleSelectPlayingCard(table: GameTable, card: KnownCard): TargetSelector {
    const selector = table.selector;

    if (isEquipCard(card)) {
        return {
            ...selector,
            prompt: { type: 'none' },
            preselection: null,
            playing_card: card,
            mode: card.cardData.equip_target.length === 0 ? 'finish' : 'equip'
        };
    } else if (isCardModifier(card, isResponse(selector))) {
        return handleAutoTargets({ ...table, selector: {
            ...selector,
            prompt: { type: 'none' },
            preselection: null,
            modifiers: selector.modifiers.concat({ card, targets: [] }),
            mode: 'modifier'
        }});
    } else {
        return handleAutoTargets({ ...table, selector: {
            ...selector,
            prompt: { type: 'none' },
            preselection: null,
            playing_card: card,
            mode: 'target'
        }});
    }
}

const targetSelectorReducer = createUnionReducer<GameTable, SelectorUpdate, TargetSelector>({
    setRequest (request) {
        return handleSetRequest(this, request);
    },

    setPrompt (prompt) {
        return { ...this.selector, prompt };
    },

    confirmSelection () {
        return handleAutoTargets({
            ...this,
            selector: editSelectorTargets(this.selector, targets => mapLast(targets, targetDispatch.confirmSelection))
        });
    },

    undoSelection () {
        return handleSetRequest(this, this.selector.request);
    },

    selectPlayingCard ( card ) {
        return handleSelectPlayingCard(this, card);
    },

    addCardTarget (card) {
        return handleEndPreselection({ ...this, selector: editSelectorTargets(this.selector, appendCardTarget(this.selector, card.id))});
    },

    addPlayerTarget (player) {
        return handleEndPreselection({...this, selector: editSelectorTargets(this.selector, appendPlayerTarget(this.selector, player.id))});
    },

    addEquipTarget (player) {
        if (this.selector.mode !== 'equip') {
            throw new Error('TargetSelector: not in equipping mode');
        }
        return {
            ...this.selector,
            targets: [{ player: player.id }],
            mode: 'finish'
        };
    }
    
});

export default targetSelectorReducer;