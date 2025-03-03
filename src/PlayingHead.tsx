import type { Component } from "solid-js";
import { extractProps } from "./utils.ts";

const PlayingHead: Component<{
    width: number;
    height: number;
    color: string;
}> = (props) => {
    const { width, height, color } = extractProps(props);

    return (
        <svg width={width()} height={height()}>
            <polygon
                points={`0 0 ${width()} 0 ${width()} ${width() / 3} ${width() / 2} ${width()} 0 ${width() / 3}`}
                fill={color()}
            />
            <rect x={width() / 2 - 1} width={2} height={height()} fill={color()} />
        </svg>
    );
};

export default PlayingHead;
