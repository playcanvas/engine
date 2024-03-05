import { version, revision } from './rollup-version-revision.mjs';

/**
 * Build the banner with build date and revision. Revision only works for git repo, not zip.
 *
 * @param {string} config - A string like `(DEBUG PROFILER)` or even an empty string.
 * @returns {string} - The banner.
 */
function getBanner(config) {
    return `/**
 * @license
 * PlayCanvas Engine v${version} revision ${revision}${config}
 * Copyright 2011-${new Date().getFullYear()} PlayCanvas Ltd. All rights reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */`;
}

export { getBanner };
