import { readFile } from "node:fs/promises";
import type { Plugin, HtmlTagDescriptor } from "vite";

const dependencies = JSON.parse(await readFile("package.json", "utf8")).dependencies as Record<string, string>;

export default function esmShResolve(): Plugin {
    const usedPackages = new Map<string, Set<string>>();
    return {
        name: "esm-sh-resolve",
        enforce: "pre",
        apply: "build",
        resolveId(id: string) {
            const [packageName, subPath] = splitPackageName(id);
            if (Object.hasOwn(dependencies, packageName)) {
                usedPackages.set(packageName, (usedPackages.get(packageName) ?? new Set<string>()).add(subPath));
                return {
                    external: "absolute",
                    id,
                };
            }
        },
        transformIndexHtml() {
            const imports: Record<string, string> = {};
            const preloads: HtmlTagDescriptor[] = [];
            for (const [packageName, subPaths] of usedPackages.entries()) {
                const version = dependencies[packageName];
                const rootURL = `https://esm.sh/${packageName}@${version}`;
                imports[packageName] = rootURL;
                imports[packageName + "/"] = rootURL + "/";
                preloads.push(
                    ...subPaths.values().map((subPath) => ({
                        tag: "link",
                        attrs: {
                            rel: "modulepreload",
                            href: rootURL + subPath,
                        },
                    })),
                );
            }
            return [
                ...preloads,
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
