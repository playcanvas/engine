/**
 * Rollup configuration — retained for types build only.
 * JS builds are now handled by esbuild via build.mjs.
 *
 * This config is used by the examples build which imports buildJSOptions/buildTypesOption
 * from utils/rollup-build-target.mjs.
 */
import { buildTypesOption } from './utils/rollup-build-target.mjs';

export default [buildTypesOption()];
