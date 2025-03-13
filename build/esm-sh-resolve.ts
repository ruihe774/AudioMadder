import { readFile } from "node:fs/promises";
import type { Plugin } from "vite";

const dependencies = JSON.parse(await readFile("package.json", "utf8")).dependencies as Record<string, string>;

export default function esmShResolve(): Plugin {
    const usedPackages = new Set<string>();
    return {
        name: "esm-sh-resolve",
        enforce: "pre",
        apply: "build",
        resolveId(id: string) {
            const [packageName] = splitPackageName(id);
            if (Object.hasOwn(dependencies, packageName)) {
                usedPackages.add(packageName);
                return {
                    external: "absolute",
                    id,
                };
            }
        },
        transformIndexHtml() {
            const imports: Record<string, string> = {};
            for (const packageName of usedPackages) {
                const version = dependencies[packageName];
                imports[packageName] = `https://esm.sh/${packageName}@${version}`;
                imports[packageName + "/"] = `https://esm.sh/${packageName}@${version}/`;
            }
            return [
                {
                    tag: "script",
                    attrs: { type: "importmap" },
                    children: JSON.stringify({
                        imports,
                    }),
                },
            ];
        },
    };
}

function splitPackageName(id: string): [packageName: string, subPath: string] {
    if (id.startsWith("@")) {
        const slashIndex = id.indexOf("/");
        if (slashIndex != -1) {
            const splitterIndex = id.indexOf("/", slashIndex + 1);
            if (splitterIndex != -1) {
                return [id.slice(0, splitterIndex), id.slice(splitterIndex)];
            } else {
                return [id, ""];
            }
        }
    }
    const splitterIndex = id.indexOf("/");
    if (splitterIndex != -1) {
        return [id.slice(0, splitterIndex), id.slice(splitterIndex)];
    } else {
        return [id, ""];
    }
}
