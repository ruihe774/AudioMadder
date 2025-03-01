import { Component, createSignal, Switch, Match, batch, untrack } from "solid-js";
import SpectrumVisualizer, { SpectrumVisualizerPalette, SpectrumVisualizerState } from "./SpectrumVisualizer";
import styles from "./styles.module.css";

const defaultFFTPower = 12;
const defaultStepPower = 10;
const defaultPalette = "sox";

const App: Component<{}> = () => {
    let fileInput!: HTMLInputElement;
    let fftSizeInput!: HTMLInputElement;
    let stepSizeInput!: HTMLInputElement;
    let paletteInput!: HTMLSelectElement;
    const [audioFile, setAudioFile] = createSignal<File>();
    const [fftPower, setFFTPower] = createSignal(defaultFFTPower);
    const [stepPower, setStepPower] = createSignal(defaultStepPower);
    const [palette, setPalette] = createSignal<SpectrumVisualizerPalette>(defaultPalette);
    const [state, setState] = createSignal<SpectrumVisualizerState>();
    const [invalid, setInvalid] = createSignal(true);
    const invalidate = () => setInvalid(true);

    return (
        <>
            <form
                class={styles["file-input-form"]}
                on:submit={(e) => {
                    e.preventDefault();
                    batch(() => {
                        setAudioFile(fileInput.files![0]);
                        setFFTPower(Number(fftSizeInput.value));
                        setStepPower(Number(stepSizeInput.value));
                        setPalette(paletteInput.value as SpectrumVisualizerPalette);
                        setInvalid(false);
                    });
                }}
                on:reset={() => {
                    batch(() => {
                        setAudioFile(void 0);
                        setFFTPower(defaultFFTPower);
                        setStepPower(defaultStepPower);
                        setPalette(defaultPalette);
                        setInvalid(true);
                    });
                    requestIdleCallback(() => {
                        fftSizeInput.value = `${untrack(fftPower)}`;
                        stepSizeInput.value = `${untrack(stepPower)}`;
                        paletteInput.value = `${untrack(palette)}`;
                    });
                }}
            >
                <input type="file" accept="audio/*" required ref={fileInput} on:change={invalidate} />
                <label>
                    FFT Size: 2^
                    <input
                        type="number"
                        min="5"
                        max="15"
                        step="1"
                        value={defaultFFTPower}
                        required
                        ref={fftSizeInput}
                        on:change={invalidate}
                    />
                </label>
                <label>
                    Frame Step: 2^
                    <input
                        type="number"
                        min="10"
                        max="14"
                        step="1"
                        value={defaultStepPower}
                        required
                        ref={stepSizeInput}
                        on:change={invalidate}
                    />
                </label>
                <label>
                    Palette:{" "}
                    <select ref={paletteInput} value={defaultPalette} required on:change={invalidate}>
                        <option value="sox">SoX</option>
                        <option value="mono">Monochrome</option>
                        <option value="spectrum">Spectrum</option>
                    </select>
                </label>
                <input type="submit" value="Open" style={audioFile() && !invalid() ? { display: "none" } : {}} />
                <input type="reset" value="Reset" style={!audioFile() || invalid() ? { display: "none" } : {}} />
            </form>
            <p class={styles["prompt-line"]}>
                <Switch fallback="Please open an audio file.">
                    <Match when={audioFile() && invalid()}>Please click "open" to process.</Match>
                    <Match when={state()?.type == "decoding"}>
                        <>
                            Decoding <progress />
                        </>
                    </Match>
                    <Match when={state()?.type == "analysing"}>
                        <>
                            Analysing{" "}
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
            </p>
            <SpectrumVisualizer
                blob={audioFile()}
                fftSize={1 << fftPower()}
                frameStep={1 << stepPower()}
                palette={palette()}
                stateRef={setState}
            />
        </>
    );
};

export default App;
