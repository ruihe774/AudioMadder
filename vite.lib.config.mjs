import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import tailwindcss from "@tailwindcss/vite";
import { viteStaticCopy } from "vite-plugin-static-copy";

export default defineConfig({
    plugins: [
        solid({
            solid: {
                wrapConditionals: false,
            },
        }),
        tailwindcss(),
        viteStaticCopy({
            targets: [
                {
                    src: "src/lib.d.ts",
                    dest: ".",
                    rename: "audio-madder.d.ts"
                },
            ],
        }),
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
