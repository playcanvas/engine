import {
    createBox,
    createCone,
    createCylinder,
    createPlane,
    createMesh,
    Color,
    MeshInstance,
    Entity,
    Mat4,
    Quat,
    Vec3
} from 'playcanvas';

import { Tri } from './tri.js';

// constants
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

function createTorus(device, opts = {}) {
    // Check the supplied options and provide defaults for unspecified ones
    const rc = opts.tubeRadius ?? 0.2;
    const rt = opts.ringRadius ?? 0.3;
    const segments = opts.segments ?? 30;
    const sides = opts.sides ?? 20;
    const sectorAngle = opts.sectorAngle ?? 2 * Math.PI;

    // Variable declarations
    const positions = [];
    const normals = [];
    const uvs = [];
    const indices = [];

    for (let i = 0; i <= sides; i++) {
        for (let j = 0; j <= segments; j++) {
            const x = Math.cos(sectorAngle * j / segments) * (rt + rc * Math.cos(2 * Math.PI * i / sides));
            const y = Math.sin(2 * Math.PI * i / sides) * rc;
            const z = Math.sin(sectorAngle * j / segments) * (rt + rc * Math.cos(2 * Math.PI * i / sides));

            const nx = Math.cos(sectorAngle * j / segments) * Math.cos(2 * Math.PI * i / sides);
            const ny = Math.sin(2 * Math.PI * i / sides);
            const nz = Math.sin(sectorAngle * j / segments) * Math.cos(2 * Math.PI * i / sides);

            const u = i / sides;
            const v = 1 - j / segments;

            positions.push(x, y, z);
            normals.push(nx, ny, nz);
            uvs.push(u, 1.0 - v);

            if ((i < sides) && (j < segments)) {
                const first  = ((i))     * (segments + 1) + ((j));
                const second = ((i + 1)) * (segments + 1) + ((j));
                const third  = ((i))     * (segments + 1) + ((j + 1));
                const fourth = ((i + 1)) * (segments + 1) + ((j + 1));

                indices.push(first, second, third);
                indices.push(second, fourth, third);
            }
        }
    }

    const options = {
        normals: normals,
        uvs: uvs,
        uvs1: uvs,
        indices: indices
    };

    return createMesh(device, positions, options);
}

function createShadowMesh(device, entity, type, templateOpts = {}) {
    const createTemplate = MESH_TEMPLATES[type];
    if (!createTemplate) {
        throw new Error('Invalid primitive type.');
    }

    const mesh = createTemplate(device, templateOpts);
    const options = {
        positions: [],
        normals: [],
        uvs: [],
        indices: [],
        colors: []
    };

    mesh.getPositions(options.positions);
    mesh.getNormals(options.normals);
    mesh.getIndices(options.indices);
    mesh.getUvs(0, options.uvs);

    // TODO: face disk entity hasnt been added to world yet so world transform is before lookAt
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
        const shadow = dot * 0.25 + 0.75;
        colors.push(shadow * 255, shadow * 255, shadow * 255, 1);
    }

    return colors;
}

class AxisShape {
    _position;

    _rotation;

    _scale;

    _layers = [];

    _defaultColor;

    _hoverColor;

    device;

    axis;

    entity;

    triData = [];

    meshInstances = [];

    constructor(device, options) {
        this.device = device;
        this.axis = options.axis ?? 'x';
        this._position = options.position ?? new Vec3();
        this._rotation = options.rotation ?? new Vec3();
        this._scale = options.scale ?? new Vec3(1, 1, 1);

        this._layers = options.layers ?? this._layers;

        this._defaultColor = options.defaultColor ?? Color.BLACK;
        this._hoverColor = options.hoverColor ?? Color.WHITE;
    }

    hover(state) {
        const material = state ? this._hoverColor : this._defaultColor;
        for (let i = 0; i < this.meshInstances.length; i++) {
            this.meshInstances[i].material = material;
        }
    }
}

class AxisArrow extends AxisShape {
    _gap = 0;

    _lineThickness = 0.04;

    _lineLength = 0.5;

    _arrowThickness = 0.15;

    _arrowLength = 0.2;

    _intersectTolerance = 0.1;

