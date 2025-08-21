import { TorusGeometry } from '../../../scene/geometry/torus-geometry.js';
import { TriData } from '../tri-data.js';
import { Shape } from './shape.js';

const TORUS_RENDER_SEGMENTS = 80;
const TORUS_INTERSECT_SEGMENTS = 20;

class ArcShape extends Shape {
    _tubeRadius = 0.01;

    _ringRadius = 0.5;

    _sectorAngle;

    _lightDir;

    _tolerance = 0.05;

    constructor(device, options = {}) {
        super(device, options);

        this._tubeRadius = options.tubeRadius ?? this._tubeRadius;
        this._ringRadius = options.ringRadius ?? this._ringRadius;
        this._sectorAngle = options.sectorAngle ?? this._sectorAngle;

        this.triData = [
            new TriData(this._createTorusGeometry())
        ];

        this._createRoot('disk');

        // arc/circle
        this._createRenderComponent(this.entity, [
            this._createTorusMesh(this._sectorAngle),
            this._createTorusMesh(360)
        ]);
        this.drag(false);
    }

    _createTorusGeometry() {
        return new TorusGeometry({
            tubeRadius: this._tubeRadius + this._tolerance,
            ringRadius: this._ringRadius,
            sectorAngle: this._sectorAngle,
            segments: TORUS_INTERSECT_SEGMENTS
        });
    }

    _createTorusMesh(sectorAngle) {
        const geom = new TorusGeometry({
            tubeRadius: this._tubeRadius,
            ringRadius: this._ringRadius,
            sectorAngle: sectorAngle,
            segments: TORUS_RENDER_SEGMENTS
        });
        return this._createMesh(geom, this._shading);
    }

    set tubeRadius(value) {
        this._tubeRadius = value ?? 0.1;
        this._updateTransform();
    }

    get tubeRadius() {
        return this._tubeRadius;
    }

    set ringRadius(value) {
        this._ringRadius = value ?? 0.1;
        this._updateTransform();
    }

    get ringRadius() {
        return this._ringRadius;
    }

    set tolerance(value) {
        this._tolerance = value;
        this._updateTransform();
    }

    get tolerance() {
        return this._tolerance;
    }

    _updateTransform() {
        // intersect
        this.triData[0].fromGeometry(this._createTorusGeometry());

        // render
        this.meshInstances[0].mesh = this._createTorusMesh(this._sectorAngle);
        this.meshInstances[1].mesh = this._createTorusMesh(360);
    }

    drag(state) {
        this.meshInstances[0].visible = !state;
        this.meshInstances[1].visible = state;
    }

    hide(state) {
        if (state) {
            this.meshInstances[0].visible = false;
            this.meshInstances[1].visible = false;
            return;
        }

        this.drag(false);
    }
}

export { ArcShape };
