import type { Plugin } from "vite";
import { RewritingStream } from "parse5-html-rewriting-stream";
import { Readable } from "node:stream";
import { text } from "node:stream/consumers";

export default function htmlHeadTrim(): Plugin {
    return {
        name: "html-head-trim",
        enforce: "post",
        apply: "build",
        transformIndexHtml(html: string) {
            const rewritter = new RewritingStream();
            let isInBody = false;
            rewritter.on("startTag", (startTag) => {
                if (startTag.tagName == "body") isInBody = true;
                rewritter.emitStartTag(startTag);
            });
            rewritter.on("endTag", (endTag) => {
                if (endTag.tagName == "body") isInBody = false;
                rewritter.emitEndTag(endTag);
            });
            rewritter.on("text", (text) => {
                if (isInBody || text.text.trim()) {
                    rewritter.emitText(text);
                }
            });
            return text(Readable.from([html]).pipe(rewritter));
        },
    };
}
