import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA as pwa } from "vite-plugin-pwa";
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
        pwa({
            manifest: {
                name: "Audio Madder",
                short_name: "Audio Madder",
                icons: [
                    {
                        src: "/pwa-192x192.png",
                        sizes: "192x192",
                        type: "image/png",
                        purpose: "any",
                    },
                    {
                        src: "/pwa-512x512.png",
                        sizes: "512x512",
                        type: "image/png",
                        purpose: "any",
                    },
                    {
                        src: "/pwa-maskable-192x192.png",
                        sizes: "192x192",
                        type: "image/png",
                        purpose: "maskable",
                    },
                    {
                        src: "/pwa-maskable-512x512.png",
                        sizes: "512x512",
                        type: "image/png",
                        purpose: "maskable",
                    },
                ],
                start_url: "/",
                display: "standalone",
                background_color: "#171717",
                theme_color: "#171717",
                description: "Spectrum visualizer using Web Audio API",
            },
            workbox: {
                globPatterns: ["**/*.{js,css,html,ico,png,svg}"],
            },
        }),
    ],
    build: {
        target: ["chrome104", "firefox78", "safari14.1"],
        modulePreload: false,
    },
});
