import type { Component } from "solid-js";
import { batch, createEffect, createSignal } from "solid-js";
import { clamp, createTrigger, extract } from "./utils";
import ChannelAxisY from "./ChannelAxisY.tsx";
import ChannelAxisX from "./ChannelAxisX.tsx";
import styles from "./styles.module.css";

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
    minFreq: number;
    maxFreq: number;
    duration: number;
    horizontalScale?: number;
    onHorizontalScaleChanged?: (newScale: number) => void;
    hide?: boolean;
    onToggleZoom?: () => void;
    horizontalScroll?: number;
    onHorizontalScrollChanged?: (newScroll: number) => void;
}> = (props) => {
    let canvas!: HTMLCanvasElement;
    let canvasContainer!: HTMLDivElement;

    const [scrolling, setScrolling] = createSignal(false);

    const axisYWidth = 60;
    const axisXHeight = 20;
    const topPadding = 10;
    const canvasTargetWidth = (): number => props.targetWidth - axisYWidth;
    const scaledCanvasWidth = (): number => canvasTargetWidth() * (props.horizontalScale ?? 1);
    const canvasTargetHeight = (): number => props.targetHeight - axisXHeight - topPadding;

    const stableScale = (e: MouseEvent & { currentTarget: HTMLElement }, newScale: number): void => {
        const {
            horizontalScale: oldScale,
            onHorizontalScaleChanged: setHorizontalScale,
            onHorizontalScrollChanged: setHorizontalScroll,
        } = props;
        const canvasWidth = canvasTargetWidth();
        const oldScroll = props.horizontalScroll ?? 0;
        if (!oldScale || !setHorizontalScale) return;
        e.preventDefault();
        const newScroll = clamp(
            oldScroll + (e.x - e.currentTarget.getBoundingClientRect().left + oldScroll) * (newScale / oldScale - 1),
            0,
            canvasWidth * (newScale - 1),
        );
        batch(() => {
            setHorizontalScale(newScale);
            setHorizontalScroll?.(newScroll);
        });
    };

    const scalePixelToPixel = (
        e: MouseEvent & { currentTarget: HTMLElement },
        pixelWidth: number,
        canvasWidth: number,
    ): void => {
        const { horizontalScale: oldScale } = props;
        const pixelToPixelScale = pixelWidth / canvasWidth / devicePixelRatio;
        const newScale = oldScale == pixelToPixelScale ? 1 : pixelToPixelScale;
        stableScale(e, newScale);
    };

    createEffect(() => {
        const { pixelWidth, pixelHeight, onCanvasChanged: setCanvas } = props;
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
        setCanvas?.(canvas);
    });

    let scrolledByUs = false;
    createTrigger([extract(props, "horizontalScroll")], (scroll) => {
        if (!scrolling()) {
            scrolledByUs = true;
            canvasContainer.scrollLeft = scroll;
        }
    });

    // workaround for Safari which does not support scrollend
    let scrollStopAction: number | undefined;

    return (
        <div class={styles["channel-plot"]}>
            <ChannelAxisY
                width={axisYWidth}
                height={props.targetHeight}
                padding={[0, topPadding, 0, axisXHeight]}
                minFreq={props.minFreq}
                maxFreq={props.maxFreq}
            />
            <div
                ref={canvasContainer}
                class={styles["channel-canvas-container"]}
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
                        const { horizontalScale, pixelWidth } = props;
                        const canvasWidth = canvasTargetWidth();
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
                                    ((pixelWidth / canvasWidth) * 2) / devicePixelRatio,
                                ),
                            );
                        }
                    },
                }}
                on:scroll={{
                    passive: true,
                    handleEvent(e) {
                        if (scrolledByUs) {
                            scrolledByUs = false;
                        } else {
                            const { onHorizontalScrollChanged: setHorizontalScroll } = props;
                            setScrolling(true);
                            setHorizontalScroll?.(e.target.scrollLeft);
                            if (scrollStopAction) {
                                clearTimeout(scrollStopAction);
                            }
                            scrollStopAction = setTimeout(() => {
                                setScrolling(false);
                                scrollStopAction = void 0;
                            }, 100);
                        }
                    },
                }}
                on:scrollend={() => void setScrolling(false)}
                on:mousemove={(e) => {
                    const { horizontalScale, horizontalScroll, onHorizontalScrollChanged: setHorizontalScroll } = props;
                    const canvasWidth = canvasTargetWidth();
                    if (
                        horizontalScale &&
                        horizontalScroll != null &&
                        setHorizontalScroll &&
                        e.buttons == 1 &&
                        !isModifierPreventing(e)
                    ) {
                        setHorizontalScroll(
                            clamp(
                                horizontalScroll - e.movementX / devicePixelRatio,
                                0,
                                canvasWidth * (horizontalScale - 1),
                            ),
                        );
                    }
                }}
                on:mousedown={(e) => {
                    const { pixelWidth } = props;
                    const canvasWidth = canvasTargetWidth();
                    if (e.button == 1 && !isModifierPreventing(e)) {
                        scalePixelToPixel(e, pixelWidth, canvasWidth);
                    }
                }}
                style={props.hide ? { display: "none" } : {}}
                // @ts-expect-error webkit proprietary
                on:webkitmouseforcewillbegin={(e: MouseEvent) => e.preventDefault()}
                on:webkitmouseforcedown={(e: MouseEvent & { currentTarget: HTMLElement }) => {
                    const { pixelWidth } = props;
                    const canvasWidth = canvasTargetWidth();
                    scalePixelToPixel(e, pixelWidth, canvasWidth);
                }}
            >
                <div
                    style={{
                        width: `${scaledCanvasWidth()}px`,
                        height: `${canvasTargetHeight() + axisXHeight}px`,
                        overflow: "hidden",
                        position: "relative",
                    }}
                >
                    <canvas
                        ref={canvas}
                        style={{
                            "transform": `scale(${scaledCanvasWidth() / props.pixelWidth},${canvasTargetHeight() / props.pixelHeight})`,
                            "transform-origin": "0 0",
                        }}
                    />
                    <div
                        style={{
                            position: "absolute",
                            top: `${canvasTargetHeight()}px`,
                        }}
                    >
                        <ChannelAxisX width={scaledCanvasWidth()} height={axisXHeight} duration={props.duration} />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ChannelSpectrum;
