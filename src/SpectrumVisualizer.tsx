import type { Component, Signal } from "solid-js";
import { createSignal, Index, createEffect, untrack, createSelector } from "solid-js";
import { createElementSize } from "@solid-primitives/resize-observer";
import ChannelSpectrum from "./ChannelSpectrum";
import { createDerived, createAsync, extractProps } from "./utils";

const { PI, sin, round, ceil, log } = Math;

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

function generateIndices(logBase: number, length: number): number[] | undefined {
    if (logBase == 1) {
        return;
    }
    const indices: number[] = [];
    const ymax = length - 1;
    for (let i = 0; i < length; ++i) {
        indices.push(round((log((i * (logBase - 1)) / ymax + 1) / log(logBase)) * ymax));
    }
    return indices;
}

const SpectrumVisualizer: Component<{
    blob?: Blob;
    fftPower?: number;
    logBase?: number;
    palette?: SpectrumVisualizerPalette;
    currentPlayingTime?: number;
    onStateChanged?: (state: SpectrumVisualizerState) => void;
    onSeekRequest?: (time: number) => void;
}> = (props) => {
    const { blob, fftPower, logBase, palette, currentPlayingTime, onStateChanged, onSeekRequest } = extractProps(
        props,
        {
            fftPower: defaultFFTPower,
            logBase: defaultLogBase,
            palette: defaultPalette,
        },
    );
    const fftSize = (): number => 1 << fftPower();

    const [audioBuffer] = createAsync([blob], (abortSignal, blob) =>
        new Promise<ArrayBuffer>((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsArrayBuffer(blob);
            reader.onload = () => {
                resolve(reader.result as ArrayBuffer);
            };
            reader.onerror = () => {
                reject(reader.error!);
            };
            abortSignal.onabort = () => reader.abort();
        }).then((arrayBuffer) => {
            const audioContext = new AudioContext();
            return audioContext.decodeAudioData(arrayBuffer);
        }),
    );

    const canvasRefs = createDerived([() => audioBuffer()?.numberOfChannels], (numberOfChannels) => {
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
            analyser.fftSize = fftSize();
            analyser.smoothingTimeConstant = 0;
            analyser.minDecibels = -120;
            analyser.maxDecibels = 0;
            channelSplitter.connect(analyser, i);
            analyser.connect(channelMerger, 0, i);
            analysers.push(analyser);
        }
        const scriptProcessor = audioContext.createScriptProcessor(fftSize(), 1, 1);
        channelMerger.connect(scriptProcessor);
        scriptProcessor.connect(audioContext.destination);
        return {
            audioContext,
            bufferSource,
            channelSplitter,
            analysers,
            channelMerger,
            scriptProcessor,
            palette: palettes[palette()](),
            indices: generateIndices(logBase(), analysers[0].frequencyBinCount),
        };
    });

    const channelPropList = createDerived(
        [audioBuffer, canvasRefs, audioSystem],
        (audioBuffer, canvasRefs, audioSystem) => {
            return canvasRefs.map(([_, ref], i) => {
                return {
                    ref,
                    width: ceil(audioBuffer.length / fftSize()),
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

    const [_, abortAnalysing] = createAsync([audioSystem, canvasList], (abortSignal, audioSystem, canvasList) =>
        untrack(() => {
            const { audioContext, bufferSource, analysers, scriptProcessor, palette, indices } = audioSystem;
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
                    analyser.getByteFrequencyData(fftBuffer);
                    return fftBuffer;
                });
                fftBuffers.forEach((fftBuffer, i) => {
                    const renderingContext = renderingContextList[i];
                    const { length } = fftBuffer;
                    const ymax = length - 1;
                    const imageData = imageDataList[i];
                    const imageView = new DataView(imageData.data.buffer);
                    if (indices) {
                        for (let i = 0; i < length; ++i) {
                            imageView.setUint32(4 * i, palette[fftBuffer[ymax - indices[i]]], true);
                        }
                    } else {
                        fftBuffer.forEach((v, i) => {
                            imageView.setUint32(4 * (ymax - i), palette[v], true);
                        });
                    }
                    freeBufferList.push(fftBuffer);
                    renderingContext.putImageData(imageData, currentStep, 0);
                });
                setProgress((prevStep) => (prevStep as number) + 1);
            };
            abortSignal.onabort = () => {
                bufferSource.stop();
            };
            setProgress(0);
            return audioContext
                .startRendering()
                .then(() => {
                    analysingTotalTime = performance.now() - startTime;
                    setProgress(Infinity);
                })
                .catch((error: Error) => {
                    setProgress(error);
                });
        }),
    );

    let stage!: HTMLDivElement;
    const targetSize = createElementSize(() => stage);

    createEffect(() => {
        const setState = untrack(() => onStateChanged() ?? (() => void 0));
        switch (audioBuffer.state) {
            case "unresolved":
                abortAnalysing();
                setState({ type: "inited" });
                break;
            case "pending":
            case "refreshing":
                abortAnalysing();
                setState({ type: "decoding" });
                break;
            case "errored":
                setState({ type: "errored", error: audioBuffer.error as Error });
                break;
            case "ready": {
                const p = progress();
                if (p == Infinity) {
                    setState({ type: "finished", duration: analysingTotalTime / 1000 });
                } else if (typeof p == "number") {
                    const buf = audioBuffer();
                    if (buf) {
                        setState({ type: "analysing", progress: (p * fftSize()) / buf.length });
                    }
                } else {
                    setState({ type: "errored", error: p });
                }
                break;
            }
        }
    });

    const [zoomedChannel, setZoomedChannel] = createSignal<number>();
    const isZoomedChannel = createSelector(zoomedChannel);

    const [horizontalScale, setHorizontalScale] = createSignal<number>(1);
    const [horizontalScroll, setHorizontalScroll] = createSignal<number>(0);

    return (
        <div class="flex flex-col grow overflow-hidden bg-black" ref={stage}>
            <Index each={channelPropList()}>
                {(item, index) => (
                    <ChannelSpectrum
                        onCanvasChanged={item().ref}
                        pixelWidth={item().width}
                        pixelHeight={item().height}
                        targetWidth={targetSize.width!}
                        targetHeight={
                            targetSize.height! / (isZoomedChannel(index) ? 1 : audioBuffer()!.numberOfChannels)
                        }
                        minFreq={0}
                        maxFreq={audioBuffer()!.sampleRate / 2}
                        logBase={logBase()}
                        duration={audioBuffer()!.duration}
                        horizontalScale={horizontalScale()}
                        onHorizontalScaleChanged={setHorizontalScale}
                        hide={zoomedChannel() != null && !isZoomedChannel(index)}
                        onToggleZoomRequest={() => {
                            if (isZoomedChannel(index)) {
                                setZoomedChannel(void 0);
                            } else {
                                setZoomedChannel(index);
                            }
                        }}
                        horizontalScroll={horizontalScroll()}
                        onHorizontalScrollChanged={setHorizontalScroll}
                        currentPlayingTime={currentPlayingTime()}
                        onSeekRequest={onSeekRequest()}
                        playingHeadColor={((palette) => {
                            switch (palette) {
                                case "sox":
                                    return "green";
                                case "mono":
                                    return "white";
                                case "spectrum":
                                    return "red";
                            }
                        })(palette())}
                    />
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

export const defaultFFTPower = 12;
export const defaultLogBase = 1;
export const defaultPalette = "sox";
