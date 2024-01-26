import {
    createBox,
    createCone,
    createCylinder,
    createPlane,
    createMesh,
    createTorus,
    Material,
    MeshInstance,
    Entity,
    Quat,
    Vec3
} from 'playcanvas';

import { MeshTriData } from './mesh-tri-data.js';

// constants
const SHADOW_DAMP_SCALE = 0.25;
const SHADOW_DAMP_OFFSET = 0.75;
const TORUS_RENDER_SEGMENTS = 80;
const TORUS_INTERSECT_SEGMENTS = 20;
const LIGHT_DIR = new Vec3(1, 2, 3);
const MESH_TEMPLATES = {
    box: createBox,
    cone: createCone,
    cylinder: createCylinder,
    plane: createPlane,
    torus: createTorus
};

// temporary variables
const tmpV1 = new Vec3();
const tmpV2 = new Vec3();
const tmpQ1 = new Quat();

function createShadowMesh(device, entity, type, templateOpts = {}) {
    const createTemplate = MESH_TEMPLATES[type];
    if (!createTemplate) {
        throw new Error('Invalid primitive type.');
    }

    const mesh = createTemplate(device, templateOpts);
    const options = {
        positions: [],
        normals: [],
        indices: [],
        colors: []
    };

    mesh.getPositions(options.positions);
    mesh.getNormals(options.normals);
    mesh.getIndices(options.indices);

    const wtm = entity.getWorldTransform().clone().invert();
    tmpV1.copy(LIGHT_DIR);
    wtm.transformVector(tmpV1, tmpV1);
    tmpV1.normalize();
    const numVertices = mesh.vertexBuffer.numVertices;
    calculateShadowColors(tmpV1, numVertices, options.normals, options.colors);

    return createMesh(device, options.positions, options);
}

function calculateShadowColors(lightDir, numVertices, normals, colors = []) {
    for (let i = 0; i < numVertices; i++) {
        const x = normals[i * 3];
        const y = normals[i * 3 + 1];
        const z = normals[i * 3 + 2];
        tmpV2.set(x, y, z);

        const dot = lightDir.dot(tmpV2);
        const shadow = dot * SHADOW_DAMP_SCALE + SHADOW_DAMP_OFFSET;
        colors.push(shadow * 255, shadow * 255, shadow * 255, 1);
    }

    return colors;
}

class AxisShape {
    _position;

    _rotation;

    _scale;

    _layers = [];

    _disabled;

    _defaultMaterial;

    _hoverMaterial;

    _disabledMaterial;

    device;

    axis;

    entity;

    meshTriDataList = [];

    meshInstances = [];

    constructor(device, options) {
        this.device = device;
        this.axis = options.axis ?? 'x';
        this._position = options.position ?? new Vec3();
        this._rotation = options.rotation ?? new Vec3();
        this._scale = options.scale ?? new Vec3(1, 1, 1);

        this._disabled = options.disabled ?? false;

        this._layers = options.layers ?? this._layers;

        if (!(options.defaultMaterial instanceof Material)) {
            throw new Error('No default material provided.');
        }
        this._defaultMaterial = options.defaultMaterial;

        if (!(options.hoverMaterial instanceof Material)) {
            throw new Error('No hover material provided.');
        }
        this._hoverMaterial = options.hoverMaterial;

        if (!(options.disabledMaterial instanceof Material)) {
            throw new Error('No disabled material provided.');
        }
        this._disabledMaterial = options.disabledMaterial;
    }

    set disabled(value) {
        for (let i = 0; i < this.meshInstances.length; i++) {
            this.meshInstances[i].material = value ? this._disabledMaterial : this._defaultMaterial;
        }
        this._disabled = value ?? false;
    }

    get disabled() {
        return this._disabled;
    }

    _createRoot(name) {
        this.entity = new Entity(name + ':' + this.axis);
        this._updateRootTransform();
    }

    _updateRootTransform() {
        this.entity.setLocalPosition(this._position);
        this.entity.setLocalEulerAngles(this._rotation);
        this.entity.setLocalScale(this._scale);
    }

    _addRenderMeshes(entity, meshes) {
        const meshInstances = [];
        for (let i = 0; i < meshes.length; i++) {
            const mi = new MeshInstance(meshes[i], this._disabled ? this._disabledMaterial : this._defaultMaterial);
            meshInstances.push(mi);
            this.meshInstances.push(mi);
        }
        entity.addComponent('render', {
            meshInstances: meshInstances,
            layers: this._layers,
            castShadows: false
        });
    }

    _addRenderShadowMesh(entity, type) {
        const mesh = createShadowMesh(this.device, entity, type);
        this._addRenderMeshes(entity, [mesh]);
    }

