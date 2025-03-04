import type { Component } from "solid-js";
export declare const SpectrumVisualizer: Component<{
    blob?: Blob;
    fftPower?: number;
    logBase?: number;
    palette?: SpectrumVisualizerPalette;
    currentPlayingTime?: number;
    onStateChanged?: (state: SpectrumVisualizerState) => void;
    onSeekRequest?: (time: number) => void;
    width?: string | number;
    height?: string | number;
}>;
type SpectrumVisualizerState = {
    type: "inited";
} | {
    type: "decoding";
} | {
    type: "analysing";
    progress: number;
} | {
    type: "finished";
    duration: number;
} | {
    type: "errored";
    error: Error;
};
type SpectrumVisualizerPalette = "spectrum" | "sox" | "mono";
declare const defaultFFTPower = 12;
declare const defaultLogBase = 1;
declare const defaultPalette = "sox";
