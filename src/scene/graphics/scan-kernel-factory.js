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
 * - When `force` is `'csdldf'`, returns a {@link CsdldfScanKernel} - a
 *   single-pass scan using chained lookback with decoupled fallback. Requires
 *   `device.supportsSubgroups`.
 * - Otherwise (including `'auto'`) returns a {@link PrefixSumKernel} - a
 *   classic hierarchical Blelloch scan.
 *
 * The `'auto'` default is currently Blelloch everywhere. CSDLDF is retained
 * as an opt-in (used by the example / benchmarks) while we investigate a
 * correctness issue that appears on NVIDIA when the scan is driven with many
 * partitions (~140+), as happens for 8-bit radix block sums on multi-million
 * element inputs. The cost of this default is small in the radix-sort use
 * case because the scan is far off the critical path (~0.1 ms out of ~10 ms
 * total on RTX 2070).
 *
 * @param {GraphicsDevice} device - The graphics device.
 * @param {object} [options] - Options.
 * @param {boolean} [options.exclusive] - When true (default), produce an
 * exclusive scan. PrefixSumKernel only produces exclusive scans; the flag is
 * only honoured by CsdldfScanKernel.
 * @param {'auto' | 'csdldf' | 'blelloch'} [options.force] - Force a specific
 * kernel. `'auto'` (default) picks Blelloch. `'csdldf'` requires
 * `device.supportsSubgroups`.
 * @returns {CsdldfScanKernel | PrefixSumKernel} The selected scan kernel.
 * @ignore
 */
function createScanKernel(device, { exclusive = true, force = 'auto' } = {}) {
    if (force === 'csdldf') {
        Debug.assert(device.supportsSubgroups,
            'CsdldfScanKernel forced, but device.supportsSubgroups is false');
        return new CsdldfScanKernel(device, { exclusive });
    }
    return new PrefixSumKernel(device);
}

/**
 * Returns a short name identifying which scan kernel `createScanKernel` would
 * return for the given device and `force` option. Useful for logging / debug
 * overlays. `'auto'` maps to `'blelloch'` (see {@link createScanKernel} for
 * the rationale).
 *
 * @param {GraphicsDevice} device - The graphics device.
 * @param {'auto' | 'csdldf' | 'blelloch'} [force] - The forced kernel choice
 * (matches the `force` option of {@link createScanKernel}). Defaults to
 * `'auto'`.
 * @returns {'csdldf' | 'blelloch'} Scan kernel name.
 * @ignore
 */
function getScanKernelName(device, force = 'auto') {
    return force === 'csdldf' ? 'csdldf' : 'blelloch';
}

export { createScanKernel, getScanKernelName };
