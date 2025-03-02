import type { Component } from "solid-js";
import { batch, createEffect, createSignal } from "solid-js";
import { clamp, createTrigger, extract } from "./utils";
import styles from "./styles.module.css";
import ChannelAxisY from "./ChannelAxisY.tsx";

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

    const axisYwidth = 60;
    const canvasTargetWidth = (): number => props.targetWidth - axisYwidth;
    const scaledCanvasWidth = (): number => canvasTargetWidth() * (props.horizontalScale ?? 1);

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
                width={axisYwidth}
                height={props.targetHeight}
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
                    style={{ width: `${scaledCanvasWidth()}px`, height: `${props.targetHeight}px`, overflow: "hidden" }}
                >
                    <canvas
                        ref={canvas}
                        style={{
                            "transform": `scale(${scaledCanvasWidth() / props.pixelWidth},${props.targetHeight / props.pixelHeight})`,
                            "transform-origin": "0 0",
                        }}
                    />
                </div>
            </div>
        </div>
    );
};

export default ChannelSpectrum;
