export interface LintOptions {
  fix?: boolean;
  watch?: boolean;
  files?: string[];
}

export interface FormatOptions {
  write?: boolean;
  check?: boolean;
  files?: string[];
}

export interface SetupOptions {
  projectType: 'node' | 'react' | 'sst';
  force?: boolean;
  skipDeps?: boolean;
}

export interface ProjectConfig {
  name: string;
  type: 'node' | 'react' | 'sst';
  eslint: boolean;
  prettier: boolean;
  vitest: boolean;
}

export interface PackageJson {
  name: string;
  type: 'node' | 'react' | 'sst';
  prettier?: string;
  scripts?: Record<string, string>;
  devDependencies?: Record<string, string>;
  dependencies?: Record<string, string>;
}
