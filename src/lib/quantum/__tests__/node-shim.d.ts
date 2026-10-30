// Minimal declarations so the round-trip test can shell out to Python without
// pulling @types/node into the app build.
declare module 'node:child_process' {
  export function execFileSync(
    file: string,
    args?: readonly string[],
    options?: { encoding?: 'utf8'; timeout?: number; stdio?: 'pipe' | 'inherit' | 'ignore' },
  ): string
}

declare module 'node:fs' {
  export function mkdtempSync(prefix: string): string
  export function writeFileSync(path: string, data: string): void
  export function rmSync(path: string, options?: { recursive?: boolean; force?: boolean }): void
}

declare module 'node:os' {
  export function tmpdir(): string
}

declare module 'node:path' {
  export function join(...parts: string[]): string
}