    constructor(device, options = {}) {
        super(device, options);

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

    _createArrow() {
        // intersect
        this.triData.push({
            tris: Tri.trisFromMesh(createCone(this.device)),
            ptm: new Mat4()
        }, {
            tris: Tri.trisFromMesh(createCylinder(this.device)),
            ptm: new Mat4()
        });

        this.entity = new Entity('arrow:' + this.axis);
        this.entity.setLocalPosition(this._position);
        this.entity.setLocalEulerAngles(this._rotation);
        this.entity.setLocalScale(this._scale);

        // head
        this._head = new Entity('head:' + this.axis);
        this.entity.addChild(this._head);
        this._updateHead();
        let mesh = createShadowMesh(this.device, this._head, 'cone');
        let meshInstance = new MeshInstance(mesh, this._defaultColor);
        this._head.addComponent('render', {
            meshInstances: [meshInstance],
            layers: this._layers,
            castShadows: false
        });
        this.meshInstances.push(meshInstance);

        // line
        this._line = new Entity('line:' + this.axis);
        this.entity.addChild(this._line);
        this._updateLine();
        mesh = createShadowMesh(this.device, this._line, 'cylinder');
        meshInstance = new MeshInstance(mesh, this._defaultColor);
        this._line.addComponent('render', {
            meshInstances: [meshInstance],
            layers: this._layers,
            castShadows: false
        });
        this.meshInstances.push(meshInstance);
    }

    _updateHead() {
        // intersect
        tmpV1.set(0, this._gap + this._arrowLength * 0.5 + this._lineLength, 0);
        tmpQ1.set(0, 0, 0, 1);
        tmpV2.set(this._arrowThickness, this._arrowLength, this._arrowThickness);
        this.triData[0].ptm.setTRS(tmpV1, tmpQ1, tmpV2);

        this._head.setLocalPosition(0, this._gap + this._arrowLength * 0.5 + this._lineLength, 0);
        this._head.setLocalScale(this._arrowThickness, this._arrowLength, this._arrowThickness);
    }

    _updateLine() {
        // intersect
        tmpV1.set(0, this._gap + this._lineLength * 0.5, 0);
        tmpQ1.set(0, 0, 0, 1);
        tmpV2.set(this._lineThickness + this._intersectTolerance, this._lineLength, this._lineThickness + this._intersectTolerance);
        this.triData[1].ptm.setTRS(tmpV1, tmpQ1, tmpV2);

        // render
        this._line.setLocalPosition(0, this._gap + this._lineLength * 0.5, 0);
        this._line.setLocalScale(this._lineThickness, this._lineLength, this._lineThickness);
    }
}

class AxisBoxCenter extends AxisShape {
    _size = 0.14;

    constructor(device, options = {}) {
        super(device, options);

        this._createCenter();
    }

    _createCenter() {
        // intersect
        this.triData.push({
            tris: Tri.trisFromMesh(createBox(this.device)),
            ptm: new Mat4()
        });

        // render
        this.entity = new Entity('boxCenter:' + this.axis);
        this.entity.setLocalPosition(this._position);
        this.entity.setLocalEulerAngles(this._rotation);
        this.entity.setLocalScale(this._size, this._size, this._size);
        const mesh = createShadowMesh(this.device, this.entity, 'box');
        const meshInstance = new MeshInstance(mesh, this._defaultColor);
        this.entity.addComponent('render', {
            meshInstances: [meshInstance],
            layers: this._layers,
            castShadows: false
        });
        this.meshInstances.push(meshInstance);
    }

    set size(value) {
        this._size = value ?? 1;
        this._updateTransform();
    }

    get size() {
        return this._size;
    }

    _updateTransform() {
        // intersect/render
        this.entity.setLocalScale(this._size, this._size, this._size);
    }
}

class AxisBoxLine extends AxisShape {
    _gap = 0;

    _lineThickness = 0.04;

    _lineLength = 0.5;

    _boxSize = 0.14;

    _intersectTolerance = 0.1;

    constructor(device, options = {}) {
        super(device, options);

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

    _createBoxLine() {
        // intersect
        this.triData.push({
            tris: Tri.trisFromMesh(createBox(this.device)),
            ptm: new Mat4()
        }, {
            tris: Tri.trisFromMesh(createCylinder(this.device)),
            ptm: new Mat4()
        });

        // render
        this.entity = new Entity('boxLine:' + this.axis);
        this.entity.setLocalPosition(this._position);
        this.entity.setLocalEulerAngles(this._rotation);
        this.entity.setLocalScale(this._scale);

        this._box = new Entity('box:' + this.axis);
        this.entity.addChild(this._box);
        this._updateBox();
        let mesh = createShadowMesh(this.device, this._box, 'box');
        let meshInstance = new MeshInstance(mesh, this._defaultColor);
        this._box.addComponent('render', {
            meshInstances: [meshInstance],
            layers: this._layers,
            castShadows: false
        });
        this.meshInstances.push(meshInstance);

        this._line = new Entity('line:' + this.axis);
        this.entity.addChild(this._line);
        this._updateLine();
        mesh = createShadowMesh(this.device, this._line, 'cylinder');
        meshInstance = new MeshInstance(mesh, this._defaultColor);
        this._line.addComponent('render', {
            meshInstances: [meshInstance],
            layers: this._layers,
            castShadows: false
        });
        this.meshInstances.push(meshInstance);
    }

    _updateBox() {
        // intersect
        tmpV1.set(0, this._gap + this._boxSize * 0.5 + this._lineLength, 0);
        tmpQ1.set(0, 0, 0, 1);
        tmpV2.set(this._boxSize, this._boxSize, this._boxSize);
        this.triData[0].ptm.setTRS(tmpV1, tmpQ1, tmpV2);

        // render
        this._box.setLocalPosition(0, this._gap + this._boxSize * 0.5 + this._lineLength, 0);
        this._box.setLocalScale(this._boxSize, this._boxSize, this._boxSize);
    }

    _updateLine() {
        // intersect
        tmpV1.set(0, this._gap + this._lineLength * 0.5, 0);
        tmpQ1.set(0, 0, 0, 1);
        tmpV2.set(this._lineThickness + this._intersectTolerance, this._lineLength, this._lineThickness + this._intersectTolerance);
        this.triData[1].ptm.setTRS(tmpV1, tmpQ1, tmpV2);

        // render
        this._line.setLocalPosition(0, this._gap + this._lineLength * 0.5, 0);
        this._line.setLocalScale(this._lineThickness, this._lineLength, this._lineThickness);
    }
}

class AxisDisk extends AxisShape {
    _tubeRadius = 0.02;

