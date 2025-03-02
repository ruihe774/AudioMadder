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

export function extract<T, K extends keyof T>(o: T | (() => T | undefined), n: K): () => T[K] | undefined {
    return typeof o == "function" ? () => (o as () => T | undefined)()?.[n] : () => o[n];
}

export function clamp(x: number, low: number, high: number): number {
    return low < high ? (x < low ? low : x > high ? high : x) : low;
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

    function safeRead(): T | undefined {
        if (read.state != "errored") {
            return read();
        }
    }

    Object.defineProperties(safeRead, {
        state: {
            get: () => read.state,
        },
        error: {
            get: () => read.error,
        },
        loading: {
            get: () => read.loading,
        },
        latest: {
            get: () => read.latest,
        },
    });

    return [safeRead as SafeResource<T>, action];
}
