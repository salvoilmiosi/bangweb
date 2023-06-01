import { REGISTRIES } from "./Registry";
import { CardSign } from "../Messages/CardData";
import { GameString } from "../Messages/GameUpdate";
import { UserValue, getUsername } from "../Scenes/Lobby/LobbyUser";
import { GameTable, getPlayer } from "../Scenes/Game/GameTable";
import CardSignView from "../Scenes/Game/Components/CardSignView";

const [cardRegistry, labelRegistry, gameStringRegistry] = (() => {
    const language = navigator.language;
    if (language in REGISTRIES) {
        return REGISTRIES[language];
    } else {
        return REGISTRIES['en'];
    }
})();

export function getLocalizedLabel(group: string, name: string, ...formatArgs: string[]): string {
    if (group in labelRegistry) {
        const labelGroup = labelRegistry[group];
        if (name in labelGroup) {
            const value = labelGroup[name];
            if (typeof value == 'function') {
                return value(...formatArgs);
            } else {
                return value;
            }
        }
    }
    return group + '.' + name;
}

export interface CardNameProps {
    name: string;
    sign?: CardSign;
}

export function LocalizedCardName({ name, sign }: CardNameProps): JSX.Element {
    const localizedName = name in cardRegistry ? cardRegistry[name] : name;
    if (sign && sign.rank != 'none' && sign.suit != 'none') {
        return (<>{localizedName} (<CardSignView sign={sign} />)</>);
    } else {
        return (<>{localizedName}</>);
    }
}

export interface GameStringProps {
    table: GameTable;
    users: UserValue[];
    message: GameString;
}

export function GameStringComponent({ table, users, message}: GameStringProps): JSX.Element {
    if (message.format_str in gameStringRegistry) {
        const value = gameStringRegistry[message.format_str];
        if (typeof value == 'function') {
            return value(...message.format_args.map(arg => {
                if ('integer' in arg) {
                    return <>{arg.integer}</>;
                } else if ('card' in arg) {
                    if ('name' in arg.card) {
                        return <LocalizedCardName name={arg.card.name} sign={arg.card.sign} />;
                    } else {
                        return <>{getLocalizedLabel('ui', 'UNKNOWN_CARD')}</>;
                    }
                } else if ('player' in arg) {
                    if (arg.player) {
                        const userid = getPlayer(table, arg.player).userid;
                        const user = users.find(user => user.id === userid);
                        return <>{getUsername(user)}</>;
                    } else {
                        return <>{getLocalizedLabel('ui', 'UNKNOWN_PLAYER')}</>
                    }
                }
                throw new Error('Invalid argument in format_args');
            }));
        } else {
            return value;
        }
    } else {
        return <>{message.format_str}</>;
    }
}