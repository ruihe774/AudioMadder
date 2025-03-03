import { createEffect, createMemo } from "solid-js";
import type { JSXElement } from "solid-js";
import { createSignal, Switch, Match, batch, createDeferred } from "solid-js";
import type { SpectrumVisualizerPalette, SpectrumVisualizerState } from "./SpectrumVisualizer";
import SpectrumVisualizer from "./SpectrumVisualizer";
import styles from "./styles.module.css";

const defaultFFTPower = 12;
const defaultPalette = "sox";

const App = (): JSXElement => {
    let fileInput!: HTMLInputElement;
    let fftSizeInput!: HTMLInputElement;
    let paletteInput!: HTMLSelectElement;
    let audioPlayer!: HTMLAudioElement;
    const [audioFile, setAudioFile] = createSignal<File>();
    const [fftPower, setFFTPower] = createSignal(defaultFFTPower);
    const deferredFFTPower = createDeferred(fftPower);
    const [palette, setPalette] = createSignal<SpectrumVisualizerPalette>(defaultPalette);
    const deferredPalette = createDeferred(palette);
    const [state, setState] = createSignal<SpectrumVisualizerState>();
    const [invalid, setInvalid] = createSignal(true);
    const invalidate = () => void setInvalid(true);
    const [playing, setPlaying] = createSignal(false);
    const [currentPlayingTime, setCurrentPlayingTime] = createSignal(0);
    const updateCurrentPlayingTime = () => void setCurrentPlayingTime(audioPlayer.currentTime);
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
        }
    });
    createEffect(() => {
        if (invalid()) {
            setPlaying(false);
        }
    });

    return (
        <>
            <form
                class={styles["file-input-form"]}
                on:submit={(e) => {
                    e.preventDefault();
                    batch(() => {
                        setAudioFile(fileInput.files![0]);
                        setFFTPower(Number(fftSizeInput.value));
                        setPalette(paletteInput.value as SpectrumVisualizerPalette);
                        setInvalid(false);
                    });
                }}
                on:reset={() => {
                    batch(() => {
                        setAudioFile(void 0);
                        setFFTPower(defaultFFTPower);
                        setPalette(defaultPalette);
                        setInvalid(true);
                    });
                }}
            >
                <input type="file" accept="audio/*" required ref={fileInput} on:change={invalidate} />
                <label>
                    FFT Size: 2^
                    <input
                        type="number"
                        min="10"
                        max="14"
                        step="1"
                        value={deferredFFTPower()}
                        required
                        ref={fftSizeInput}
                        on:change={invalidate}
                    />
                </label>
                <label>
                    {"Palette: "}
                    <select ref={paletteInput} value={deferredPalette()} required on:change={invalidate}>
                        <option value="sox">SoX</option>
                        <option value="mono">Monochrome</option>
                        <option value="spectrum">Spectrum</option>
                    </select>
                </label>
                <button type="button" disabled={state()?.type != "finished"} on:click={() => void setPlaying(true)}>
                    Play
                </button>
                <input type="submit" value="Open" style={audioFile() && !invalid() ? { display: "none" } : {}} />
                <input type="reset" value="Reset" style={!audioFile() || invalid() ? { display: "none" } : {}} />
            </form>
            <div class={styles["status-bar"]}>
                <div>
                    <Switch fallback="Please open an audio file.">
                        <Match when={audioFile() && invalid()}>Please click "open" to process.</Match>
                        <Match when={playing()}>{""}</Match>
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
                    ref={audioPlayer}
                    on:timeupdate={updateCurrentPlayingTime}
                    on:seeked={updateCurrentPlayingTime}
                    on:pause={updateCurrentPlayingTime}
                    on:ended={updateCurrentPlayingTime}
                    style={playing() ? {} : { visibility: "hidden" }}
                />
            </div>
            <SpectrumVisualizer
                blob={audioFile()}
                fftSize={1 << fftPower()}
                palette={palette()}
                currentPlayingTime={playing() ? currentPlayingTime() : void 0}
                onStateChanged={setState}
                onSeekRequest={(time) => void (audioPlayer.currentTime = time)}
            />
        </>
    );
};

export default App;
