import * as pc from 'playcanvas';

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
     * @type {Record<string, pc.TransformGizmo>}
     * @private
     */
    _gizmos;

    /**
     * Nodes to attach to active gizmo.
     *
     * @type {pc.GraphNode[]}
     * @private
     */
    _nodes = [];

    /**
     * Flag to check if gizmo has captured pointer.
     *
     * @type {boolean}
     * @private
     */
    _hasPointer = false;

    /**
     * @param {pc.AppBase} app - The application.
     * @param {pc.CameraComponent} camera - The camera component.
     * @param {pc.Layer} layer - The gizmo layer
     */
    constructor(app, camera, layer) {
        this._gizmos = {
            translate: new pc.TranslateGizmo(app, camera, layer),
            rotate: new pc.RotateGizmo(app, camera, layer),
            scale: new pc.ScaleGizmo(app, camera, layer)
        };

        for (const type in this._gizmos) {
            const gizmo = this._gizmos[type];
            gizmo.on('pointer:down', (x, y, /** @type {pc.MeshInstance} */ meshInstance) => {
                this._hasPointer = !!meshInstance;
            });
            gizmo.on('pointer:up', () => {
                this._hasPointer = false;
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

    get hasPointer() {
        return this._hasPointer;
    }

    /**
     * Adds single node to active gizmo.
     *
     * @param {pc.GraphNode} node - The node to add.
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
    }

    /**
     * Clear all nodes.
     */
    clear() {
        this._nodes.length = 0;
        this.gizmo.detach();
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
    }
}

export { GizmoHandler };
