interface ImportMeta {
  main?: boolean;
}

declare namespace NodeJS {
  interface Process {
    cwd(): string;
    exit(code?: number): never;
    argv: string[];
    env: Record<string, string | undefined>;
  }
}

declare const process: NodeJS.Process;

declare module "node:fs/promises" {
  export interface Dirent {
    name: string;
    isFile(): boolean;
    isDirectory(): boolean;
  }

  export interface FileStat {
    isFile(): boolean;
    isDirectory(): boolean;
  }

  export function readdir(
    path: string,
    options: { withFileTypes: true },
  ): Promise<Dirent[]>;
  export function readdir(path: string): Promise<string[]>;
  export function readFile(
    path: string,
    encoding: "utf-8" | string,
  ): Promise<string>;
  export function writeFile(
    path: string,
    data: string,
    encoding?: "utf-8" | string,
  ): Promise<void>;
  export function access(path: string): Promise<void>;
  export function stat(path: string): Promise<FileStat>;
  export function rm(
    path: string,
    options?: { recursive?: boolean; force?: boolean },
  ): Promise<void>;
  export function mkdir(
    path: string,
    options?: { recursive?: boolean },
  ): Promise<string | undefined>;
}

declare module "node:path" {
  export function resolve(...paths: string[]): string;
  export function join(...paths: string[]): string;
  export function basename(path: string, ext?: string): string;
  export function dirname(path: string): string;
  export function extname(path: string): string;
  export function relative(from: string, to: string): string;
}

declare module "node:child_process" {
  export interface SpawnSyncReturns {
    status: number | null;
    stdout: any;
    stderr: any;
  }
  export function spawnSync(
    command: string,
    args?: string[],
    options?: Record<string, any>,
  ): SpawnSyncReturns;
}
