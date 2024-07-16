import * as pc from 'playcanvas';
import { data } from 'examples/observer';

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
     * Flag to ignore picker on gizmo pointer events.
     *
     * @type {boolean}
     * @private
     */
    _ignorePicker = false;

    /**
     * Flag to skip data set from firing event.
     *
     * @type {boolean}
     * @private
     */
    _skipSetFire = false;

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
            gizmo.on(
                'pointer:down',
                (/** @type {number} */ x, /** @type {number} */ y, /** @type {pc.MeshInstance} */ meshInstance) => {
                    this._ignorePicker = !!meshInstance;
                }
            );
            gizmo.on('pointer:up', () => {
                this._ignorePicker = false;
            });
        }
    }

    get gizmo() {
        return this._gizmos[this._type];
    }

    get ignorePicker() {
        return this._ignorePicker;
    }

    get skipSetFire() {
        return this._skipSetFire;
    }

    /**
     * @param {string} type - The transform gizmo type.
     */
    _updateData(type) {
        /** @type {any} */
        const gizmo = this.gizmo;
        this._skipSetFire = true;
        data.set('gizmo', {
            type: type,
            size: gizmo.size,
            snapIncrement: gizmo.snapIncrement,
            xAxisColor: Object.values(gizmo.xAxisColor),
            yAxisColor: Object.values(gizmo.yAxisColor),
            zAxisColor: Object.values(gizmo.zAxisColor),
            colorAlpha: gizmo.colorAlpha,
            coordSpace: gizmo.coordSpace,
            axisLineTolerance: gizmo.axisLineTolerance,
            axisCenterTolerance: gizmo.axisCenterTolerance,
            ringTolerance: gizmo.ringTolerance,
            axisGap: gizmo.axisGap,
            axisLineThickness: gizmo.axisLineThickness,
            axisLineLength: gizmo.axisLineLength,
            axisArrowThickness: gizmo.axisArrowThickness,
            axisArrowLength: gizmo.axisArrowLength,
            axisBoxSize: gizmo.axisBoxSize,
            axisPlaneSize: gizmo.axisPlaneSize,
            axisPlaneGap: gizmo.axisPlaneGap,
            axisCenterSize: gizmo.axisCenterSize,
            xyzTubeRadius: gizmo.xyzTubeRadius,
            xyzRingRadius: gizmo.xyzRingRadius,
            faceTubeRadius: gizmo.faceTubeRadius,
            faceRingRadius: gizmo.faceRingRadius
        });
        this._skipSetFire = false;
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
        this._updateData(type);
    }

    destroy() {
        for (const type in this._gizmos) {
            this._gizmos[type].destroy();
        }
    }
}

export { GizmoHandler };
