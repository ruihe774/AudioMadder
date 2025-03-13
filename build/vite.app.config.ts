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
        esmShResolve(),
        htmlHeadTrim(),
    ],
    build: {
        target: ["chrome104", "firefox108", "safari16.4"],
        modulePreload: false,
    },
});
