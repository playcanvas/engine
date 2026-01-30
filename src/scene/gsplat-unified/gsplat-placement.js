import { Debug } from '../../core/debug.js';
import { GSplatStreams } from '../gsplat/gsplat-streams.js';
import { WORKBUFFER_UPDATE_AUTO, WORKBUFFER_UPDATE_ALWAYS, WORKBUFFER_UPDATE_ONCE } from '../constants.js';

/**
 * @import { BoundingBox } from '../../core/shape/bounding-box.js'
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 * @import { GraphNode } from '../graph-node.js'
 * @import { GSplatResource } from '../gsplat/gsplat-resource.js'
 * @import { GSplatResourceBase } from '../gsplat/gsplat-resource-base.js'
 * @import { GSplatOctreeResource } from './gsplat-octree.resource.js'
 * @import { ScopeId } from '../../platform/graphics/scope-id.js'
 * @import { Texture } from '../../platform/graphics/texture.js'
 * @import { Vec2 } from '../../core/math/vec2.js'
 */

/**
 * Class representing a placement of a gsplat resource.
 *
 * @ignore
 */
class GSplatPlacement {
    /**
     * The resource of the splat..
     *
     * @type {GSplatResource|GSplatOctreeResource|null}
     */
    resource;

    /**
     * The node that the gsplat is linked to.
     *
     * @type {GraphNode}
     */
    node;

    /**
     * Map of intervals for octree nodes using this placement.
     * Key is octree node index, value is Vec2 representing start and end index (inclusive).
     *
     * @type {Map<number, Vec2>}
     */
    intervals = new Map();

    /**
     * Unique identifier for this placement. Used by the picking system and available
     * for custom shader effects.
     *
     * @type {number}
     */
    id = 0;

    /**
     * The LOD index for this placement.
     *
     * @type {number}
     */
    lodIndex = 0;

    /**
     * LOD distance thresholds for octree-based gsplat. Only used when the
     * resource is an octree resource; otherwise ignored and kept null.
     *
     * @type {number[]|null}
     */
    _lodDistances = null;

    /**
     * Target number of splats to render for this placement. Set to 0 to disable (default).
     *
     * @type {number}
     */
    splatBudget = 0;

    /**
     * The axis-aligned bounding box for this placement, in local space.
     * Null means use resource.aabb as fallback.
     *
     * @type {BoundingBox|null}
     */
    _aabb = null;

    /**
     * Per-instance shader parameters. Reference to the component's parameters Map.
     *
     * @type {Map<string, {scopeId: ScopeId, data: *}>|null}
     */
    parameters = null;

    /**
     * Optional streams for instance-level textures.
     *
     * @type {GSplatStreams|null}
     * @private
     */
    _streams = null;

    /**
     * Flag indicating the splat needs to be re-rendered to work buffer.
     *
     * @type {boolean}
     */
    renderDirty = false;

    /**
     * Work buffer update mode.
     *
     * @type {number}
     */
    workBufferUpdate = WORKBUFFER_UPDATE_AUTO;

    /**
     * Last seen format version for auto-detecting format changes.
     *
     * @type {number}
     * @private
     */
    _lastFormatVersion = -1;

    /**
     * Custom work buffer modifier code for this placement (object with code and pre-computed hash).
     *
     * @type {{ code: string, hash: number }|null}
     * @private
     */
    _workBufferModifier = null;

    /**
     * Parent placement
     * Used by octree file placements to inherit workBufferModifier and parameters from
     * the component's placement.
     *
     * @type {GSplatPlacement|null}
     * @private
     */
    _parentPlacement = null;

    /**
     * Create a new GSplatPlacement.
     *
     * @param {GSplatResource|null} resource - The resource of the splat.
     * @param {GraphNode} node - The node that the gsplat is linked to.
     * @param {number} [lodIndex] - The LOD index for this placement.
     * @param {Map<string, {scopeId: ScopeId, data: *}>|null} [parameters] - Per-instance shader parameters.
     * @param {GSplatPlacement|null} [parentPlacement] - Parent placement for shader config delegation.
     * @param {number|null} [id] - Unique identifier for picking. If not provided, inherits from parentPlacement.
     */
    constructor(resource, node, lodIndex = 0, parameters = null, parentPlacement = null, id = null) {
        this.id = id ?? parentPlacement?.id ?? 0;
        this.resource = resource;
        this.node = node;
        this.lodIndex = lodIndex;
        this.parameters = parameters ?? parentPlacement?.parameters ?? null;
        this._parentPlacement = parentPlacement;
    }

    /**
     * Destroys this placement and releases all resources.
     */
    destroy() {
        this._streams?.destroy();
        this._streams = null;
        this.intervals.clear();
        this.resource = null;
    }

    /**
     * Sets the work buffer modifier for this placement. Triggers work buffer re-render.
     * Must provide all three functions: modifySplatCenter, modifySplatRotationScale, modifySplatColor.
     *
     * @type {{ code: string, hash: number }|null}
     */
    set workBufferModifier(value) {
        this._workBufferModifier = value;
        this.renderDirty = true;
    }

