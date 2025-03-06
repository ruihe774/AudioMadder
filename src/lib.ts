import { createRoot, getOwner, runWithOwner } from "solid-js";
import type { Owner } from "solid-js";
import { createStaticStore } from "@solid-primitives/static-store";
import type { StaticStoreSetter } from "@solid-primitives/static-store";
import { untracked } from "./utils.ts";

import "./utils.css";
import style from "./utils.css?inline";
export { style };

import SpectrumVisualizer from "./SpectrumVisualizer.tsx";
import type { SpectrumVisualizerPalette, SpectrumVisualizerState } from "./SpectrumVisualizer.tsx";
export { SpectrumVisualizer };

type SpectrumVisualizerElementProps = Omit<Parameters<typeof SpectrumVisualizer>[0], "width" | "height">;

export class SpectrumVisualizerElement extends HTMLElement {
    static observedAttributes = ["fft-power", "log-base", "palette"];

    #owner: Owner;
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

    @untracked
    get onStateChanged(): ((state: SpectrumVisualizerState) => void) | null {
        return this.#props.onStateChanged ?? null;
    }
    set onStateChanged(onStateChanged: ((state: SpectrumVisualizerState) => void) | null | undefined) {
        if (onStateChanged == null) {
            this.#setProps({ onStateChanged: void 0 });
        } else if (typeof onStateChanged == "function") {
            this.#setProps({ onStateChanged });
        } else {
            throw new TypeError("Expected function");
        }
    }

    @untracked
    get onSeekRequest(): ((time: number) => void) | null {
        return this.#props.onSeekRequest ?? null;
    }
    set onSeekRequest(onSeekRequest: ((time: number) => void) | null | undefined) {
        if (onSeekRequest == null) {
            this.#setProps({ onSeekRequest: void 0 });
        } else if (typeof onSeekRequest == "function") {
            this.#setProps({ onSeekRequest });
        } else {
            throw new TypeError("Expected function");
        }
    }

    constructor() {
        super();
        [this.#owner, this.#props, this.#setProps] = createRoot(() => [
            getOwner()!,
            ...createStaticStore<SpectrumVisualizerElementProps>({
                blob: void 0,
                fftPower: void 0,
                logBase: void 0,
                palette: void 0,
                currentPlayingTime: void 0,
                onStateChanged: void 0,
                onSeekRequest: void 0,
            }),
        ]);
    }

    connectedCallback(): void {
        if (this.#shadow) return;
        const shadow = (this.#shadow = this.attachShadow({ mode: "open" }));
        const css = document.createElement("style");
        css.textContent = "@layer{:host{display:flex;width:640px;height:480px}}" + style;
        shadow.append(runWithOwner(this.#owner, () => SpectrumVisualizer(this.#props)) as Element, css);
    }

    attributeChangedCallback(name: string, _: string, value: string): void {
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
