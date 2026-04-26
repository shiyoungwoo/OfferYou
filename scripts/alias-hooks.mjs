import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const resolvedPath = resolveRepositoryAlias(specifier.slice(2));
    if (resolvedPath) {
      return {
        url: pathToFileURL(resolvedPath).href,
        shortCircuit: true
      };
    }
  }

  return nextResolve(specifier, context);
}

function resolveRepositoryAlias(relativePath) {
  const candidates = [
    relativePath,
    `${relativePath}.ts`,
    `${relativePath}.tsx`,
    `${relativePath}.js`,
    `${relativePath}.mjs`,
    `${relativePath}.cjs`,
    path.join(relativePath, "index.ts"),
    path.join(relativePath, "index.tsx"),
    path.join(relativePath, "index.js")
  ];

  for (const candidate of candidates) {
    const absolutePath = path.join(repoRoot, candidate);
    if (existsSync(absolutePath)) {
      return absolutePath;
    }
  }

  return null;
}
