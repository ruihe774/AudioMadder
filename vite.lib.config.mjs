import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import tailwindcss from "@tailwindcss/vite";
import dts from "vite-plugin-dts";

export default defineConfig({
    plugins: [
        solid({
            solid: {
                wrapConditionals: false,
            },
        }),
        tailwindcss(),
        dts({
            rollupTypes: true,
        }),
    ],
    build: {
        target: "esnext",
        lib: {
            entry: "src/lib.ts",
            name: "AudioMadder",
            formats: ["es", "cjs"],
        },
        outDir: "lib",
        rollupOptions: {
            external: [/^solid-js/],
            treeshake: "recommended",
        },
        minify: false,
    },
});
