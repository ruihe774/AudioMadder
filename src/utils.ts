import type { Accessor } from "solid-js";
import { createMemo, createEffect } from "solid-js";

function createHelper<T extends any[], R>(
    deps: { readonly [K in keyof T]: Accessor<T[K] | undefined> },
    fn: (...args: T) => R,
): () => R | undefined {
    return () => {
        const args = deps.map((dep) => dep());
        if (args.includes(void 0)) return;
        return fn(...(args as T));
    };
}

export function createDerived<T extends any[], R>(
    deps: { readonly [K in keyof T]: Accessor<T[K] | undefined> },
    fn: (...args: T) => R,
): Accessor<R | undefined> {
    return createMemo(createHelper(deps, fn));
}

export function createTrigger<T extends any[]>(
    deps: { readonly [K in keyof T]: Accessor<T[K] | undefined> },
    fn: (...args: T) => void,
): void {
    return createEffect(createHelper(deps, fn));
}

export function extract<T, K extends keyof T>(o: T | (() => T | undefined), n: K): () => T[K] | undefined {
    return typeof o == "function" ? () => (o as () => T | undefined)()?.[n] : () => o[n];
}

export function clamp(x: number, low: number, high: number): number {
    return x < low ? low : x > high ? high : x;
}
