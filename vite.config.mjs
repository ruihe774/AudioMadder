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
        target: ["chrome104", "firefox78", "safari14.1"],
        modulePreload: false,
    },
});
