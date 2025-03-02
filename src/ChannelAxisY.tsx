import { Component, createMemo, Index } from "solid-js";

const { floor, ceil } = Math;

function nextPowerOfTwo(x: number): number {
    x = x | 0;
    if (x <= 1) return 1;
    --x;
    x |= x >> 1;
    x |= x >> 2;
    x |= x >> 4;
    x |= x >> 8;
    x |= x >> 16;
    ++x;
    return x;
}

const ChannelAxisY: Component<{
    width: number;
    height: number;
    minFreq: number;
    maxFreq: number;
}> = (props) => {
    const scales = createMemo(() => {
        const { minFreq, maxFreq, height } = props;
        const scales = [];
        const min = ceil(minFreq / 1000);
        const max = floor(maxFreq / 1000);
        const step = nextPowerOfTwo(((max - min) * 30) / height);
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
                        ((props.maxFreq - scale() * 1000) * props.height) / (props.maxFreq - props.minFreq);
                    return (
                        <>
                            <line x1={props.width - 5} x2={props.width} y1={y()} y2={y()} stroke="white" />
                            <text
                                x={props.width - 10}
                                y={y()}
                                fill="white"
                                text-anchor="end"
                                font-family="monospace"
                                font-size="0.6em"
                                dominant-baseline="middle"
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
