/* @refresh reload */
import { registerSW } from "virtual:pwa-register";
import { render } from "solid-js/web";
import App from "./App.tsx";
import "./index.css";

render(App, document.getElementById("root")!);

registerSW({
    onRegisteredSW(swUrl, r) {
        if (r) {
            setTimeout(() => {
                if (r.installing || !navigator) return;

                if ("connection" in navigator && !navigator.onLine) return;

                void fetch(swUrl, {
                    cache: "no-store",
                    headers: {
                        "cache": "no-store",
                        "cache-control": "no-cache",
                    },
                }).then((resp) => {
                    if (resp?.status == 200) return r.update();
                });
            }, 1000);
        }
    },
});
