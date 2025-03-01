import { Component, createEffect } from "solid-js";

const ChannelSpectrum: Component<{
    canvasRef: (canvas: HTMLCanvasElement) => void;
    pixelWidth: number;
    pixelHeight: number;
    targetWidth: number;
    targetHeight: number;
}> = (props) => {
    let canvas!: HTMLCanvasElement;

    createEffect(() => {
        const { pixelWidth, pixelHeight, canvasRef } = props;
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
        canvasRef(canvas);
    });

    return (
        <div style={{ width: `${props.targetWidth}px`, height: `${props.targetHeight}px`, overflow: "hidden" }}>
            <canvas
                ref={canvas}
                style={{
                    "transform": `scale(${props.targetWidth / props.pixelHeight},${props.targetHeight / props.pixelWidth}) rotate(-90deg) translateX(-${props.pixelWidth}px)`,
                    "transform-origin": "0 0",
                }}
            />
        </div>
    );
};

export default ChannelSpectrum;
