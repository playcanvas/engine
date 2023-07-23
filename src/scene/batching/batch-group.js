import { LAYERID_WORLD } from '../constants.js';

/**
 * Holds mesh batching settings and a unique id. Created via {@link BatchManager#addGroup}.
 *
 * @category Graphics
 */
class BatchGroup {
    /** @private */
    _ui = false;

    /** @private */
    _sprite = false;

    /** @private */
    _obj = {
        model: [],
        element: [],
        sprite: [],
        render: []
    };

    /**
     * Unique id. Can be assigned to model, render and element components.
     *
     * @type {number}
     */
    id;

    /**
     * Name of the group.
     *
     * @type {string}
     */
    name;

    /**
     * Whether objects within this batch group should support transforming at runtime.
     *
     * @type {boolean}
     */
    dynamic;

    /**
     * Maximum size of any dimension of a bounding box around batched objects.
     * {@link BatchManager#prepare} will split objects into local groups based on this size.
     *
     * @type {number}
     */
    maxAabbSize;

    /**
     * Layer ID array. Default is [{@link LAYERID_WORLD}]. The whole batch group will belong to
     * these layers. Layers of source models will be ignored.
     *
     * @type {number[]}
     */
    layers;

    /**
     * Create a new BatchGroup instance.
     *
     * @param {number} id - Unique id. Can be assigned to model, render and element components.
     * @param {string} name - The name of the group.
     * @param {boolean} dynamic - Whether objects within this batch group should support
     * transforming at runtime.
     * @param {number} maxAabbSize - Maximum size of any dimension of a bounding box around batched
     * objects. {@link BatchManager#prepare} will split objects into local groups based on this
     * size.
     * @param {number[]} [layers] - Layer ID array. Default is [{@link LAYERID_WORLD}]. The whole
     * batch group will belong to these layers. Layers of source models will be ignored.
     */
    constructor(id, name, dynamic, maxAabbSize, layers = [LAYERID_WORLD]) {
        this.id = id;
        this.name = name;
        this.dynamic = dynamic;
        this.maxAabbSize = maxAabbSize;
        this.layers = layers;
    }

    static MODEL = 'model';

    static ELEMENT = 'element';

    static SPRITE = 'sprite';

    static RENDER = 'render';
}

export { BatchGroup };
