import { register } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
register(path.join(currentDir, "alias-hooks.mjs"), import.meta.url);
