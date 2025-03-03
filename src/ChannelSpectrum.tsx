import type { Component } from "solid-js";
import { Show } from "solid-js";
import { batch, createEffect, createSignal } from "solid-js";
import { clamp, createTrigger } from "./utils";
import ChannelAxisY from "./ChannelAxisY.tsx";
import ChannelAxisX from "./ChannelAxisX.tsx";
import PlayingHead from "./PlayingHead.tsx";
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
    logBase: number;
    duration: number;
    horizontalScale?: number;
    onHorizontalScaleChanged?: (newScale: number) => void;
    hide?: boolean;
    onToggleZoomRequest?: () => void;
    horizontalScroll?: number;
    onHorizontalScrollChanged?: (newScroll: number) => void;
    currentPlayingTime?: number;
    onSeekRequest?: (time: number) => void;
    playingHeadColor?: string;
}> = (props) => {
    let canvas!: HTMLCanvasElement;
    let canvasContainer!: HTMLDivElement;
    let playingHeadContainer!: HTMLDivElement;

    const [scrolling, setScrolling] = createSignal(false);

    const axisYWidth = 60;
    const axisXHeight = 20;
    const topPadding = 10;
    const unscaledCanvasWidth = (): number => props.targetWidth - axisYWidth;
    const canvasTargetWidth = (): number => unscaledCanvasWidth() * (props.horizontalScale ?? 1);
    const canvasTargetHeight = (): number => props.targetHeight - axisXHeight - topPadding;

    const stableScale = (e: MouseEvent & { currentTarget: HTMLElement }, newScale: number): void => {
        const {
            horizontalScale: oldScale,
            onHorizontalScaleChanged: setHorizontalScale,
            onHorizontalScrollChanged: setHorizontalScroll,
        } = props;
        const canvasWidth = unscaledCanvasWidth();
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
    createTrigger([() => props.horizontalScroll], (scroll) => {
        if (!scrolling()) {
            scrolledByUs = true;
            canvasContainer.scrollLeft = scroll;
        }
    });

    // workaround for Safari which does not support scrollend
    let scrollStopAction: number | undefined;

    const playingHeadWidth = 10;
    let lastPlayingTimeUpdate = 0;
    let playingHeadTransitionTime = 0;
    let playingHeadTransitionAnimation: Animation | undefined;
    let playingHeadDragging = false;
    createTrigger([() => props.currentPlayingTime], (currentPlayingTime) => {
        const currentTime = performance.now();
        const newTransitionTime = currentTime - lastPlayingTimeUpdate;
        if (newTransitionTime < 300) {
            playingHeadTransitionTime = newTransitionTime;
        }
        lastPlayingTimeUpdate = currentTime;

        playingHeadTransitionAnimation?.cancel();
        const generateTransform = (currentPlayingTime: number): string =>
            `translateX(${(currentPlayingTime / props.duration) * canvasTargetWidth() - playingHeadWidth / 2}px)`;
        const currentTransform = (playingHeadContainer.style.transform = generateTransform(currentPlayingTime));
        playingHeadTransitionAnimation = playingHeadContainer.animate(
            [
                { transform: currentTransform },
                { transform: generateTransform(currentPlayingTime + playingHeadTransitionTime / 1000) },
            ],
            playingHeadTransitionTime,
        );
    });

    return (
        <div class={styles["channel-plot"]} style={props.hide ? { display: "none" } : {}}>
            <ChannelAxisY
                width={axisYWidth}
                height={props.targetHeight}
                minFreq={props.minFreq}
                maxFreq={props.maxFreq}
                logBase={props.logBase}
                padding={[0, topPadding, 0, axisXHeight]}
            />
            <div
                ref={canvasContainer}
                class={styles["channel-canvas-container"]}
                on:dblclick={(e) => {
                    const { onToggleZoomRequest: toggleZoom } = props;
                    if (toggleZoom) {
                        e.preventDefault();
                        toggleZoom();
                    }
                }}
                on:wheel={{
                    passive: false,
                    handleEvent(e) {
                        const { horizontalScale, pixelWidth } = props;
                        const canvasWidth = unscaledCanvasWidth();
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
                    if (playingHeadDragging) {
                        const { currentPlayingTime, duration, onSeekRequest: setCurrentPlayingTime } = props;
                        if (currentPlayingTime != null && setCurrentPlayingTime) {
                            setCurrentPlayingTime(
                                ((e.x - e.currentTarget.getBoundingClientRect().left + (props.horizontalScroll ?? 0)) /
                                    canvasTargetWidth()) *
                                    duration,
                            );
                        }
                    } else {
                        const {
                            horizontalScale,
                            horizontalScroll,
                            onHorizontalScrollChanged: setHorizontalScroll,
                        } = props;
                        const canvasWidth = unscaledCanvasWidth();
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
                    }
                }}
                on:mousedown={(e) => {
                    const { pixelWidth } = props;
                    const canvasWidth = unscaledCanvasWidth();
                    if (e.button == 1 && !isModifierPreventing(e)) {
                        scalePixelToPixel(e, pixelWidth, canvasWidth);
                    }
                }}
                on:mouseup={(e) => {
                    if (e.button == 0) {
                        playingHeadDragging = false;
                    }
                }}
                // @ts-expect-error webkit proprietary
                on:webkitmouseforcewillbegin={(e: MouseEvent) => e.preventDefault()}
                on:webkitmouseforcedown={(e: MouseEvent & { currentTarget: HTMLElement }) => {
                    const { pixelWidth } = props;
                    const canvasWidth = unscaledCanvasWidth();
                    scalePixelToPixel(e, pixelWidth, canvasWidth);
                }}
            >
                <div class={styles["channel-canvas-scrollable"]}>
                    <canvas
                        ref={canvas}
                        class={styles["channel-canvas"]}
                        style={{
                            width: `${canvasTargetWidth()}px`,
                            height: `${canvasTargetHeight()}px`,
                        }}
                    />
                    <ChannelAxisX width={canvasTargetWidth()} height={axisXHeight} duration={props.duration} />
                    <Show when={props.currentPlayingTime != null}>
                        <div
                            ref={playingHeadContainer}
                            class={styles["playing-head-absolute-container"]}
                            on:mousedown={(e) => {
                                if (e.button == 0 && !isModifierPreventing(e)) {
                                    e.preventDefault();
                                    playingHeadDragging = true;
                                }
                            }}
                        >
                            <PlayingHead
                                width={playingHeadWidth}
                                height={canvasTargetHeight() + 5}
                                color={props.playingHeadColor ?? "white"}
                            />
                        </div>
                    </Show>
                </div>
            </div>
        </div>
    );
};

export default ChannelSpectrum;
