import type { Component } from "solid-js";
import { createMemo, Index } from "solid-js";
import { extractProps, nextPowerOfTwo } from "./utils.ts";

const { floor } = Math;

const ChannelAxisX: Component<{
    width: number;
    height: number;
    duration: number;
}> = (props) => {
    const { width, height, duration } = extractProps(props);

    const scales = createMemo(() => {
        const max = duration();
        const scales = [];
        let step = nextPowerOfTwo((max * 5) / width()) * 15;
        if (step == 15) {
            if ((width() / max) * 10 > 45) {
                step = 10;
            }
            if ((width() / max) * 5 > 45) {
                step = 5;
            }
        }
        for (let i = step; i < max; i += step) {
            scales.push(i);
        }
        return scales;
    });

    return (
        <svg width={width()} height={height()}>
            <Index each={scales()}>
                {(scale) => {
                    const x = (): number => (scale() * width()) / duration();
                    return (
                        <>
                            <line x1={x()} x2={x()} y1="0" y2="5" stroke="currentColor" />
                            {/*
                            // @ts-expect-error text-before-edge not typed */}
                            <text
                                x={x()}
                                y="5"
                                fill="currentColor"
                                text-anchor="middle"
                                font-family="monospace"
                                font-size="0.6em"
                                dominant-baseline="text-before-edge"
                            >
                                {floor(scale() / 60)
                                    .toString()
                                    .padStart(2, "0")}
                                :{(scale() % 60).toString().padStart(2, "0")}
                            </text>
                        </>
                    );
                }}
            </Index>
        </svg>
    );
};

export default ChannelAxisX;
