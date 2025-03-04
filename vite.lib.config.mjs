import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
    plugins: [
        solid({
            solid: {
                wrapConditionals: false,
            },
        }),
        tailwindcss(),
    ],
    build: {
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
