import type { Accessor } from "solid-js";
import { createMemo, createEffect, untrack, createSignal, onCleanup, batch, onMount } from "solid-js";
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
    const [state, setState] = createSignal<AsyncSignal<R>["state"]>("unresolved");
    const [loading, setLoading] = createSignal<AsyncSignal<R>["loading"]>(false);
    const [error, setError] = createSignal<AsyncSignal<R>["error"]>(void 0);
    const [latest, setLatest] = createSignal<AsyncSignal<R>["latest"]>(void 0);
    let currentPromise: Promise<void> | undefined;
    createEffect(() => {
        abort();
        const promise = getPromise();
        if (promise === void 0) {
            batch(() => {
                setState("unresolved");
                setLoading(false);
                setError(void 0);
                setLatest(void 0);
            });
            currentPromise = void 0;
        } else {
            batch(() => {
                setState((prevState) => (prevState == "ready" || prevState == "refreshing" ? "refreshing" : "pending"));
                setLoading(true);
                setError(void 0);
            });
            const thisPromise = (currentPromise = promise.then(
                (value) => {
                    if (currentPromise === thisPromise)
                        batch(() => {
                            setState("ready");
                            setLoading(false);
                            setError(void 0);
                            setLatest(() => value);
                        });
                },
                (error) => {
                    if (currentPromise === thisPromise)
                        batch(() => {
                            setState("errored");
                            setLoading(false);
                            setError(() => error);
                            setLatest(void 0);
                        });
                },
            ));
        }
    });

    const read = (): R | undefined => latest();
    Object.defineProperties(read, {
        state: {
            get: state,
        },
        error: {
            get: error,
        },
        loading: {
            get: loading,
        },
        latest: {
            get: latest,
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

export function createHook(fn: (abort: AbortSignal) => void): void {
    let abortController!: AbortController;
    onMount(() => fn((abortController = new AbortController()).signal));
    onCleanup(() => abortController.abort());
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

export function untracked<T, A extends any[], R>(target: (this: T, ...args: A) => R): (this: T, ...args: A) => R {
    return function (this: T, ...args: A): R {
        return untrack(() => target.apply(this, args));
    };
}

export function cl(strings: TemplateStringsArray, ...switches: any[]): string {
    let s = strings[0];
    switches.forEach((pred, i) => {
        const a = strings[i + 1];
        if (pred) {
            s += a.slice(1);
        } else {
            const l = a.indexOf(" ", 1);
            if (l != -1) {
                s += a.slice(l + 1);
            }
        }
    });
    return s;
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
