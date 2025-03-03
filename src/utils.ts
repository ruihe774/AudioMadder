import type { Accessor, ResourceActions, ResourceFetcher, ResourceOptions } from "solid-js";
import { createMemo, createEffect, createResource, untrack, createSignal } from "solid-js";
import { throttle } from "@solid-primitives/scheduled";

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

export type SafeResourceSource<S> = S | (() => S | undefined);
export type SafeResource<T> = Unresolved | Pending | Ready<T> | Refreshing<T> | Errored;
export type SafeResourceReturn<T, R = unknown> = [SafeResource<T>, ResourceActions<T | undefined, R>];

export function createSafeResource<T, S, R = unknown>(
    source: SafeResourceSource<S>,
    fetcher: ResourceFetcher<S, T, R>,
    options?: ResourceOptions<NoInfer<T>, S>,
): SafeResourceReturn<T, R> {
    const [read, action] = createResource(source, fetcher, options);

    const isSourceVoid = (): boolean =>
        source === void 0 || (typeof source == "function" && (source as () => S | undefined)() === void 0);

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

export function createThrottled<T>(source: Accessor<T | undefined>, timeout: number): Accessor<T | undefined> {
    const [throttled, setThrottled] = createSignal(untrack(source));
    const updateThrottled = throttle((newValue: T | undefined) => void setThrottled(() => newValue), timeout);
    createEffect(() => {
        const newValue = source();
        if (newValue === void 0) {
            updateThrottled.clear();
            setThrottled(void 0);
        } else {
            updateThrottled(newValue);
        }
    });
    return throttled;
}

export function extractProps<P, D extends { [K in keyof D]: K extends keyof P ? Exclude<P[K], undefined> : never }>(
    props: P,
    defaults?: D,
): {
    readonly [K in keyof P]-?: K extends keyof D ? () => Exclude<P[K], undefined> : () => P[K];
} {
    // @ts-expect-error proxy
    return new Proxy(
        {},
        {
            get: (_, name) => () => {
                // @ts-expect-error any
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                const prop = props[name];
                if (prop === void 0) {
                    // @ts-expect-error any
                    return defaults?.[name];
                }
                return prop;
            },
        },
    );
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
