import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import tailwindcss from "@tailwindcss/vite";
import esmShResolve from "./esm-sh-resolve";
import htmlHeadTrim from "./html-head-trim";

export default defineConfig({
    plugins: [
        solid({
            solid: {
                wrapConditionals: false,
            },
        }),
        tailwindcss(),
        htmlHeadTrim(),
    ],
    build: {
        target: ["chrome104", "firefox78", "safari14.1"],
        modulePreload: false,
    },
});
