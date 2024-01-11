import {
    createBox,
    createCone,
    createCylinder,
    createPlane,
    createMesh,
    Color,
    MeshInstance,
    Entity,
    Vec3
} from 'playcanvas';

// constants
const TORUS_SEGMENTS = 80;
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

    const wtm = entity.getWorldTransform().clone().invert();
    wtm.transformVector(templateOpts.lightDir ?? LIGHT_DIR, tmpV1);
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

    constructor(device, options = {}) {
        super(device, options);

        this._createArrow();
    }

    set gap(value) {
        this._gap = value ?? 0;
        this._updateLine();
        this._updateArrow();
    }

    get gap() {
        return this._gap;
    }

    set lineThickness(value) {
        this._lineThickness = value ?? 1;
        this._updateLine();
        this._updateArrow();
    }

    get lineThickness() {
        return this._lineThickness;
    }

    set lineLength(value) {
        this._lineLength = value ?? 1;
        this._updateLine();
        this._updateArrow();
    }

    get lineLength() {
        return this._lineLength;
    }

    set arrowThickness(value) {
        this._arrowThickness = value ?? 1;
        this._updateArrow();
    }

    get arrowThickness() {
        return this._arrowThickness;
    }

    set arrowLength(value) {
        this._arrowLength = value ?? 1;
        this._updateArrow();
    }

    get arrowLength() {
        return this._arrowLength;
    }

    _createArrow() {
        this.entity = new Entity('axis_' + this.axis);
        this.entity.setLocalPosition(this._position);
        this.entity.setLocalEulerAngles(this._rotation);
        this.entity.setLocalScale(this._scale);

        this._line = new Entity('line_' + this.axis);
        this.entity.addChild(this._line);
        let mesh = createShadowMesh(this.device, this._line, 'cylinder');
        let meshInstance = new MeshInstance(mesh, this._defaultColor);
        this._line.addComponent('render', {
            meshInstances: [meshInstance],
            layers: this._layers,
            castShadows: false
        });
        this._updateLine();
        this.meshInstances.push(meshInstance);

        this._arrow = new Entity('arrow_' + this.axis);
        this.entity.addChild(this._arrow);
        mesh = createShadowMesh(this.device, this._arrow, 'cone');
        meshInstance = new MeshInstance(mesh, this._defaultColor);
        this._arrow.addComponent('render', {
            meshInstances: [meshInstance],
            layers: this._layers,
            castShadows: false
        });
        this._updateArrow();
        this.meshInstances.push(meshInstance);

    }

    _updateLine() {
        this._line.setLocalPosition(0, this._gap + this._lineLength * 0.5, 0);
        this._line.setLocalScale(this._lineThickness, this._lineLength, this._lineThickness);
    }

    _updateArrow() {
        this._arrow.setLocalPosition(0, this._gap + this._arrowLength * 0.5 + this._lineLength, 0);
        this._arrow.setLocalScale(this._arrowThickness, this._arrowLength, this._arrowThickness);
    }
}

class AxisBoxCenter extends AxisShape {
    _size = 0.14;

    constructor(device, options = {}) {
        super(device, options);

        this._createCenter();
    }

    _createCenter() {
        this.entity = new Entity('center_' + this.axis);
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
        this.entity.setLocalScale(this._size, this._size, this._size);
    }

    get size() {
        return this._size;
    }
}

class AxisBoxLine extends AxisShape {
    _gap = 0;

    _lineThickness = 0.04;

    _lineLength = 0.5;

    _boxSize = 0.14;

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
        this.entity = new Entity('axis_' + this.axis);
        this.entity.setLocalPosition(this._position);
        this.entity.setLocalEulerAngles(this._rotation);
        this.entity.setLocalScale(this._scale);

        this._line = new Entity('line_' + this.axis);
        this.entity.addChild(this._line);
        let mesh = createShadowMesh(this.device, this._line, 'cylinder');
        let meshInstance = new MeshInstance(mesh, this._defaultColor);
        this._line.addComponent('render', {
            meshInstances: [meshInstance],
            layers: this._layers,
            castShadows: false
        });
        this._updateLine();
        this.meshInstances.push(meshInstance);

        this._box = new Entity('box_' + this.axis);
        this.entity.addChild(this._box);
        mesh = createShadowMesh(this.device, this._box, 'box');
        meshInstance = new MeshInstance(mesh, this._defaultColor);
        this._box.addComponent('render', {
            meshInstances: [meshInstance],
            layers: this._layers,
            castShadows: false
        });
        this._updateBox();
        this.meshInstances.push(meshInstance);
    }

    _updateLine() {
        this._line.setLocalPosition(new Vec3(0, this._gap + this._lineLength * 0.5, 0));
        this._line.setLocalScale(new Vec3(this._lineThickness, this._lineLength, this._lineThickness));
    }

    _updateBox() {
        this._box.setLocalPosition(new Vec3(0, this._gap + this._boxSize * 0.5 + this._lineLength, 0));
        this._box.setLocalScale(new Vec3(this._boxSize, this._boxSize, this._boxSize));
    }
}

class AxisDisk extends AxisShape {
    _tubeRadius = 0.02;

    _ringRadius = 0.55;

    _sectorAngle;

    _lightDir;

    constructor(device, options = {}) {
        super(device, options);

        this._tubeRadius = options.tubeRadius ?? this._tubeRadius;
        this._ringRadius = options.ringRadius ?? this._ringRadius;
        this._sectorAngle = options.sectorAngle ?? this._sectorAngle;
        this._lightDir = options.lightDir ?? this._lightDir;

        this._createDisk();
    }

    _createDisk() {
        this.entity = new Entity('disk_' + this.axis);
        this.entity.setLocalPosition(this._position);
        this.entity.setLocalEulerAngles(this._rotation);
        this.entity.setLocalScale(this._scale);
        const meshInstances = [
            new MeshInstance(this._createTorusMesh(this.entity, this._sectorAngle), this._defaultColor),
            new MeshInstance(this._createTorusMesh(this.entity, 2 * Math.PI), this._defaultColor)
        ];
        meshInstances[1].visible = false;
        this.entity.addComponent('render', {
            meshInstances: meshInstances,
            layers: this._layers,
            castShadows: false
        });
        this.meshInstances.push(...meshInstances);
    }

    _createTorusMesh(entity, sectorAngle) {
        return createShadowMesh(this.device, entity, 'torus', {
            lightDir: this._lightDir,
            tubeRadius: this._tubeRadius,
            ringRadius: this._ringRadius,
            sectorAngle: sectorAngle,
            segments: TORUS_SEGMENTS
        });
    }

    set tubeRadius(value) {
        this._tubeRadius = value ?? 0.1;
        this.meshInstances[0].mesh = this._createTorusMesh();
    }

    get tubeRadius() {
        return this._tubeRadius;
    }

    set ringRadius(value) {
        this._ringRadius = value ?? 0.1;
        this.meshInstances[0].mesh = this._createTorusMesh();
    }

    get ringRadius() {
        return this._ringRadius;
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
        this.entity = new Entity('plane_' + this.axis);
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
        this.entity.setLocalPosition(this._getPosition());
        this.entity.setLocalScale(this._size, this._size, this._size);
    }

    get size() {
        return this._size;
    }

    set gap(value) {
        this._gap = value ?? 0;
        this.entity.setLocalPosition(this._getPosition());
    }

    get gap() {
        return this._gap;
    }
}

export { AxisShape, AxisArrow, AxisBoxCenter, AxisBoxLine, AxisDisk, AxisPlane };
