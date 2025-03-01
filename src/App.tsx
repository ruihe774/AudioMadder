import { Component, createSignal, Show } from "solid-js";
import SpectrumVisualizer from "./SpectrumVisualizer";
import styles from "./styles.module.css";

const App: Component<{}> = () => {
    let fileInput!: HTMLInputElement;
    const [audioFile, setAudioFile] = createSignal<File>();
    return (
        <>
            <form
                class={styles["file-input-form"]}
                on:submit={(e) => {
                    e.preventDefault();
                    setAudioFile(fileInput.files![0]);
                }}
                on:reset={() => {
                    setAudioFile(void 0);
                }}
            >
                <input type="file" accept="audio/*" required ref={fileInput} on:change={() => setAudioFile(void 0)} />
                <Show when={audioFile()} fallback={<input type="submit" value="Open" />}>
                    <input type="reset" value="Close" />
                </Show>
            </form>
            <Show when={audioFile()} fallback={<p class={styles["prompt-line"]}>Please open an audio file.</p>}>
                <SpectrumVisualizer blob={audioFile()!} />
            </Show>
        </>
    );
};

export default App;
