import type { Component } from "solid-js";
import { createMemo, Index } from "solid-js";
import { nextPowerOfTwo } from "./utils.ts";

const { floor, ceil } = Math;

const ChannelAxisY: Component<{
    width: number;
    height: number;
    minFreq: number;
    maxFreq: number;
    padding?: [left: number, top: number, right: number, bottom: number];
}> = (props) => {
    const rightEdge = (): number => props.width - (props.padding?.[2] ?? 0);
    const innerHeight = (): number => props.height - (props.padding?.[1] ?? 0) - (props.padding?.[3] ?? 0);

    const scales = createMemo(() => {
        const { minFreq, maxFreq } = props;
        const scales = [];
        const min = ceil(minFreq / 1000);
        const max = floor(maxFreq / 1000);
        const step = nextPowerOfTwo(((max - min) * 30) / innerHeight());
        for (let i = min; i <= max; i += step) {
            scales.push(i);
        }
        return scales;
    });

    return (
        <svg width={props.width} height={props.height}>
            <Index each={scales()}>
                {(scale) => {
                    const y = (): number =>
                        ((props.maxFreq - scale() * 1000) * innerHeight()) / (props.maxFreq - props.minFreq) +
                        (props.padding?.[1] ?? 0);
                    return (
                        <>
                            <line x1={rightEdge() - 5} x2={rightEdge()} y1={y()} y2={y()} stroke="white" />
                            <text
                                x={rightEdge() - 10}
                                y={y()}
                                fill="white"
                                text-anchor="end"
                                font-family="monospace"
                                dominant-baseline="middle"
                                font-size="0.6em"
                            >
                                {scale()} kHz
                            </text>
                        </>
                    );
                }}
            </Index>
        </svg>
    );
};

export default ChannelAxisY;
