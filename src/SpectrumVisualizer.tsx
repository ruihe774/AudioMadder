import type { Component, Signal } from "solid-js";
import {
    createResource,
    createSignal,
    Index,
    onCleanup,
    onMount,
    createEffect,
    untrack,
    createSelector,
    batch,
} from "solid-js";
import ChannelSpectrum from "./ChannelSpectrum";
import { createDerived, createTrigger, extract, clamp } from "./utils";
import styles from "./styles.module.css";

const { PI, sin, round, ceil, pow } = Math;

function generatePalette(fn: (level: number) => number): number[] {
    const palette: number[] = [];
    for (let i = 0; i < 256; ++i) {
        palette.push(fn(i));
    }
    return palette;
}

function lazyEval<R>(fn: () => R): () => R {
    let resolved: R | undefined;
    return () => (resolved = resolved ?? fn());
}

const palettes = {
    sox: lazyEval(() =>
        generatePalette((level) => {
            level /= 255.0;
            let r = 0.0;
            if (level >= 0.13 && level < 0.73) {
                r = sin((((level - 0.13) / 0.6) * PI) / 2.0);
            } else if (level >= 0.73) {
                r = 1.0;
            }

            let g = 0.0;
            if (level >= 0.6 && level < 0.91) {
                g = sin((((level - 0.6) / 0.31) * PI) / 2.0);
            } else if (level >= 0.91) {
                g = 1.0;
            }

            let b = 0.0;
            if (level < 0.6) {
                b = 0.5 * sin((level / 0.6) * PI);
            } else if (level >= 0.78) {
                b = (level - 0.78) / 0.22;
            }

            const rr = round(r * 255.0);
            const gg = round(g * 255.0);
            const bb = round(b * 255.0);
            return (255 << 24) | (bb << 16) | (gg << 8) | rr;
        }),
    ),

    mono: lazyEval(() =>
        generatePalette((level) => {
            return (255 << 24) | (level << 16) | (level << 8) | level;
        }),
    ),

    spectrum: lazyEval(() =>
        generatePalette((level) => {
            level /= 255.0;
            level *= 0.6625;
            let r = 0.0,
                g = 0.0,
                b = 0.0;
            if (level >= 0 && level < 0.15) {
                r = (0.15 - level) / (0.15 + 0.075);
                g = 0.0;
                b = 1.0;
            } else if (level >= 0.15 && level < 0.275) {
                r = 0.0;
                g = (level - 0.15) / (0.275 - 0.15);
                b = 1.0;
            } else if (level >= 0.275 && level < 0.325) {
                r = 0.0;
                g = 1.0;
                b = (0.325 - level) / (0.325 - 0.275);
            } else if (level >= 0.325 && level < 0.5) {
                r = (level - 0.325) / (0.5 - 0.325);
                g = 1.0;
                b = 0.0;
            } else if (level >= 0.5 && level < 0.6625) {
                r = 1.0;
                g = (0.6625 - level) / (0.6625 - 0.5);
                b = 0.0;
            }

            let cf = 1.0;
            if (level >= 0.0 && level < 0.1) {
                cf = level / 0.1;
            }
            cf *= 255.0;

            const rr = round(r * cf + 0.5);
            const gg = round(g * cf + 0.5);
            const bb = round(b * cf + 0.5);
            return (255 << 24) | (bb << 16) | (gg << 8) | rr;
        }),
    ),
};

function isModifierPreventing(e: MouseEvent | KeyboardEvent): boolean {
    return e.getModifierState("Accel");
}

