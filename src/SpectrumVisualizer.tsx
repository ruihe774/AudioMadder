import {
    createResource,
    createSignal,
    Index,
    Component,
    Signal,
    onCleanup,
    onMount,
    createEffect,
    untrack,
    createSelector,
} from "solid-js";
import ChannelSpectrum from "./ChannelSpectrum";
import { createDerived, runOn, extract } from "./utils";
import styles from "./styles.module.css";

const palettes = {
    sox(level: number): number {
        level /= 255.0;
        let r = 0.0;
        if (level >= 0.13 && level < 0.73) {
            r = Math.sin((((level - 0.13) / 0.6) * Math.PI) / 2.0);
        } else if (level >= 0.73) {
            r = 1.0;
        }

        let g = 0.0;
        if (level >= 0.6 && level < 0.91) {
            g = Math.sin((((level - 0.6) / 0.31) * Math.PI) / 2.0);
        } else if (level >= 0.91) {
            g = 1.0;
        }

        let b = 0.0;
        if (level < 0.6) {
            b = 0.5 * Math.sin((level / 0.6) * Math.PI);
        } else if (level >= 0.78) {
            b = (level - 0.78) / 0.22;
        }

        const rr = Math.round(r * 255.0);
        const gg = Math.round(g * 255.0);
        const bb = Math.round(b * 255.0);
        return (255 << 24) | (bb << 16) | (gg << 8) | rr;
    },

    mono(level: number): number {
        return (255 << 24) | (level << 16) | (level << 8) | level;
    },

    spectrum(level: number): number {
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

        const rr = Math.round(r * cf + 0.5);
        const gg = Math.round(g * cf + 0.5);
        const bb = Math.round(b * cf + 0.5);
        return (255 << 24) | (bb << 16) | (gg << 8) | rr;
    },
};

const SpectrumVisualizer: Component<{
    blob?: Blob;
    fftSize: number;
    frameStep: number;
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
                reject(reader.error);
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
            channelSplitter.connect(analyser, i);
            analyser.connect(channelMerger, 0, i);
            analysers.push(analyser);
        }
        const scriptProcessor = audioContext.createScriptProcessor(props.frameStep, 1, 1);
        channelMerger.connect(scriptProcessor);
        scriptProcessor.connect(audioContext.destination);
        const palette = palettes[props.palette];
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
                    width: Math.ceil(audioBuffer.length / props.frameStep),
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

    runOn([audioSystem, canvasList], (audioSystem, canvasList) => {
        const { audioContext, analysers, scriptProcessor, palette } = audioSystem;
        const renderingContextList = canvasList.map(
            (canvas) =>
                canvas.getContext("2d", {
                    alpha: false,
                    desynchronized: true,
                })!,
        );
        let step = 0;
        const startTime = performance.now();
        scriptProcessor.onaudioprocess = () => {
            const currentStep = step++;
            const fftBuffers = analysers.map((analyser) => {
                const fftBuffer = new Uint8Array(analyser.frequencyBinCount);
                analyser.getByteFrequencyData(fftBuffer);
                return fftBuffer;
            });
            requestIdleCallback(() => {
                fftBuffers.forEach((fftBuffer, i) => {
                    const renderingContext = renderingContextList[i];
                    const { length } = fftBuffer;
                    const imageData = renderingContext.createImageData(1, length);
                    const imageView = new DataView(imageData.data.buffer);
                    fftBuffer.forEach((v, i) => {
                        imageView.setUint32(4 * (length - i - 1), palette(v), true);
                    });
                    renderingContext.putImageData(imageData, currentStep, 0);
                });
                setProgress((prevStep) => (prevStep as number) + 1);
            });
        };
        setProgress(0);
        audioContext
            .startRendering()
            .then(() => {
                analysingTotalTime = performance.now() - startTime;
                setProgress(Infinity);
            })
            .catch((error) => {
                setProgress(error as Error);
            });
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
    });

    createEffect(() => {
        const stateRef = untrack(extract(props, "stateRef"));
        if (audioBuffer.state == "unresolved") {
            setProgress(0);
            stateRef?.({ type: "inited" });
        } else if (audioBuffer.state == "errored") {
            stateRef?.({ type: "errored", error: audioBuffer.error });
        } else if (audioBuffer.state == "ready") {
            const p = progress();
            if (p == Infinity) {
                stateRef?.({ type: "finished", duration: analysingTotalTime / 1000 });
            } else if (typeof p == "number") {
                stateRef?.({ type: "analysing", progress: (p * props.frameStep) / audioBuffer()!.length });
            } else {
                stateRef?.({ type: "errored", error: p });
            }
        } else {
            setProgress(0);
            stateRef?.({ type: "decoding" });
        }
    });

    const [zoomedChannel, setZoomedChannel] = createSignal<number>();
    const isZoomedChannel = createSelector(zoomedChannel);

    return (
        <div class={styles["visualizing-stage"]} ref={stage}>
            <Index each={channelPropList()}>
                {(item, index) => (
                    <div
                        on:dblclick={() => {
                            if (isZoomedChannel(index)) {
                                setZoomedChannel(void 0);
                            } else {
                                setZoomedChannel(index);
                            }
                        }}
                        style={zoomedChannel() != null && !isZoomedChannel(index) ? { display: "none" } : {}}
                    >
                        <ChannelSpectrum
                            canvasRef={item().ref}
                            pixelWidth={item().width}
                            pixelHeight={item().height}
                            targetWidth={targetSize().width}
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
