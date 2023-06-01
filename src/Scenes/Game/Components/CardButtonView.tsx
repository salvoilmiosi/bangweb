import { LocalizedCardName } from "../../../Locale/Locale";
import { Card } from "../GameTable";

export interface CardButtonProps {
    card: Card;
}

export default function CardButtonView({ card }: CardButtonProps) {
    if ('name' in card.cardData) {
        return <button><LocalizedCardName name={card.cardData.name} /></button>
    } else {
        return null;
    }
}