import { Component, createSignal, Switch, Match } from "solid-js";
import SpectrumVisualizer, { SpectrumVisualizerState } from "./SpectrumVisualizer";
import styles from "./styles.module.css";

const App: Component<{}> = () => {
    let fileInput!: HTMLInputElement;
    const [audioFile, setAudioFile] = createSignal<File>();
    const [state, setState] = createSignal<SpectrumVisualizerState>();
    const [invalid, setInvalid] = createSignal(true);

    return (
        <>
            <form
                class={styles["file-input-form"]}
                on:submit={(e) => {
                    e.preventDefault();
                    setAudioFile(fileInput.files![0]);
                    setInvalid(false);
                }}
                on:reset={() => {
                    setAudioFile(void 0);
                }}
            >
                <input type="file" accept="audio/*" required ref={fileInput} on:change={() => setInvalid(true)} />
                <input type="submit" value="Open" style={audioFile() && !invalid() ? { display: "none" } : {}} />
                <input type="reset" value="Close" style={!audioFile() || invalid() ? { display: "none" } : {}} />
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
                    <Match when={state()?.type == "finished"}>Finished.</Match>
                </Switch>
            </p>
            <SpectrumVisualizer blob={audioFile()} stateRef={setState} />
        </>
    );
};

export default App;
