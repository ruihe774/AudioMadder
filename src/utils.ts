import type { Accessor } from "solid-js";
import { createMemo, createEffect, untrack, createSignal, onCleanup } from "solid-js";
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
export type AsyncSignal<T> = Unresolved | Pending | Ready<T> | Refreshing<T> | Errored;

export function createAsync<T extends any[], R>(
    deps: { readonly [K in keyof T]: Accessor<T[K] | undefined> },
    fn: (abort: AbortSignal, ...args: T) => Promise<R>,
): [AsyncSignal<R>, AbortController["abort"]] {
    let abortController: AbortController | undefined;
    const abort = (reason?: any): void => abortController?.abort(reason);
    onCleanup(abort);
    const getPromise = createHelper(deps, (...args) => fn((abortController = new AbortController()).signal, ...args));
    type AsyncStore = Omit<AsyncSignal<R>, "()">;
    const unresolvedValue: AsyncStore = {
        state: "unresolved",
        loading: false,
        error: void 0,
        latest: void 0,
    };
    const [asyncSignal, setAsyncSignal] = createSignal<AsyncStore>(unresolvedValue);
    let currentPromise: Promise<void> | undefined;
    createEffect(() => {
        abort();
        const promise = getPromise();
        if (promise === void 0) {
            setAsyncSignal(unresolvedValue);
            currentPromise = void 0;
        } else {
            const lastState = untrack(asyncSignal);
            setAsyncSignal(
                lastState.state == "ready" || lastState.state == "refreshing"
                    ? {
                          state: "refreshing",
                          loading: true,
                          error: void 0,
                          latest: lastState.latest,
                      }
                    : {
                          state: "pending",
                          loading: true,
                          error: void 0,
                          latest: void 0,
                      },
            );
            const thisPromise = (currentPromise = promise.then(
                (value) => {
                    if (currentPromise === thisPromise)
                        setAsyncSignal({
                            state: "ready",
                            loading: false,
                            error: void 0,
                            latest: value,
                        });
                },
                (error) => {
                    if (currentPromise === thisPromise)
                        setAsyncSignal({
                            state: "errored",
                            loading: false,
                            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                            error,
                            latest: void 0,
                        });
                },
            ));
        }
    });

    const read = createMemo(() => asyncSignal().latest);
    Object.defineProperties(read, {
        state: {
            get: createMemo(() => asyncSignal().state),
        },
        error: {
            get: createMemo(() => asyncSignal().error),
        },
        loading: {
            get: createMemo(() => asyncSignal().loading),
        },
        latest: {
            get: read,
        },
    });
    return [read as AsyncSignal<R>, abort];
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
