import type { Accessor, ResourceActions, ResourceFetcher, ResourceOptions, ResourceSource } from "solid-js";
import { createMemo, createEffect, createResource } from "solid-js";

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

interface Unresolved {
    state: "unresolved";
    loading: false;
    error: undefined;
    latest: undefined;
    (): undefined;
}
interface Pending {
    state: "pending";
    loading: true;
    error: undefined;
    latest: undefined;
    (): undefined;
}
interface Ready<T> {
    state: "ready";
    loading: false;
    error: undefined;
    latest: T;
    (): T;
}
interface Refreshing<T> {
    state: "refreshing";
    loading: true;
    error: undefined;
    latest: T;
    (): T;
}
interface Errored {
    state: "errored";
    loading: false;
    error: any;
    latest: never;
    (): undefined;
}

export type SafeResource<T> = Unresolved | Pending | Ready<T> | Refreshing<T> | Errored;
export type SafeResourceReturn<T, R = unknown> = [SafeResource<T>, ResourceActions<T | undefined, R>];

export function createSafeResource<T, S, R = unknown>(
    source: ResourceSource<S>,
    fetcher: ResourceFetcher<S, T, R>,
    options?: ResourceOptions<NoInfer<T>, S>,
): SafeResourceReturn<T, R> {
    const [read, action] = createResource(source, fetcher, options);

    const isSourceVoid = (): boolean =>
        source == void 0 || (typeof source == "function" && (source as () => false | S | null | undefined)() == void 0);

    const safeRead = createMemo((): T | undefined => (!isSourceVoid() && read.state != "errored" ? read() : void 0));

    Object.defineProperties(safeRead, {
        state: {
            get: () => (isSourceVoid() ? "unresolved" : read.state),
        },
        error: {
            get: () => (isSourceVoid() ? void 0 : read.error),
        },
        loading: {
            get: () => !isSourceVoid() && read.loading,
        },
        latest: {
            get: () => (isSourceVoid() ? void 0 : read.latest),
        },
    });

    return [safeRead as SafeResource<T>, action];
}

export function clamp(x: number, low: number, high: number): number {
    return low < high ? (x < low ? low : x > high ? high : x) : low;
}

export function nextPowerOfTwo(x: number): number {
    x = x | 0;
    if (x <= 1) return 1;
    --x;
    x |= x >> 1;
    x |= x >> 2;
    x |= x >> 4;
    x |= x >> 8;
    x |= x >> 16;
    ++x;
    return x;
}
