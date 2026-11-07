import { configDefaults, defineConfig } from 'vitest/config';
export default defineConfig({ test: { exclude: [...configDefaults.exclude, 'tests/browser.spec.ts', 'tests/*.browser.spec.ts'] } });
