import { Debug } from '../../core/debug.js';
import { CsdldfScanKernel } from './csdldf-scan-kernel.js';
import { PrefixSumKernel } from './prefix-sum-kernel.js';

/**
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 */

/**
 * Returns the preferred prefix scan kernel for the given device. Both kernels
 * expose the same `resize(buffer, count)` / `dispatch(device)` / `destroy()`
 * contract, so callers do not need to care which was chosen.
 *
 * - When `force` is `'csdldf'` or (for `'auto'`) `device.supportsSubgroups` is
 *   true, returns a {@link CsdldfScanKernel} - a single-pass scan using
 *   chained lookback with decoupled fallback.
 * - Otherwise returns a {@link PrefixSumKernel} - a classic hierarchical
 *   Blelloch scan.
 *
 * @param {GraphicsDevice} device - The graphics device.
 * @param {object} [options] - Options.
 * @param {boolean} [options.exclusive] - When true (default), produce an
 * exclusive scan. PrefixSumKernel only produces exclusive scans; the flag is
 * only honoured by CsdldfScanKernel.
 * @param {'auto' | 'csdldf' | 'blelloch'} [options.force] - Force a specific
 * kernel. `'auto'` (default) picks CSDLDF when subgroups are available and
 * Blelloch otherwise. `'csdldf'` requires `device.supportsSubgroups`.
 * @returns {CsdldfScanKernel | PrefixSumKernel} The selected scan kernel.
 * @ignore
 */
function createScanKernel(device, { exclusive = true, force = 'auto' } = {}) {
    const useCsdldf = force === 'csdldf' ||
        (force === 'auto' && device.supportsSubgroups);
    if (useCsdldf) {
        Debug.assert(device.supportsSubgroups,
            'CsdldfScanKernel forced, but device.supportsSubgroups is false');
        return new CsdldfScanKernel(device, { exclusive });
    }
    return new PrefixSumKernel(device);
}

/**
 * Returns a short name identifying which scan kernel `createScanKernel` would
 * return for the given device and `force` option. Useful for logging / debug
 * overlays.
 *
 * @param {GraphicsDevice} device - The graphics device.
 * @param {'auto' | 'csdldf' | 'blelloch'} [force] - The forced kernel choice
 * (matches the `force` option of {@link createScanKernel}). Defaults to
 * `'auto'`.
 * @returns {'csdldf' | 'blelloch'} Scan kernel name.
 * @ignore
 */
function getScanKernelName(device, force = 'auto') {
    if (force === 'csdldf') return 'csdldf';
    if (force === 'blelloch') return 'blelloch';
    return device.supportsSubgroups ? 'csdldf' : 'blelloch';
}

export { createScanKernel, getScanKernelName };
