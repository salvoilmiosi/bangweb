import { useContext } from "react";
import { GameTableContext } from "../GameScene";
import { getCard, newPocketId } from "../Model/GameTable";
import DeckShuffleAnimation from "./DeckShuffleAnimation";
import MoveCardAnimation from "./MoveCardAnimation";
import MoveCubeAnimation from "./MoveCubeAnimations";
import { CardTracker } from "../Model/CardTracker";
import MovePlayersAnimation from "./MovePlayersAnimation";

export interface AnimationProps {
    tracker: CardTracker;
}

export default function AnimationView({ tracker }: AnimationProps) {
    const table = useContext(GameTableContext);
    if (table.animation) {
        switch (true) {
        case 'move_card' in table.animation: {
            const animation = table.animation.move_card;
            return <MoveCardAnimation
                key={table.animationKey}
                tracker={tracker}
                card={getCard(table, animation.card)}
                destPocket={newPocketId(animation.pocket, animation.player)}
                duration={animation.duration}
            />;
        }
        case 'move_cubes' in table.animation: {
            const animation = table.animation.move_cubes;
            return <MoveCubeAnimation
                key={table.animationKey}
                tracker={tracker}
                num_cubes={animation.num_cubes}
                origin_card={animation.origin_card ? getCard(table, animation.origin_card) : null}
                target_card={animation.target_card ? getCard(table, animation.target_card) : null}
                duration={animation.duration}
            />;
        }
        case 'deck_shuffle' in table.animation: {
            const animation = table.animation.deck_shuffle;
            return <DeckShuffleAnimation
                key={table.animationKey}
                tracker={tracker}
                cards={animation.cards}
                pocket={animation.pocket}
                duration={animation.duration}
            />;
        }
        case 'move_players' in table.animation: {
            const animation = table.animation.move_players;
            return <MovePlayersAnimation
                key={table.animationKey}
                tracker={tracker}
                players={animation.players}
                duration={animation.duration}
            />;
        }}
    }
    return null;
}