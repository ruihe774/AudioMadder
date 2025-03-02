import type { Component } from "solid-js";
import { batch, createEffect } from "solid-js";
import { clamp, createTrigger, extract } from "./utils";

const { pow } = Math;

function isModifierPreventing(e: MouseEvent | KeyboardEvent): boolean {
    return e.getModifierState("Accel");
}

const ChannelSpectrum: Component<{
    onCanvasChanged?: (canvas: HTMLCanvasElement) => void;
    pixelWidth: number;
    pixelHeight: number;
    targetWidth: number;
    targetHeight: number;
    horizontalScale?: number;
    onHorizontalScaleChanged?: (newScale: number) => void;
    hide?: boolean;
    onToggleZoom?: () => void;
    horizontalScroll?: number;
    onHorizontalScrollChanged?: (newScroll: number) => void;
}> = (props) => {
    let canvas!: HTMLCanvasElement;
    let canvasContainer!: HTMLDivElement;

    const scaledWidth = (): number => props.targetWidth * (props.horizontalScale ?? 1);

    const stableScale = (e: MouseEvent & { currentTarget: HTMLElement }, newScale: number): void => {
        const {
            horizontalScale: oldScale,
            onHorizontalScaleChanged: setHorizontalScale,
            targetWidth,
            onHorizontalScrollChanged: setHorizontalScroll,
        } = props;
        const oldScroll = props.horizontalScroll ?? 0;
        if (!oldScale || !setHorizontalScale) return;
        e.preventDefault();
        const newScroll = clamp(
            oldScroll + (e.x - e.currentTarget.getBoundingClientRect().left + oldScroll) * (newScale / oldScale - 1),
            0,
            targetWidth * (newScale - 1),
        );
        batch(() => {
            setHorizontalScale(newScale);
            setHorizontalScroll?.(newScroll);
        });
    };

    const scalePixelToPixel = (
        e: MouseEvent & { currentTarget: HTMLElement },
        pixelWidth: number,
        targetWidth: number,
    ): void => {
        const { horizontalScale: oldScale } = props;
        const pixelToPixelScale = pixelWidth / targetWidth / devicePixelRatio;
        const newScale = oldScale == pixelToPixelScale ? 1 : pixelToPixelScale;
        stableScale(e, newScale);
    };

    createEffect(() => {
        const { pixelWidth, pixelHeight, onCanvasChanged: setCanvas } = props;
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
        setCanvas?.(canvas);
    });

    createTrigger([extract(props, "horizontalScroll")], (scroll) => {
        canvasContainer.scrollLeft = scroll;
    });

    return (
        <div
            ref={canvasContainer}
            on:dblclick={(e) => {
                const { onToggleZoom: toggleZoom } = props;
                if (toggleZoom) {
                    e.preventDefault();
                    toggleZoom();
                }
            }}
            on:wheel={{
                passive: false,
                handleEvent(e) {
                    const { horizontalScale, pixelWidth, targetWidth } = props;
                    if (
                        horizontalScale &&
                        e.deltaX == 0 &&
                        e.deltaMode == WheelEvent.DOM_DELTA_PIXEL &&
                        !isModifierPreventing(e)
                    ) {
                        stableScale(
                            e,
                            clamp(
                                horizontalScale * pow(1.2, -e.deltaY / 100),
                                1,
                                ((pixelWidth / targetWidth) * 2) / devicePixelRatio,
                            ),
                        );
                    }
                },
            }}
            on:scroll={{
                passive: true,
                handleEvent(e) {
                    const { onHorizontalScrollChanged: setHorizontalScroll } = props;
                    setHorizontalScroll?.(e.target.scrollLeft);
                },
            }}
            on:mousemove={(e) => {
                const {
                    targetWidth,
                    horizontalScale,
                    horizontalScroll,
                    onHorizontalScrollChanged: setHorizontalScroll,
                } = props;
                if (
                    horizontalScale &&
                    horizontalScroll &&
                    setHorizontalScroll &&
                    e.buttons == 1 &&
                    !isModifierPreventing(e)
                ) {
                    setHorizontalScroll(clamp(horizontalScroll - e.movementX, 0, targetWidth * (horizontalScale - 1)));
                }
            }}
            on:mousedown={(e) => {
                const { pixelWidth, targetWidth } = props;
                if (e.button == 1 && !isModifierPreventing(e)) {
                    scalePixelToPixel(e, pixelWidth, targetWidth);
                }
            }}
            style={props.hide ? { display: "none" } : {}}
            // @ts-expect-error webkit proprietary
            on:webkitmouseforcewillbegin={(e: MouseEvent) => e.preventDefault()}
            on:webkitmouseforcedown={(e: MouseEvent & { currentTarget: HTMLElement }) => {
                const { pixelWidth, targetWidth } = props;
                scalePixelToPixel(e, pixelWidth, targetWidth);
            }}
        >
            <div style={{ width: `${scaledWidth()}px`, height: `${props.targetHeight}px`, overflow: "hidden" }}>
                <canvas
                    ref={canvas}
                    style={{
                        "transform": `scale(${scaledWidth() / props.pixelWidth},${props.targetHeight / props.pixelHeight})`,
                        "transform-origin": "0 0",
                    }}
                />
            </div>
        </div>
    );
};

export default ChannelSpectrum;
