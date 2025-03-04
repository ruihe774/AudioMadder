import type { Component } from "solid-js";
import { createMemo, Index } from "solid-js";
import { extractProps, nextPowerOfTwo } from "./utils.ts";

const { floor, ceil, pow } = Math;

const ChannelAxisY: Component<{
    width: number;
    height: number;
    minFreq: number;
    maxFreq: number;
    logBase: number;
    padding?: [left: number, top: number, right: number, bottom: number];
}> = (props) => {
    const { width, height, minFreq, maxFreq, logBase, padding } = extractProps(props, {
        padding: [0, 0, 0, 0],
    });

    const rightEdge = (): number => width() - (padding()[2] ?? 0);
    const innerHeight = (): number => height() - (padding()[1] ?? 0) - (padding()[3] ?? 0);

    const scales = createMemo(() => {
        const scales = [];
        const min = ceil(minFreq() / 1000);
        const max = floor(maxFreq() / 1000);
        const step = nextPowerOfTwo(((max - min) * 30) / innerHeight());
        for (let i = min; i <= max; i += step) {
            scales.push(i);
        }
        return scales;
    });

    return (
        <svg width={width()} height={height()}>
            <Index each={scales()}>
                {(scale) => {
                    const y = (): number => {
                        const exp = (maxFreq() - scale() * 1000) / (maxFreq() - minFreq());
                        return (
                            (logBase() == 1 ? exp : (pow(logBase(), exp) - 1) / (logBase() - 1)) * innerHeight() +
                            (padding()[1] ?? 0)
                        );
                    };
                    return (
                        <>
                            <line x1={rightEdge() - 5} x2={rightEdge()} y1={y()} y2={y()} stroke="currentColor" />
                            <text
                                x={rightEdge() - 10}
                                y={y()}
                                fill="currentColor"
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