    hover(state) {
        if (this._disabled) {
            return;
        }
        const material = state ? this._hoverMaterial : this._defaultMaterial;
        for (let i = 0; i < this.meshInstances.length; i++) {
            this.meshInstances[i].material = material;
        }
    }

    destroy() {
        this.entity.destroy();
    }
}

class AxisArrow extends AxisShape {
    _gap = 0;

    _lineThickness = 0.02;

    _lineLength = 0.5;

    _arrowThickness = 0.12;

    _arrowLength = 0.18;

    _tolerance = 0.1;

    constructor(device, options = {}) {
        super(device, options);

        this.meshTriDataList = [
            new MeshTriData(createCone(this.device)),
            new MeshTriData(createCylinder(this.device), 1)
        ];

        this._createArrow();
    }

    set gap(value) {
        this._gap = value ?? 0;
        this._updateHead();
        this._updateLine();
    }

    get gap() {
        return this._gap;
    }

    set lineThickness(value) {
        this._lineThickness = value ?? 1;
        this._updateHead();
        this._updateLine();
    }

    get lineThickness() {
        return this._lineThickness;
    }

    set lineLength(value) {
        this._lineLength = value ?? 1;
        this._updateHead();
        this._updateLine();
    }

    get lineLength() {
        return this._lineLength;
    }

    set arrowThickness(value) {
        this._arrowThickness = value ?? 1;
        this._updateHead();
    }

    get arrowThickness() {
        return this._arrowThickness;
    }

    set arrowLength(value) {
        this._arrowLength = value ?? 1;
        this._updateHead();
    }

    get arrowLength() {
        return this._arrowLength;
    }

    set tolerance(value) {
        this._tolerance = value;
        this._updateLine();
    }

    get tolerance() {
        return this._tolerance;
    }

    _createArrow() {
        this._createRoot('arrow');

        // head
        this._head = new Entity('head:' + this.axis);
        this.entity.addChild(this._head);
        this._updateHead();
        this._addRenderShadowMesh(this._head, 'cone');

        // line
        this._line = new Entity('line:' + this.axis);
        this.entity.addChild(this._line);
        this._updateLine();
        this._addRenderShadowMesh(this._line, 'cylinder');
    }

    _updateHead() {
        // intersect
        tmpV1.set(0, this._gap + this._arrowLength * 0.5 + this._lineLength, 0);
        tmpQ1.set(0, 0, 0, 1);
        tmpV2.set(this._arrowThickness, this._arrowLength, this._arrowThickness);
        this.meshTriDataList[0].setTransform(tmpV1, tmpQ1, tmpV2);

        this._head.setLocalPosition(0, this._gap + this._arrowLength * 0.5 + this._lineLength, 0);
        this._head.setLocalScale(this._arrowThickness, this._arrowLength, this._arrowThickness);
    }

    _updateLine() {
        // intersect
        tmpV1.set(0, this._gap + this._lineLength * 0.5, 0);
        tmpQ1.set(0, 0, 0, 1);
        tmpV2.set(this._lineThickness + this._tolerance, this._lineLength, this._lineThickness + this._tolerance);
        this.meshTriDataList[1].setTransform(tmpV1, tmpQ1, tmpV2);

        // render
        this._line.setLocalPosition(0, this._gap + this._lineLength * 0.5, 0);
        this._line.setLocalScale(this._lineThickness, this._lineLength, this._lineThickness);
    }
}

class AxisBoxCenter extends AxisShape {
    _size = 0.12;

    _tolerance = 0.05;

    constructor(device, options = {}) {
        super(device, options);

        this.meshTriDataList = [
            new MeshTriData(createBox(this.device), 2)
        ];

        this._createCenter();
    }

    _createCenter() {
        this._createRoot('boxCenter');
        this._updateTransform();

        // box
        this._addRenderShadowMesh(this.entity, 'box');
    }

    set size(value) {
        this._size = value ?? 1;
        this._updateTransform();
    }

    get size() {
        return this._size;
    }

    set tolerance(value) {
        this._tolerance = value;
        this._updateTransform();
    }

    get tolerance() {
        return this._tolerance;
    }

    _updateTransform() {
        // intersect/render
        this.entity.setLocalScale(this._size, this._size, this._size);
    }
}

class AxisBoxLine extends AxisShape {
    _gap = 0;

    _lineThickness = 0.02;

    _lineLength = 0.5;

    _boxSize = 0.12;

    _tolerance = 0.1;

    constructor(device, options = {}) {
        super(device, options);

        this.meshTriDataList = [
            new MeshTriData(createBox(this.device)),
            new MeshTriData(createCylinder(this.device), 1)
        ];

        this._createBoxLine();
    }

    set gap(value) {
        this._gap = value ?? 0;
        this._updateLine();
        this._updateBox();
    }

    get gap() {
        return this._gap;
    }

