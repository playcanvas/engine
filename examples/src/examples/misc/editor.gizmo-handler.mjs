import {
    BoundingBoxGizmo,
    CameraGizmo,
    Gizmo,
    IconGizmo,
    LightGizmo,
    RotateGizmo,
    ScaleGizmo,
    TranslateGizmo
} from 'playcanvas';

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
     * Gizmo drawing the selected lights.
     *
     * @type {LightGizmo}
     * @private
     */
    _lights;

    /**
     * Gizmo drawing the selected cameras.
     *
     * @type {CameraGizmo}
     * @private
     */
    _cameras;

    /**
     * Gizmo drawing the icons of the other lights and cameras.
     *
     * @type {IconGizmo}
     * @private
     */
    _icons;

    /**
     * The light and camera entities of the scene.
     *
     * @type {GraphNode[]}
     * @private
     */
    _helperNodes = [];

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

        // the helper layer keeps the scene depth, so it goes before the gizmo layer, which clears it
        const helperLayer = Gizmo.createLayer(app, 'Helpers', undefined, true);
        const layer = Gizmo.createLayer(app);

        // a press goes to the first gizmo it hits, so the transform gizmos are created first
        this._gizmos = {
            translate: new TranslateGizmo(camera, layer),
            rotate: new RotateGizmo(camera, layer),
            scale: new ScaleGizmo(camera, layer)
        };
        this._bounds = new BoundingBoxGizmo(camera, helperLayer);
        this._lights = new LightGizmo(camera, helperLayer);
        this._cameras = new CameraGizmo(camera, helperLayer);

        // lights and cameras that are not selected show only their icons
        this._icons = new IconGizmo(camera, helperLayer);

        // the camera stops orbiting while any gizmo is dragged, and clicking an icon selects its node
        const gizmos = [...Object.values(this._gizmos), this._bounds, this._lights, this._cameras, this._icons];
        for (const gizmo of gizmos) {
            gizmo.on('pointer:down', (_x, _y, /** @type {MeshInstance} */ meshInstance) => {
                if (meshInstance) {
                    app.fire('gizmo:pointer', true);
                }
            });
            gizmo.on('pointer:up', () => {
                app.fire('gizmo:pointer', false);
            });
            gizmo.on('icon:select', (/** @type {GraphNode} */ node) => {
                app.fire('gizmo:select', node);
            });
        }
    }

    /**
     * Sets the light and camera entities of the scene, which show their icons until selected.
     *
     * @param {GraphNode[]} nodes - The light and camera entities.
     */
    helpers(nodes) {
        this._helperNodes = nodes;
        this._updateHelpers();
    }

    /**
     * Attaches the nodes to a gizmo, or detaches it when there are none.
     *
     * @param {Gizmo} gizmo - The gizmo.
     * @param {GraphNode[]} nodes - The nodes.
     * @private
     */
    _attach(gizmo, nodes) {
        if (nodes.length) {
            gizmo.attach(nodes);
        } else {
            gizmo.detach();
        }
    }

    /**
     * Shows the full light and camera gizmos for the selected nodes, and icons for the others.
     *
     * @private
     */
    _updateHelpers() {
        const has = (/** @type {GraphNode} */ node, /** @type {string} */ component) =>
            !!(/** @type {any} */ (node)[component]);
        const selected = (node) => this._nodes.includes(node);
        const others = this._helperNodes.filter((node) => !selected(node));
        this._attach(
            this._lights,
            this._nodes.filter((node) => has(node, 'light'))
        );
        this._attach(
            this._cameras,
            this._nodes.filter((node) => has(node, 'camera'))
        );
        this._attach(this._icons, others);

        // only nodes that render have bounds
        this._attach(
            this._bounds,
            this._nodes.filter((node) => has(node, 'render'))
        );
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
        this._updateHelpers();
    }

    /**
     * Clear all nodes.
     */
    clear() {
        this._nodes.length = 0;
        this.gizmo.detach();
        this._updateHelpers();
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
        this._lights.destroy();
        this._cameras.destroy();
        this._icons.destroy();
    }
}

export { GizmoHandler };