const SpectrumVisualizer: Component<{
    blob?: Blob;
    fftSize: number;
    palette: SpectrumVisualizerPalette;
    stateRef?: (state: SpectrumVisualizerState) => void;
}> = (props) => {
    const [audioBuffer, { mutate: setAudioBuffer }] = createResource(extract(props, "blob"), (blob) =>
        new Promise<ArrayBuffer>((resovle, reject) => {
            const reader = new FileReader();
            reader.readAsArrayBuffer(blob);
            reader.onload = () => {
                resovle(reader.result as ArrayBuffer);
            };
            reader.onerror = () => {
                reject(reader.error!);
            };
        }).then((arrayBuffer) => {
            const audioContext = new AudioContext();
            return audioContext.decodeAudioData(arrayBuffer);
        }),
    );

    createEffect(() => {
        if (!props.blob) {
            setAudioBuffer(void 0);
        }
    });

    const canvasRefs = createDerived([extract(audioBuffer, "numberOfChannels")], (numberOfChannels) => {
        const canvasRefs: Signal<HTMLCanvasElement | undefined>[] = [];
        for (let i = 0; i < numberOfChannels; ++i) {
            canvasRefs.push(createSignal());
        }
        return canvasRefs;
    });

    const audioSystem = createDerived([audioBuffer], (audioBuffer) => {
        const audioContext = new OfflineAudioContext(
            audioBuffer.numberOfChannels,
            audioBuffer.length,
            audioBuffer.sampleRate,
        );
        const bufferSource = audioContext.createBufferSource();
        bufferSource.buffer = audioBuffer;
        bufferSource.start();
        const channelSplitter = audioContext.createChannelSplitter(audioBuffer.numberOfChannels);
        bufferSource.connect(channelSplitter);
        const channelMerger = audioContext.createChannelMerger(audioBuffer.numberOfChannels);
        const analysers: AnalyserNode[] = [];
        for (let i = 0; i < audioBuffer.numberOfChannels; ++i) {
            const analyser = audioContext.createAnalyser();
            analyser.fftSize = props.fftSize;
            analyser.smoothingTimeConstant = 0;
            channelSplitter.connect(analyser, i);
            analyser.connect(channelMerger, 0, i);
            analysers.push(analyser);
        }
        const scriptProcessor = audioContext.createScriptProcessor(props.fftSize, 1, 1);
        channelMerger.connect(scriptProcessor);
        scriptProcessor.connect(audioContext.destination);
        const palette = palettes[props.palette]();
        return {
            audioContext,
            bufferSource,
            channelSplitter,
            analysers,
            channelMerger,
            scriptProcessor,
            palette,
        };
    });

    const channelPropList = createDerived(
        [audioBuffer, canvasRefs, audioSystem],
        (audioBuffer, canvasRefs, audioSystem) => {
            return canvasRefs.map(([_, ref], i) => {
                return {
                    ref,
                    width: ceil(audioBuffer.length / props.fftSize),
                    height: audioSystem.analysers[i].frequencyBinCount,
                };
            });
        },
    );

    const canvasList = createDerived([canvasRefs], (canvasRefs) => {
        const canvasList: HTMLCanvasElement[] = [];
        for (const [ref, _] of canvasRefs) {
            const image = ref();
            if (image) canvasList.push(image);
            else return;
        }
        return canvasList;
    });

    const [progress, setProgress] = createSignal<number | Error>(0);
    let analysingTotalTime!: number;
    let analysingAbortController = new AbortController();
    const resetAnalysing = (): void => {
        setProgress(0);
        analysingAbortController.abort();
    };

    createTrigger([audioSystem, canvasList], (audioSystem, canvasList) => {
        resetAnalysing();
        const currentAbortSignal = (analysingAbortController = new AbortController()).signal;
        const { audioContext, bufferSource, analysers, scriptProcessor, palette } = audioSystem;
        const renderingContextList = canvasList.map(
            (canvas) =>
                canvas.getContext("2d", {
                    alpha: false,
                    desynchronized: true,
                })!,
        );
        const freeBufferList: Uint8Array[] = [];
        const imageDataList: ImageData[] = renderingContextList.map((renderingContext, i) =>
            renderingContext.createImageData(1, analysers[i].frequencyBinCount),
        );
        let step = 0;
        const startTime = performance.now();
        scriptProcessor.onaudioprocess = () => {
            const currentStep = step++;
            const fftBuffers = analysers.map((analyser) => {
                const fftBuffer = freeBufferList.pop() ?? new Uint8Array(analyser.frequencyBinCount);
                if (fftBuffer.length != analyser.frequencyBinCount) {
                    throw new Error("invalid buffer");
                }
                analyser.getByteFrequencyData(fftBuffer);
                return fftBuffer;
            });
            fftBuffers.forEach((fftBuffer, i) => {
                const renderingContext = renderingContextList[i];
                const { length } = fftBuffer;
                const imageData = imageDataList[i];
                const imageView = new DataView(imageData.data.buffer);
                fftBuffer.forEach((v, i) => {
                    imageView.setUint32(4 * (length - i - 1), palette[v], true);
                });
                freeBufferList.push(fftBuffer);
                renderingContext.putImageData(imageData, currentStep, 0);
            });
            setProgress((prevStep) => (prevStep as number) + 1);
        };
        audioContext
            .startRendering()
            .then(() => {
                analysingTotalTime = performance.now() - startTime;
                setProgress(Infinity);
            })
            .catch((error) => {
                setProgress(error as Error);
            });
        currentAbortSignal.onabort = () => {
            bufferSource.stop();
        };
    });

    let stage!: HTMLDivElement;
    const [targetSize, setTargetSize] = createSignal<{ width: number; height: number }>({ width: 0, height: 0 });
    const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
            if (entry.target === stage) {
                const boxSize = entry.borderBoxSize[0];
                setTargetSize({ width: boxSize.inlineSize, height: boxSize.blockSize });
            }
        }
    });
    onMount(() => {
        observer.observe(stage);
    });
    onCleanup(() => {
        observer.disconnect();
        analysingAbortController.abort();
    });

    createEffect(() => {
        const stateRef = untrack(extract(props, "stateRef"));
        if (!props.blob) {
            resetAnalysing();
            stateRef?.({ type: "inited" });
        } else if (audioBuffer.state == "errored") {
            stateRef?.({ type: "errored", error: audioBuffer.error as Error });
        } else if (audioBuffer.state == "ready") {
            const p = progress();
            if (p == Infinity) {
                stateRef?.({ type: "finished", duration: analysingTotalTime / 1000 });
            } else if (typeof p == "number") {
                const buf = audioBuffer();
                if (buf) {
                    stateRef?.({ type: "analysing", progress: (p * props.fftSize) / buf.length });
                }
            } else {
                stateRef?.({ type: "errored", error: p });
            }
        } else {
            resetAnalysing();
            stateRef?.({ type: "decoding" });
        }
    });

    const [zoomedChannel, setZoomedChannel] = createSignal<number>();
    const isZoomedChannel = createSelector(zoomedChannel);

    const [horizontalScale, setHorizontalScale] = createSignal<number>(1);
    const [horizontalScroll, setHorizontalScroll] = createSignal<number>(0);

    const stableScale = (e: MouseEvent & { currentTarget: HTMLElement }, newScale: number): void => {
        const oldScale = horizontalScale();
        const oldScroll = horizontalScroll();
        const newScroll = clamp(
            oldScroll + (e.x - e.currentTarget.getBoundingClientRect().left + oldScroll) * (newScale / oldScale - 1),
            0,
            targetSize().width * (newScale - 1),
        );
        batch(() => {
            setHorizontalScale(newScale);
            setHorizontalScroll(newScroll);
        });
    };

    const scalePixelToPixel = (
        e: MouseEvent & { currentTarget: HTMLElement },
        pixelWidth: number,
        targetWidth: number,
    ): void => {
        const oldScale = horizontalScale();
        const pixelToPixelScale = pixelWidth / targetWidth / devicePixelRatio;
        const newScale = oldScale == pixelToPixelScale ? 1 : pixelToPixelScale;
        stableScale(e, newScale);
    };

    return (
        <div class={styles["visualizing-stage"]} ref={stage}>
            <Index each={channelPropList()}>
                {(item, index) => (
                    <div
                        on:dblclick={(e) => {
                            e.preventDefault();
                            if (isZoomedChannel(index)) {
                                setZoomedChannel(void 0);
                            } else {
                                setZoomedChannel(index);
                            }
                        }}
                        on:wheel={{
                            passive: false,
                            handleEvent(e) {
                                if (
                                    e.deltaX == 0 &&
                                    e.deltaMode == WheelEvent.DOM_DELTA_PIXEL &&
                                    !isModifierPreventing(e)
                                ) {
                                    e.preventDefault();
                                    stableScale(
                                        e,
                                        clamp(
                                            horizontalScale() * pow(1.2, -e.deltaY / 100),
                                            1,
                                            ((item().width / targetSize().width) * 2) / devicePixelRatio,
                                        ),
                                    );
                                }
                            },
                        }}
                        on:scroll={{
                            passive: true,
                            handleEvent(e) {
                                setHorizontalScroll(e.target.scrollLeft);
                            },
                        }}
                        on:mousemove={(e) => {
                            if (e.buttons == 1 && !isModifierPreventing(e)) {
                                setHorizontalScroll((prev) =>
                                    clamp(prev - e.movementX, 0, targetSize().width * (horizontalScale() - 1)),
                                );
                            }
                        }}
                        on:mousedown={(e) => {
                            if (e.button == 1 && !isModifierPreventing(e)) {
                                e.preventDefault();
                                scalePixelToPixel(e, item().width, targetSize().width);
                            }
                        }}
                        style={zoomedChannel() != null && !isZoomedChannel(index) ? { display: "none" } : {}}
                        // @ts-expect-error webkit proprietary
                        on:webkitmouseforcewillbegin={(e: MouseEvent) => e.preventDefault()}
                        on:webkitmouseforcedown={(e: MouseEvent & { currentTarget: HTMLElement }) =>
                            scalePixelToPixel(e, item().width, targetSize().width)
                        }
                        prop:scrollLeft={horizontalScroll()}
                    >
                        <ChannelSpectrum
                            canvasRef={item().ref}
                            pixelWidth={item().width}
                            pixelHeight={item().height}
                            targetWidth={targetSize().width * horizontalScale()}
                            targetHeight={
                                targetSize().height / (isZoomedChannel(index) ? 1 : audioBuffer()!.numberOfChannels)
                            }
                        />
                    </div>
                )}
            </Index>
        </div>
    );
};

export default SpectrumVisualizer;

export type SpectrumVisualizerState =
    | {
          type: "inited";
      }
    | {
          type: "decoding";
      }
    | {
          type: "analysing";
          progress: number;
      }
    | {
          type: "finished";
          duration: number;
      }
    | {
          type: "errored";
          error: Error;
      };

export type SpectrumVisualizerPalette = "spectrum" | "sox" | "mono";