    set lineThickness(value) {
        this._lineThickness = value ?? 1;
        this._updateLine();
        this._updateBox();
    }

    get lineThickness() {
        return this._lineThickness;
    }

    set lineLength(value) {
        this._lineLength = value ?? 1;
        this._updateLine();
        this._updateBox();
    }

    get lineLength() {
        return this._lineLength;
    }

    set boxSize(value) {
        this._boxSize = value ?? 1;
        this._updateBox();
    }

    get boxSize() {
        return this._boxSize;
    }

    set tolerance(value) {
        this._tolerance = value;
        this._updateLine();
    }

    get tolerance() {
        return this._tolerance;
    }

    _createBoxLine() {
        this._createRoot('boxLine');

        // box
        this._box = new Entity('box:' + this.axis);
        this.entity.addChild(this._box);
        this._updateBox();
        this._addRenderShadowMesh(this._box, 'box');

        // line
        this._line = new Entity('line:' + this.axis);
        this.entity.addChild(this._line);
        this._updateLine();
        this._addRenderShadowMesh(this._line, 'cylinder');

    }

    _updateBox() {
        // intersect
        tmpV1.set(0, this._gap + this._boxSize * 0.5 + this._lineLength, 0);
        tmpQ1.set(0, 0, 0, 1);
        tmpV2.set(this._boxSize, this._boxSize, this._boxSize);
        this.meshTriDataList[0].setTransform(tmpV1, tmpQ1, tmpV2);

        // render
        this._box.setLocalPosition(0, this._gap + this._boxSize * 0.5 + this._lineLength, 0);
        this._box.setLocalScale(this._boxSize, this._boxSize, this._boxSize);
    }

    _updateLine() {
        // intersect
        tmpV1.set(0, this._gap + this._lineLength * 0.5, 0);
        tmpQ1.set(0, 0, 0, 1);
        tmpV2.set(this._lineThickness + this._tolerance, this._lineLength, this._lineThickness + this._tolerance);
        this.meshTriDataList[1].setTransform(tmpV1, tmpQ1, tmpV2);

        // render
        this._line.setLocalPosition(0, this._gap + this._lineLength * 0.5, 0);
        this._line.setLocalScale(this._lineThickness, this._lineLength, this._lineThickness);
    }
}

class AxisDisk extends AxisShape {
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

        this.meshTriDataList = [
            new MeshTriData(this._createIntersectTorus())
        ];

        this._createDisk();
    }

    _createIntersectTorus() {
        return createTorus(this.device, {
            tubeRadius: this._tubeRadius + this._tolerance,
            ringRadius: this._ringRadius,
            sectorAngle: this._sectorAngle,
            segments: TORUS_INTERSECT_SEGMENTS
        });
    }

    _createRenderTorus(sectorAngle) {
        return createShadowMesh(this.device, this.entity, 'torus', {
            tubeRadius: this._tubeRadius,
            ringRadius: this._ringRadius,
            sectorAngle: sectorAngle,
            segments: TORUS_RENDER_SEGMENTS
        });
    }

    _createDisk() {
        this._createRoot('disk');

        // arc/circle
        this._addRenderMeshes(this.entity, [
            this._createRenderTorus(this._sectorAngle),
            this._createRenderTorus(360)
        ]);
        this.drag(false);
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
        this.meshTriDataList[0].setTris(this._createIntersectTorus());

        // render
        this.meshInstances[0].mesh = this._createRenderTorus(this._sectorAngle);
        this.meshInstances[1].mesh = this._createRenderTorus(360);
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

class AxisPlane extends AxisShape {
    _size = 0.2;

    _gap = 0.1;

    constructor(device, options = {}) {
        super(device, options);

        this.meshTriDataList = [
            new MeshTriData(createPlane(this.device))
        ];

        this._createPlane();
    }

    _getPosition() {
        const offset = this._size / 2 + this._gap;
        const position = new Vec3(offset, offset, offset);
        position[this.axis] = 0;
        return position;
    }

    _createPlane() {
        this._createRoot('plane');
        this._updateTransform();

        // plane
        this._addRenderShadowMesh(this.entity, 'plane');
    }

    set size(value) {
        this._size = value ?? 1;
        this._updateTransform();
    }

    get size() {
        return this._size;
    }

    set gap(value) {
        this._gap = value ?? 0;
        this._updateTransform();
    }

    get gap() {
        return this._gap;
    }

    _updateTransform() {
        // intersect/render
        this.entity.setLocalPosition(this._getPosition());
        this.entity.setLocalEulerAngles(this._rotation);
        this.entity.setLocalScale(this._size, this._size, this._size);
    }
}

export { AxisShape, AxisArrow, AxisBoxCenter, AxisBoxLine, AxisDisk, AxisPlane };
