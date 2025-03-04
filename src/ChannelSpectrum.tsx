import type { Component } from "solid-js";
import { Show, batch, createEffect } from "solid-js";
import { cl, clamp, createTrigger, extractProps } from "./utils";
import ChannelAxisY from "./ChannelAxisY.tsx";
import ChannelAxisX from "./ChannelAxisX.tsx";
import PlayingHead from "./PlayingHead.tsx";

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
    const {
        onCanvasChanged,
        pixelWidth,
        pixelHeight,
        targetWidth,
        targetHeight,
        minFreq,
        maxFreq,
        logBase,
        duration,
        horizontalScale,
        onHorizontalScaleChanged,
        hide,
        onToggleZoomRequest,
        horizontalScroll,
        onHorizontalScrollChanged,
        currentPlayingTime,
        onSeekRequest,
        playingHeadColor,
    } = extractProps(props);

    let canvas!: HTMLCanvasElement;
    let canvasContainer!: HTMLDivElement;
    let playingHeadContainer!: HTMLDivElement;

    const axisYWidth = 60;
    const axisXHeight = 20;
    const topPadding = 10;
    const unscaledCanvasWidth = (): number => targetWidth() - axisYWidth;
    const canvasTargetWidth = (): number => unscaledCanvasWidth() * (horizontalScale() ?? 1);
    const canvasTargetHeight = (): number => targetHeight() - axisXHeight - topPadding;

    const stableScale = (e: MouseEvent & { currentTarget: HTMLElement }, newScale: number): void => {
        const setHorizontalScale = onHorizontalScaleChanged();
        const setHorizontalScroll = onHorizontalScrollChanged();
        const oldScale = horizontalScale();
        const oldScroll = horizontalScroll() ?? 0;
        if (!oldScale || !setHorizontalScale) return;
        e.preventDefault();
        const newScroll = clamp(
            oldScroll + (e.x - e.currentTarget.getBoundingClientRect().left + oldScroll) * (newScale / oldScale - 1),
            0,
            unscaledCanvasWidth() * (newScale - 1),
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
        const pixelToPixelScale = pixelWidth / canvasWidth / devicePixelRatio;
        const newScale = horizontalScale() == pixelToPixelScale ? 1 : pixelToPixelScale;
        stableScale(e, newScale);
    };

    createEffect(() => {
        canvas.width = pixelWidth();
        canvas.height = pixelHeight();
        onCanvasChanged()?.(canvas);
    });

    let scrolling = false;
    let scrolledByUs = false;
    createTrigger([horizontalScroll], (scroll) => {
        if (!hide() && !scrolling) {
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
    createTrigger([currentPlayingTime], (currentPlayingTime) => {
        const currentTime = performance.now();
        const newTransitionTime = currentTime - lastPlayingTimeUpdate;
        if (newTransitionTime < 300) {
            playingHeadTransitionTime = newTransitionTime;
        }
        lastPlayingTimeUpdate = currentTime;

        playingHeadTransitionAnimation?.cancel();
        const generateTransform = (currentPlayingTime: number): string =>
            `translateX(${(currentPlayingTime / duration()) * canvasTargetWidth() - playingHeadWidth / 2}px)`;
        const currentTransform = (playingHeadContainer.style.transform = generateTransform(currentPlayingTime));
        playingHeadTransitionAnimation = playingHeadContainer.animate(
            [
                { transform: currentTransform },
                { transform: generateTransform(currentPlayingTime + playingHeadTransitionTime / 1000) },
            ],
            playingHeadTransitionTime,
        );
    });

    let axisSelecting = false;

    return (
        <div class={cl`grid grid-cols-[60px_1fr] ${hide()} hidden`}>
            <ChannelAxisY
                width={axisYWidth}
                height={targetHeight()}
                minFreq={minFreq()}
                maxFreq={maxFreq()}
                logBase={logBase()}
                padding={[0, topPadding, 0, axisXHeight]}
            />
            <div
                class="overflow-x-auto overscroll-none overlay-scrollbar"
                ref={canvasContainer}
                on:dblclick={(e) => {
                    const toggleZoom = onToggleZoomRequest();
                    if (toggleZoom) {
                        e.preventDefault();
                        toggleZoom();
                    }
                }}
                on:wheel={{
                    passive: false,
                    handleEvent(e) {
                        const scale = horizontalScale();
                        if (
                            scale &&
                            e.deltaX == 0 &&
                            e.deltaMode == WheelEvent.DOM_DELTA_PIXEL &&
                            !isModifierPreventing(e)
                        ) {
                            stableScale(
                                e,
                                clamp(
                                    scale * pow(1.2, -e.deltaY / 100),
                                    1,
                                    ((pixelWidth() / unscaledCanvasWidth()) * 2) / devicePixelRatio,
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
                            scrolling = true;
                            onHorizontalScrollChanged()?.(e.target.scrollLeft);
                            if (scrollStopAction) {
                                clearTimeout(scrollStopAction);
                            }
                            scrollStopAction = setTimeout(() => {
                                scrolling = false;
                                scrollStopAction = void 0;
                            }, 100);
                        }
                    },
                }}
                on:scrollend={() => void (scrolling = false)}
                on:mousemove={(e) => {
                    if (playingHeadDragging) {
                        const setCurrentPlayingTime = onSeekRequest();
                        if (currentPlayingTime() != null && setCurrentPlayingTime) {
                            setCurrentPlayingTime(
                                ((e.x - e.currentTarget.getBoundingClientRect().left + (horizontalScroll() ?? 0)) /
                                    canvasTargetWidth()) *
                                    duration(),
                            );
                        }
                    } else if (!axisSelecting) {
                        const setHorizontalScroll = onHorizontalScrollChanged();
                        const scale = horizontalScale();
                        const scroll = horizontalScroll();
                        if (
                            scale &&
                            scroll != null &&
                            setHorizontalScroll &&
                            e.buttons == 1 &&
                            !isModifierPreventing(e)
                        ) {
                            setHorizontalScroll(
                                clamp(scroll - e.movementX / devicePixelRatio, 0, unscaledCanvasWidth() * (scale - 1)),
                            );
                        }
                    }
                }}
                on:mousedown={(e) => {
                    if (!isModifierPreventing(e)) {
                        if (e.button == 0) {
                            if (playingHeadContainer.contains(e.target)) {
                                e.preventDefault();
                                playingHeadDragging = true;
                            } else if (e.target.tagName == "text") {
                                axisSelecting = true;
                            }
                        } else if (e.button == 1) {
                            scalePixelToPixel(e, pixelWidth(), unscaledCanvasWidth());
                        }
                    }
                }}
                on:mouseup={(e) => {
                    if (e.button == 0) {
                        playingHeadDragging = false;
                        axisSelecting = false;
                    }
                }}
                // @ts-expect-error webkit proprietary
                on:webkitmouseforcewillbegin={(e: MouseEvent) => e.preventDefault()}
                on:webkitmouseforcedown={(e: MouseEvent & { currentTarget: HTMLElement }) => {
                    scalePixelToPixel(e, pixelWidth(), unscaledCanvasWidth());
                }}
            >
                <div class="flex flex-col relative">
                    <canvas
                        class="mt-[10px]"
                        ref={canvas}
                        style={{
                            width: `${canvasTargetWidth()}px`,
                            height: `${canvasTargetHeight()}px`,
                        }}
                    />
                    <ChannelAxisX width={canvasTargetWidth()} height={axisXHeight} duration={duration()} />
                    <Show when={currentPlayingTime() != null}>
                        <div
                            class="absolute left-0 top-[5px] cursor-ew-resize"
                            ref={playingHeadContainer}
                        >
                            <PlayingHead
                                width={playingHeadWidth}
                                height={canvasTargetHeight() + 5}
                                color={playingHeadColor() ?? "white"}
                            />
                        </div>
                    </Show>
                </div>
            </div>
        </div>
    );
};

export default ChannelSpectrum;
