import type { JSXElement } from "solid-js";
import { createEffect, createMemo, createSignal, Switch, Match, batch, untrack } from "solid-js";
import { defaultFFTPower, defaultLogBase, defaultPalette } from "./SpectrumVisualizer";
import type { SpectrumVisualizerPalette, SpectrumVisualizerState } from "./SpectrumVisualizer";
import SpectrumVisualizer from "./SpectrumVisualizer";
import { createTrigger, createThrottled, cl } from "./utils.ts";

const App = (): JSXElement => {
    let fileInput!: HTMLInputElement;
    let fftSizeInput!: HTMLInputElement;
    let logBaseInput!: HTMLInputElement;
    let paletteInput!: HTMLSelectElement;
    let audioPlayer!: HTMLAudioElement;
    const [audioFile, setAudioFile] = createSignal<File>();
    const [fftPower, setFFTPower] = createSignal(defaultFFTPower);
    const [logBase, setLogBase] = createSignal(defaultLogBase);
    const [palette, setPalette] = createSignal<SpectrumVisualizerPalette>(defaultPalette);
    const [state, setState] = createSignal<SpectrumVisualizerState>();
    const [invalid, setInvalid] = createSignal(true);
    const invalidate = () => void setInvalid(true);
    const [playing, setPlaying] = createSignal(false);
    const [currentPlayingTime, setCurrentPlayingTime] = createSignal<number>();
    const updateCurrentPlayingTime = (): void => {
        if (untrack(playing)) {
            setCurrentPlayingTime(audioPlayer.currentTime);
        }
    };
    const [seekRequest, setSeekRequest] = createSignal<number>();
    const newPlayingTime = createThrottled(seekRequest, 50);
    const audioURL = createMemo<string | undefined>((prev) => {
        if (prev) {
            URL.revokeObjectURL(prev);
        }
        const blob = audioFile();
        if (blob) {
            return URL.createObjectURL(blob);
        }
    });
    createEffect(() => {
        if (playing()) {
            audioPlayer.play().catch((error: Error) => {
                setState({
                    type: "errored",
                    error,
                });
            });
        } else {
            audioPlayer.pause();
            setCurrentPlayingTime(void 0);
        }
    });
    createEffect(() => {
        if (invalid()) {
            setPlaying(false);
        }
    });
    createTrigger([newPlayingTime], (newPlayingTime) => {
        audioPlayer.currentTime = newPlayingTime;
        setSeekRequest(void 0);
    });

    return (
        <div class="flex flex-col gap-2 pt-2">
            <form
                class="flex flex-row items-start gap-2 mx-2"
                on:submit={(e) => {
                    e.preventDefault();
                    batch(() => {
                        setAudioFile(fileInput.files![0]);
                        setFFTPower(Number(fftSizeInput.value));
                        setLogBase(Number(logBaseInput.value));
                        setPalette(paletteInput.value as SpectrumVisualizerPalette);
                        setInvalid(false);
                    });
                }}
                on:reset={(e) => {
                    e.preventDefault();
                    fileInput.value = "";
                    batch(() => {
                        setAudioFile(void 0);
                        setFFTPower(defaultFFTPower);
                        setLogBase(defaultLogBase);
                        setPalette(defaultPalette);
                        setInvalid(true);
                    });
                }}
            >
                <input type="file" accept="audio/*" required class="grow" ref={fileInput} on:change={invalidate} />
                <label>
                    FFT Size: 2^
                    <input
                        type="number"
                        min="10"
                        max="14"
                        step="1"
                        value={fftPower()}
                        required
                        ref={fftSizeInput}
                        on:change={invalidate}
                    />
                </label>
                <label>
                    {"Log base: "}
                    <input
                        type="number"
                        min="1"
                        max="100"
                        step="1"
                        value={logBase()}
                        required
                        ref={logBaseInput}
                        on:change={invalidate}
                    />
                </label>
                <label>
                    {"Palette: "}
                    <select ref={paletteInput} value={palette()} required on:change={invalidate}>
                        <option value="sox">SoX</option>
                        <option value="mono">Monochrome</option>
                        <option value="spectrum">Spectrum</option>
                    </select>
                </label>
                <input
                    type="button"
                    value="Play"
                    class="order-first min-w-16"
                    disabled={invalid() || state()?.type != "finished"}
                    on:click={() => void setPlaying(true)}
                />
                <input
                    type="submit"
                    value="Open"
                    class={cl`order-first min-w-16 ${audioFile() && !invalid()} hidden`}
                />
                <input
                    type="reset"
                    value="Reset"
                    class={cl`order-first min-w-16 ${!audioFile() || invalid()} hidden`}
                />
            </form>
            <div class="flex items-center mx-2">
                <div class={cl`${playing()} hidden`}>
                    <Switch fallback="Please open an audio file.">
                        <Match when={audioFile() && invalid()}>Please click "open" to process.</Match>
                        <Match when={state()?.type == "decoding"}>
                            <>
                                Decoding <progress />
                            </>
                        </Match>
                        <Match when={state()?.type == "analysing"}>
                            <>
                                {"Analysing "}
                                <progress
                                    value={(state()! as { type: "analysing"; progress: number }).progress * 100}
                                    max="100"
                                />
                            </>
                        </Match>
                        <Match when={state()?.type == "errored"}>
                            Failed: {(state()! as { type: "errored"; error: Error }).error.message}
                        </Match>
                        <Match when={state()?.type == "finished"}>
                            Finished in {(state()! as { type: "finished"; duration: number }).duration.toFixed(3)}s.
                        </Match>
                    </Switch>
                </div>
                <audio
                    src={audioURL()}
                    controls
                    class={cl`h-8 ${!playing()} invisible`}
                    ref={audioPlayer}
                    on:timeupdate={updateCurrentPlayingTime}
                    on:seeked={updateCurrentPlayingTime}
                    on:pause={updateCurrentPlayingTime}
                    on:ended={updateCurrentPlayingTime}
                />
            </div>
            <SpectrumVisualizer
                blob={audioFile()}
                fftPower={fftPower()}
                logBase={logBase()}
                palette={palette()}
                currentPlayingTime={currentPlayingTime()}
                onStateChanged={setState}
                onSeekRequest={setSeekRequest}
            />
        </div>
    );
};

export default App;
