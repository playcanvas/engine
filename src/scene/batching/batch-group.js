import { LAYERID_WORLD } from '../constants.js';

/**
 * @class
 * @name pc.BatchGroup
 * @classdesc Holds mesh batching settings and a unique id. Created via {@link pc.BatchManager#addGroup}.
 * @param {number} id - Unique id. Can be assigned to model and element components.
 * @param {string} name - The name of the group.
 * @param {boolean} dynamic - Whether objects within this batch group should support transforming at runtime.
 * @param {number} maxAabbSize - Maximum size of any dimension of a bounding box around batched objects.
 * {@link pc.BatchManager#prepare} will split objects into local groups based on this size.
 * @param {number[]} [layers] - Layer ID array. Default is [pc.LAYERID_WORLD]. The whole batch group will belong
 * to these layers. Layers of source models will be ignored.
 * @property {boolean} dynamic Whether objects within this batch group should support transforming at runtime.
 * @property {number} maxAabbSize Maximum size of any dimension of a bounding box around batched objects.
 * {@link pc.BatchManager#prepare} will split objects into local groups based on this size.
 * @property {number} id Unique id. Can be assigned to model and element components.
 * @property {string} name Name of the group.
 * @property {number[]} [layers] Layer ID array. Default is [pc.LAYERID_WORLD]. The whole batch group will belong
 * to these layers. Layers of source models will be ignored.
 */
class BatchGroup {
    constructor(id, name, dynamic, maxAabbSize, layers = [LAYERID_WORLD]) {
        this.dynamic = dynamic;
        this.maxAabbSize = maxAabbSize;
        this.id = id;
        this.name = name;
        this.layers = layers;
        this._ui = false;
        this._sprite = false;
        this._obj = {
            model: [],
            element: [],
            sprite: [],
            render: []
        };
    }

    static MODEL = 'model';

    static ELEMENT = 'element';

    static SPRITE = 'sprite';

    static RENDER = 'render';
}

export { BatchGroup };
