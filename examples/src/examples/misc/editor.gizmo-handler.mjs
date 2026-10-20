import { BoundingBoxGizmo, Gizmo, Layer, RotateGizmo, SORTMODE_NONE, ScaleGizmo, TranslateGizmo } from 'playcanvas';

/**
 * @import { CameraComponent, GraphNode, MeshInstance, TransformGizmo } from 'playcanvas'
 */

class GizmoHandler {
    /**
     * Gizmo type.
     *
     * @type {string}
     * @private
     */
    _type = 'translate';

    /**
     * Object to reference each gizmo.
     *
     * @type {Record<string, TransformGizmo>}
     * @private
     */
    _gizmos;

    /**
     * Bounding box gizmo for the nodes.
     *
     * @type {BoundingBoxGizmo}
     * @private
     */
    _bounds;

    /**
     * Whether the bounding box is shown.
     *
     * @private
     */
    _boundsEnabled = true;

    /**
     * Nodes to attach to active gizmo.
     *
     * @type {GraphNode[]}
     * @private
     */
    _nodes = [];

    /**
     * @param {CameraComponent} camera - The camera component.
     */
    constructor(camera) {
        const app = camera.system.app;

        // bounds layer goes before the gizmo layer, which clears depth
        const boundsLayer = new Layer({
            name: 'Bounds',
            opaqueSortMode: SORTMODE_NONE,
            transparentSortMode: SORTMODE_NONE
        });
        app.scene.layers.push(boundsLayer);
        this._bounds = new BoundingBoxGizmo(camera, boundsLayer);

        const layer = Gizmo.createLayer(app);
        this._gizmos = {
            translate: new TranslateGizmo(camera, layer),
            rotate: new RotateGizmo(camera, layer),
            scale: new ScaleGizmo(camera, layer)
        };

        for (const type in this._gizmos) {
            const gizmo = this._gizmos[type];
            gizmo.on('pointer:down', (_x, _y, /** @type {MeshInstance} */ meshInstance) => {
                app.fire('gizmo:pointer', !!meshInstance);
            });
            gizmo.on('pointer:up', () => {
                app.fire('gizmo:pointer', false);
            });
        }
    }

    get type() {
        return this._type;
    }

    get gizmo() {
        return this._gizmos[this._type];
    }

    set size(value) {
        for (const type in this._gizmos) {
            this._gizmos[type].size = value;
        }
    }

    get size() {
        return this.gizmo.size;
    }

    set readout(value) {
        for (const type in this._gizmos) {
            this._gizmos[type].readout = value;
        }
    }

    get readout() {
        return this.gizmo.readout;
    }

    set bounds(value) {
        this._boundsEnabled = value;
        this._bounds.enabled = value;
    }

    get bounds() {
        return this._boundsEnabled;
    }

    /**
     * Adds single node to active gizmo.
     *
     * @param {GraphNode} node - The node to add.
     * @param {boolean} clear - To clear the node array.
     */
    add(node, clear = false) {
        if (clear) {
            this._nodes.length = 0;
        }
        if (this._nodes.indexOf(node) === -1) {
            this._nodes.push(node);
        }
        this.gizmo.attach(this._nodes);
        this._bounds.attach(this._nodes);
        this._bounds.enabled = this._boundsEnabled;
    }

    /**
     * Clear all nodes.
     */
    clear() {
        this._nodes.length = 0;
        this.gizmo.detach();
        this._bounds.detach();
    }

    /**
     * Switches between gizmo types
     *
     * @param {string} type - The transform gizmo type.
     */
    switch(type) {
        this.gizmo.detach();
        const coordSpace = this.gizmo.coordSpace;
        this._type = type ?? 'translate';
        this.gizmo.attach(this._nodes);
        this.gizmo.coordSpace = coordSpace;
    }

    destroy() {
        for (const type in this._gizmos) {
            this._gizmos[type].destroy();
        }
        this._bounds.destroy();
    }
}

export { GizmoHandler };