    /**
     * Gets the work buffer modifier for this placement.
     * Delegates to parent placement if available (for octree file placements).
     *
     * @type {{ code: string, hash: number }|null}
     */
    get workBufferModifier() {
        return this._parentPlacement?.workBufferModifier ?? this._workBufferModifier;
    }

    /**
     * Returns and clears the render dirty flag. Also checks for format version changes
     * and handles render mode.
     *
     * @returns {boolean} True if the splat needed re-rendering.
     */
    consumeRenderDirty() {
        // Auto-detect format version changes
        // Cast to access format property (GSplatOctreeResource doesn't have format)
        const format = /** @type {GSplatResourceBase} */ (this.resource)?.format;
        if (format && this._lastFormatVersion !== format.extraStreamsVersion) {
            this._lastFormatVersion = format.extraStreamsVersion;
            this.renderDirty = true;
        }

        // Handle work buffer update mode
        if (this.workBufferUpdate === WORKBUFFER_UPDATE_ALWAYS) {
            this.renderDirty = true;
        } else if (this.workBufferUpdate === WORKBUFFER_UPDATE_ONCE) {
            this.renderDirty = true;
            this.workBufferUpdate = WORKBUFFER_UPDATE_AUTO;  // Auto-reset
        }

        const dirty = this.renderDirty;
        this.renderDirty = false;
        return dirty;
    }

    /**
     * Sets a custom AABB for this placement. Pass null to use resource.aabb as fallback.
     *
     * @param {BoundingBox|null} aabb - The bounding box to set, or null to clear.
     */
    set aabb(aabb) {
        this._aabb = aabb?.clone() ?? null;
    }

    /**
     * Gets the AABB for this placement. Returns custom AABB if set, otherwise resource.aabb.
     *
     * @returns {BoundingBox} The bounding box.
     */
    get aabb() {
        const aabb = this._aabb ?? this.resource?.aabb;
        Debug.assert(aabb, 'GSplatPlacement.aabb is null - resource.aabb must be set');
        return /** @type {BoundingBox} */ (aabb);
    }

    /**
     * Sets LOD distance thresholds. Only applicable for octree resources. The provided array is
     * copied. If the resource has an octree with N LOD levels, the array should contain N-1
     * elements. For non-octree resources, the value is ignored and kept null.
     *
     * @type {number[]|null}
     */
    set lodDistances(distances) {
        const isOctree = !!(this.resource && /** @type {any} */ (this.resource).octree);
        if (isOctree) {
            if (distances) {
                const lodLevels = /** @type {any} */ (this.resource).octree?.lodLevels ?? 1;
                Debug.assert(Array.isArray(distances), 'lodDistances must be an array');
                Debug.assert(distances.length >= lodLevels, 'lodDistances must have at least octree LOD levels - 1 entries, privided:',
                    distances.length, 'expected:', lodLevels);

                this._lodDistances = distances.slice();
            } else {
                this._lodDistances = null;
            }
        }
    }

    /**
     * Gets a copy of LOD distance thresholds, or null when not set.
     *
     * @type {number[]|null}
     */
    get lodDistances() {
        return this._lodDistances ? this._lodDistances.slice() : null;
    }

    /**
     * Gets an instance-level texture by name. Creates the streams container on first access
     * if the format has instance streams defined.
     *
     * @param {string} name - The name of the texture to get.
     * @param {GraphicsDevice} device - The graphics device (required for lazy initialization).
     * @returns {Texture|undefined} The texture, or undefined if not found.
     */
    getInstanceTexture(name, device) {
        // Cast to access GSplatResourceBase properties (GSplatOctreeResource doesn't have format/streams)
        const resource = /** @type {GSplatResourceBase} */ (this.resource);
        if (!resource?.format) {
            return undefined;
        }

        // Lazy-initialize streams if format has instance streams
        if (!this._streams && resource.format.instanceStreams.length > 0) {
            this._streams = new GSplatStreams(device, true);
            this._streams.textureDimensions.copy(resource.streams.textureDimensions);
            this._streams.syncWithFormat(resource.format);
        }

        return this._streams?.getTexture(name);
    }

    /**
     * Gets the instance streams container, or null if not initialized.
     * Delegates to parent placement if available (for octree file placements).
     *
     * @type {GSplatStreams|null}
     * @ignore
     */
    get streams() {
        return this._parentPlacement?.streams ?? this._streams;
    }

    /**
     * Ensures instance streams container exists if format has instance streams.
     *
     * @param {GraphicsDevice} device - The graphics device.
     * @ignore
     */
    ensureInstanceStreams(device) {
        const resource = /** @type {GSplatResourceBase} */ (this.resource);
        if (!resource?.format) {
            return;
        }

        if (!this._streams && resource.format.instanceStreams.length > 0) {
            this._streams = new GSplatStreams(device, true);
            this._streams.textureDimensions.copy(resource.streams.textureDimensions);
            this._streams.syncWithFormat(resource.format);
        }
    }
}


export { GSplatPlacement };
