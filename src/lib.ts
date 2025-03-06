import { createRoot } from "solid-js";
import { createStaticStore } from "@solid-primitives/static-store";
import type { StaticStoreSetter } from "@solid-primitives/static-store";
import { untracked } from "./utils.ts";

import "./utils.css";
import style from "./utils.css?inline";
export { style };

import SpectrumVisualizer from "./SpectrumVisualizer.tsx";
import type { SpectrumVisualizerPalette, SpectrumVisualizerState } from "./SpectrumVisualizer.tsx";
export { SpectrumVisualizer };
export type { SpectrumVisualizerPalette, SpectrumVisualizerState };

type SpectrumVisualizerElementProps = Omit<Parameters<typeof SpectrumVisualizer>[0], "width" | "height">;
export type SpectrumVisualizerStateChangedEvent = CustomEvent<SpectrumVisualizerState>;
export type SpectrumVisualizerStateSeekRequestEvent = CustomEvent<{ time: number }>;

export class SpectrumVisualizerElement extends HTMLElement {
    protected static observedAttributes = ["fft-power", "log-base", "palette"];

    #disposeRoot: (() => void) | undefined;
    #props: SpectrumVisualizerElementProps;
    #setProps: StaticStoreSetter<SpectrumVisualizerElementProps>;
    #shadow: ShadowRoot | undefined;

    @untracked
    get blob(): Blob | null {
        return this.#props.blob ?? null;
    }
    set blob(blob: Blob | null | undefined) {
        if (blob == null) {
            this.#setProps({ blob: void 0 });
        } else if (blob instanceof Blob) {
            this.#setProps({ blob });
        } else {
            throw new TypeError("Expected Blob");
        }
    }

    @untracked
    get fftPower(): number | null {
        return this.#props.fftPower ?? null;
    }
    set fftPower(fftPower: string | number | null | undefined) {
        if (fftPower == null) {
            this.#setProps({ fftPower: void 0 });
        } else {
            this.#setProps({ fftPower: Number(fftPower) });
        }
    }

    @untracked
    get logBase(): number | null {
        return this.#props.logBase ?? null;
    }
    set logBase(logBase: string | number | null | undefined) {
        if (logBase == null) {
            this.#setProps({ logBase: void 0 });
        } else {
            this.#setProps({ logBase: Number(logBase) });
        }
    }

    @untracked
    get palette(): string | null {
        return this.#props.palette ?? null;
    }
    set palette(palette: SpectrumVisualizerPalette | "" | null | undefined) {
        if (!palette) {
            this.#setProps({ palette: void 0 });
        } else {
            this.#setProps({ palette });
        }
    }

    @untracked
    get currentPlayingTime(): number | null {
        return this.#props.currentPlayingTime ?? null;
    }
    set currentPlayingTime(currentPlayingTime: string | number | null | undefined) {
        if (currentPlayingTime == null) {
            this.#setProps({ currentPlayingTime: void 0 });
        } else {
            this.#setProps({ currentPlayingTime: Number(currentPlayingTime) });
        }
    }

    protected constructor() {
        super();
        [this.#props, this.#setProps] = createRoot(() =>
            createStaticStore<SpectrumVisualizerElementProps>({
                blob: void 0,
                fftPower: void 0,
                logBase: void 0,
                palette: void 0,
                currentPlayingTime: void 0,
                onStateChanged: (state) =>
                    void this.dispatchEvent(
                        new CustomEvent<SpectrumVisualizerStateChangedEvent["detail"]>("statechanged", {
                            detail: state,
                        }),
                    ),
                onSeekRequest: (time) =>
                    void this.dispatchEvent(
                        new CustomEvent<SpectrumVisualizerStateSeekRequestEvent["detail"]>("seekrequest", {
                            detail: { time },
                        }),
                    ),
            }),
        );
    }

    protected connectedCallback(): void {
        if (!this.#shadow) {
            this.#shadow = this.attachShadow({ mode: "open" });
            const css = document.createElement("style");
            css.textContent = "@layer{:host{display:flex;width:640px;height:480px}}" + style;
            this.#shadow.append(css);
        }
        if (!this.#disposeRoot) {
            this.#disposeRoot = createRoot((dispose) => {
                this.#shadow!.append(SpectrumVisualizer(this.#props) as Element);
                return dispose;
            });
        }
    }

    protected disconnectedCallback(): void {
        void Promise.resolve().then(() => {
            if (!this.isConnected && this.#disposeRoot) {
                this.#shadow!.lastChild!.remove();
                this.#disposeRoot();
                this.#disposeRoot = void 0;
            }
        });
    }

    protected attributeChangedCallback(name: string, _: string, value: string): void {
        switch (name) {
            case "fft-power":
                this.fftPower = value;
                break;
            case "log-base":
                this.logBase = value;
                break;
            case "palette":
                // @ts-expect-error any string
                this.palette = value;
                break;
        }
    }
}
