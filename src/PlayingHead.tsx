import type { Component } from "solid-js";

const PlayingHead: Component<{
    width: number;
    height: number;
    color: string;
}> = (props) => {
    return (
        <svg width={props.width} height={props.height}>
            <polygon
                points={`0 0 ${props.width} 0 ${props.width} ${props.width / 3} ${props.width / 2} ${props.width} 0 ${props.width / 3}`}
                fill={props.color}
            />
            <rect x={props.width / 2 - 1} width={2} height={props.height} fill={props.color} />
        </svg>
    );
};

export default PlayingHead;