    _ringRadius = 0.55;

    _sectorAngle;

    _lightDir;

    _intersectTolerance = 0.1;

    constructor(device, options = {}) {
        super(device, options);

        this._tubeRadius = options.tubeRadius ?? this._tubeRadius;
        this._ringRadius = options.ringRadius ?? this._ringRadius;
        this._sectorAngle = options.sectorAngle ?? this._sectorAngle;

        this._createDisk();
    }

    _createDisk() {
        // intersect
        this.triData.push({
            tris: Tri.trisFromMesh(createTorus(this.device, {
                tubeRadius: this._tubeRadius + this._intersectTolerance,
                ringRadius: this._ringRadius,
                sectorAngle: this._sectorAngle,
                segments: TORUS_INTERSECT_SEGMENTS
            })),
            ptm: new Mat4()
        });

        // render
        this.entity = new Entity('disk:' + this.axis);
        this.entity.setLocalPosition(this._position);
        this.entity.setLocalEulerAngles(this._rotation);
        this.entity.setLocalScale(this._scale);
        const arcMesh = createShadowMesh(this.device, this.entity, 'torus', {
            tubeRadius: this._tubeRadius,
            ringRadius: this._ringRadius,
            sectorAngle: this._sectorAngle,
            segments: TORUS_RENDER_SEGMENTS
        });
        const circleMesh = createShadowMesh(this.device, this.entity, 'torus', {
            tubeRadius: this._tubeRadius,
            ringRadius: this._ringRadius,
            sectorAngle: 2 * Math.PI,
            segments: TORUS_RENDER_SEGMENTS
        });
        const arcMeshInstance = new MeshInstance(arcMesh, this._defaultColor);
        const circleMeshInstance = new MeshInstance(circleMesh, this._defaultColor);
        circleMeshInstance.visible = false;
        this.entity.addComponent('render', {
            meshInstances: [arcMeshInstance, circleMeshInstance],
            layers: this._layers,
            castShadows: false
        });
        this.meshInstances.push(arcMeshInstance, circleMeshInstance);
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

    _updateTransform() {
        // intersect
        this.triData[0].tris = Tri.trisFromMesh(createTorus(this.device, {
            tubeRadius: this._tubeRadius + this._intersectTolerance,
            ringRadius: this._ringRadius,
            sectorAngle: this._sectorAngle,
            segments: TORUS_INTERSECT_SEGMENTS
        }));

        // render
        const arcMesh = createShadowMesh(this.device, this.entity, 'torus', {
            lightDir: this._lightDir,
            tubeRadius: this._tubeRadius,
            ringRadius: this._ringRadius,
            sectorAngle: this._sectorAngle,
            segments: TORUS_RENDER_SEGMENTS
        });
        const circleMesh = createShadowMesh(this.device, this.entity, 'torus', {
            lightDir: this._lightDir,
            tubeRadius: this._tubeRadius,
            ringRadius: this._ringRadius,
            sectorAngle: 2 * Math.PI,
            segments: TORUS_RENDER_SEGMENTS
        });
        this.meshInstances[0].meshInstance.mesh = arcMesh;
        this.meshInstances[1].meshInstance.mesh = circleMesh;
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

        this._createPlane();
    }

    _getPosition() {
        const offset = this._size / 2 + this._gap;
        const position = new Vec3(offset, offset, offset);
        position[this.axis] = 0;
        return position;
    }

    _createPlane() {
        // intersect
        this.triData.push({
            tris: Tri.trisFromMesh(createPlane(this.device)),
            ptm: new Mat4()
        });

        // render
        this.entity = new Entity('plane:' + this.axis);
        this.entity.setLocalPosition(this._getPosition());
        this.entity.setLocalEulerAngles(this._rotation);
        this.entity.setLocalScale(this._size, this._size, this._size);
        const mesh = createShadowMesh(this.device, this.entity, 'plane');
        const meshInstance = new MeshInstance(mesh, this._defaultColor);
        this.entity.addComponent('render', {
            meshInstances: [meshInstance],
            layers: this._layers,
            castShadows: false
        });
        this.meshInstances.push(meshInstance);
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
        this.entity.setLocalScale(this._size, this._size, this._size);
    }
}

export { AxisShape, AxisArrow, AxisBoxCenter, AxisBoxLine, AxisDisk, AxisPlane };