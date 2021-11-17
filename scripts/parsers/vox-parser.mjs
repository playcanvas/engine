// vox loading

import { Component } from '../../src/framework/components/component.js';
import { ComponentSystem } from '../../src/framework/components/system.js';

const defaultPalette = new Uint8Array(new Uint32Array([
    0x00000000, 0xffffffff, 0xffccffff, 0xff99ffff, 0xff66ffff, 0xff33ffff, 0xff00ffff, 0xffffccff, 0xffccccff, 0xff99ccff, 0xff66ccff, 0xff33ccff, 0xff00ccff, 0xffff99ff, 0xffcc99ff, 0xff9999ff,
    0xff6699ff, 0xff3399ff, 0xff0099ff, 0xffff66ff, 0xffcc66ff, 0xff9966ff, 0xff6666ff, 0xff3366ff, 0xff0066ff, 0xffff33ff, 0xffcc33ff, 0xff9933ff, 0xff6633ff, 0xff3333ff, 0xff0033ff, 0xffff00ff,
    0xffcc00ff, 0xff9900ff, 0xff6600ff, 0xff3300ff, 0xff0000ff, 0xffffffcc, 0xffccffcc, 0xff99ffcc, 0xff66ffcc, 0xff33ffcc, 0xff00ffcc, 0xffffcccc, 0xffcccccc, 0xff99cccc, 0xff66cccc, 0xff33cccc,
    0xff00cccc, 0xffff99cc, 0xffcc99cc, 0xff9999cc, 0xff6699cc, 0xff3399cc, 0xff0099cc, 0xffff66cc, 0xffcc66cc, 0xff9966cc, 0xff6666cc, 0xff3366cc, 0xff0066cc, 0xffff33cc, 0xffcc33cc, 0xff9933cc,
    0xff6633cc, 0xff3333cc, 0xff0033cc, 0xffff00cc, 0xffcc00cc, 0xff9900cc, 0xff6600cc, 0xff3300cc, 0xff0000cc, 0xffffff99, 0xffccff99, 0xff99ff99, 0xff66ff99, 0xff33ff99, 0xff00ff99, 0xffffcc99,
    0xffcccc99, 0xff99cc99, 0xff66cc99, 0xff33cc99, 0xff00cc99, 0xffff9999, 0xffcc9999, 0xff999999, 0xff669999, 0xff339999, 0xff009999, 0xffff6699, 0xffcc6699, 0xff996699, 0xff666699, 0xff336699,
    0xff006699, 0xffff3399, 0xffcc3399, 0xff993399, 0xff663399, 0xff333399, 0xff003399, 0xffff0099, 0xffcc0099, 0xff990099, 0xff660099, 0xff330099, 0xff000099, 0xffffff66, 0xffccff66, 0xff99ff66,
    0xff66ff66, 0xff33ff66, 0xff00ff66, 0xffffcc66, 0xffcccc66, 0xff99cc66, 0xff66cc66, 0xff33cc66, 0xff00cc66, 0xffff9966, 0xffcc9966, 0xff999966, 0xff669966, 0xff339966, 0xff009966, 0xffff6666,
    0xffcc6666, 0xff996666, 0xff666666, 0xff336666, 0xff006666, 0xffff3366, 0xffcc3366, 0xff993366, 0xff663366, 0xff333366, 0xff003366, 0xffff0066, 0xffcc0066, 0xff990066, 0xff660066, 0xff330066,
    0xff000066, 0xffffff33, 0xffccff33, 0xff99ff33, 0xff66ff33, 0xff33ff33, 0xff00ff33, 0xffffcc33, 0xffcccc33, 0xff99cc33, 0xff66cc33, 0xff33cc33, 0xff00cc33, 0xffff9933, 0xffcc9933, 0xff999933,
    0xff669933, 0xff339933, 0xff009933, 0xffff6633, 0xffcc6633, 0xff996633, 0xff666633, 0xff336633, 0xff006633, 0xffff3333, 0xffcc3333, 0xff993333, 0xff663333, 0xff333333, 0xff003333, 0xffff0033,
    0xffcc0033, 0xff990033, 0xff660033, 0xff330033, 0xff000033, 0xffffff00, 0xffccff00, 0xff99ff00, 0xff66ff00, 0xff33ff00, 0xff00ff00, 0xffffcc00, 0xffcccc00, 0xff99cc00, 0xff66cc00, 0xff33cc00,
    0xff00cc00, 0xffff9900, 0xffcc9900, 0xff999900, 0xff669900, 0xff339900, 0xff009900, 0xffff6600, 0xffcc6600, 0xff996600, 0xff666600, 0xff336600, 0xff006600, 0xffff3300, 0xffcc3300, 0xff993300,
    0xff663300, 0xff333300, 0xff003300, 0xffff0000, 0xffcc0000, 0xff990000, 0xff660000, 0xff330000, 0xff0000ee, 0xff0000dd, 0xff0000bb, 0xff0000aa, 0xff000088, 0xff000077, 0xff000055, 0xff000044,
    0xff000022, 0xff000011, 0xff00ee00, 0xff00dd00, 0xff00bb00, 0xff00aa00, 0xff008800, 0xff007700, 0xff005500, 0xff004400, 0xff002200, 0xff001100, 0xffee0000, 0xffdd0000, 0xffbb0000, 0xffaa0000,
    0xff880000, 0xff770000, 0xff550000, 0xff440000, 0xff220000, 0xff110000, 0xffeeeeee, 0xffdddddd, 0xffbbbbbb, 0xffaaaaaa, 0xff888888, 0xff777777, 0xff555555, 0xff444444, 0xff222222, 0xff111111
]).buffer);

class VoxPalette {
    constructor(paletteData) {
        this.data = paletteData;
        this.tmp = [0, 0, 0, 0];
    }

    clr(index) {
        const tmp = this.tmp;
        tmp[0] = this.data[index * 4 + 0];
        tmp[1] = this.data[index * 4 + 1];
        tmp[2] = this.data[index * 4 + 2];
        tmp[3] = this.data[index * 4 + 3];
        return tmp;
    }
}

// map x->x, y->z, z->y
const _x = 0;
const _y = 2;
const _z = 1;

class VoxFrame {
    constructor(voxelData) {
        this._data = voxelData;
        this._bound = null;
        this._flattened = null;
    }

    get data() {
        return this._data;
    }

    get numVoxels() {
        return this.data.length / 4;
    }

    get bound() {
        if (!this._bound) {
            const data = this.data;
            const min = [data[_x], data[_y], data[_z]];
            const max = [data[_x], data[_y], data[_z]];

            const numVoxels = this.numVoxels;
            for (let i = 1; i < numVoxels; ++i) {
                const x = data[i * 4 + _x];
                const y = data[i * 4 + _y];
                const z = data[i * 4 + _z];
                if (x < min[0]) min[0] = x; else if (x > max[0]) max[0] = x;
                if (y < min[1]) min[1] = y; else if (y > max[1]) max[1] = y;
                if (z < min[2]) min[2] = z; else if (z > max[2]) max[2] = z;
            }
            this._bound = {
                min: min,
                max: max,
                extent: [max[0] - min[0] + 1, max[1] - min[1] + 1, max[2] - min[2] + 1]
            };
        }

        return this._bound;
    }

    get flattened() {
        if (!this._flattened) {
            const data = this.data;
            const min = this.bound.min;
            const max = this.bound.max;
            const extent = this.bound.extent;
            const flattenedData = new Uint8Array(extent[0] * extent[1] * extent[2]);

            const numVoxels = this.numVoxels;
            for (let i = 0; i < numVoxels; ++i) {
                const index = (data[i * 4 + _x] - min[0]) +
                            (data[i * 4 + _y] - min[1]) * extent[0] +
                            (data[i * 4 + _z] - min[2]) * extent[0] * extent[1];
                flattenedData[index] = data[i * 4 + 3];
            }

            this._flattened = {
                extent: extent,
                data: flattenedData,
                at: (x, y, z) => {
                    if (x < 0 || y < 0 || z < 0 || x >= extent[0] || y >= extent[1] || z >= extent[2]) {
                        return 0;
                    }
                    const index = x + y * extent[0] + z * extent[0] * extent[1];
                    return flattenedData[index];
                }
            };
        }
        return this._flattened;
    }
}

class VoxModel {
    constructor() {
        this.frames = [];
        this.palette = null;
    }

    addFrame(frame) {
        this.frames.push(frame);
    }

    setPalette(palette) {
        this.palette = palette;
    }
}

class VoxLoader {
    static load(arrayBuffer) {
        const rs = new pc.ReadStream(arrayBuffer);

        const readChunkHeader = () => {
            return {
                id: rs.readChars(4),
                numBytes: rs.readU32(),
                numChildBytes: rs.readU32()
            };
        };

        const fileId = rs.readChars(4);
        if (fileId !== 'VOX ') {
            console.log('invalid vox header');
            return null;
        }

        const version = rs.readU32();
        if (version !== 150) {
            console.log('invalid vox version');
            return null;
        }

        const mainChunk = readChunkHeader();
        if (mainChunk.id !== 'MAIN') {
            console.log('invalid first chunk in vox');
            return null;
        }

        const voxModel = new VoxModel();
        while (rs.offset < mainChunk.numChildBytes) {
            const chunk = readChunkHeader();

            switch (chunk.id) {
                case 'XYZI': {
                    const numVoxels = rs.readU32();
                    voxModel.addFrame(new VoxFrame(new Uint8Array(arrayBuffer, rs.offset, numVoxels * 4)));
                    rs.skip(numVoxels * 4);
                    break;
                }
                case 'RGBA':
                    voxModel.setPalette(new VoxPalette(new Uint8Array(arrayBuffer, rs.offset, 256 * 4)));
                    rs.skip(256 * 6);
                    break;
                default:
                    // skip other chunks
                    rs.skip(chunk.numBytes + chunk.numChildBytes);
                    break;
            }
        }

        if (!voxModel.palette) {
            voxModel.setPalette(defaultPalette);
        }

        return voxModel;
    }
}

// vox mesh generation

const vset = (v0, v1) => {
    v0[0] = v1[0];
    v0[1] = v1[1];
    v0[2] = v1[2];
};

const vadd = (v0, v1) => {
    v0[0] += v1[0];
    v0[1] += v1[1];
    v0[2] += v1[2];
};

const vsub = (v0, v1) => {
    v0[0] -= v1[0];
    v0[1] -= v1[1];
    v0[2] -= v1[2];
};

class VoxGen {
    static mesh(device, voxMesh, frame) {
        const voxFrame = voxMesh.frames[frame];

        if (!voxFrame) {
            return null;
        }

        const flattened = voxFrame.flattened;

        const positions = [];
        const normals = [];
        const colors = [];
        const indices = [];

        const pos = [0, 0, 0];
        const tmp = [0, 0, 0];

        const quad = (axis1, axis2, normal, paletteIndex) => {
            // indices
            const baseIndex = positions.length / 3;
            indices.push(baseIndex, baseIndex + 1, baseIndex + 2, baseIndex, baseIndex + 2, baseIndex + 3);

            // positions
            vset(tmp, pos);
            positions.push(tmp[0], tmp[1], tmp[2]);
            vadd(tmp, axis1);
            positions.push(tmp[0], tmp[1], tmp[2]);
            vadd(tmp, axis2);
            positions.push(tmp[0], tmp[1], tmp[2]);
            vsub(tmp, axis1);
            positions.push(tmp[0], tmp[1], tmp[2]);

            // normals
            normals.push(normal[0], normal[1], normal[2]);
            normals.push(normal[0], normal[1], normal[2]);
            normals.push(normal[0], normal[1], normal[2]);
            normals.push(normal[0], normal[1], normal[2]);

            // colors
            const clr = voxMesh.palette.clr(paletteIndex - 1);
            colors.push(clr[0], clr[1], clr[2], clr[3]);
            colors.push(clr[0], clr[1], clr[2], clr[3]);
            colors.push(clr[0], clr[1], clr[2], clr[3]);
            colors.push(clr[0], clr[1], clr[2], clr[3]);
        };

        const posX = [1, 0, 0];
        const posY = [0, 1, 0];
        const posZ = [0, 0, 1];
        const negX = [-1, 0, 0];
        const negY = [0, -1, 0];
        const negZ = [0, 0, -1];

        // generate voxel mesh from flattened voxel data
        for (let z = 0; z <= flattened.extent[2]; ++z) {
            pos[2] = z;
            for (let y = 0; y <= flattened.extent[1]; ++y) {
                pos[1] = y;
                for (let x = 0; x <= flattened.extent[0]; ++x) {
                    pos[0] = x;

                    const v = flattened.at(x, y, z);
                    const px = flattened.at(x - 1, y, z);
                    const py = flattened.at(x, y - 1, z);
                    const pz = flattened.at(x, y, z - 1);

                    if (v !== 0) {
                        if (px === 0) {
                            quad(posZ, posY, negX, v);
                        }
                        if (py === 0) {
                            quad(posX, posZ, negY, v);
                        }
                        if (pz === 0) {
                            quad(posY, posX, negZ, v);
                        }
                    } else {
                        if (px !== 0) {
                            quad(posY, posZ, posX, px);
                        }
                        if (py !== 0) {
                            quad(posZ, posX, posY, py);
                        }
                        if (pz !== 0) {
                            quad(posX, posY, posZ, pz);
                        }
                    }
                }
            }
        }

        // construct the mesh
        const mesh = new pc.Mesh(device);
        mesh.setPositions(positions);
        mesh.setNormals(normals);
        mesh.setColors32(colors);
        mesh.setIndices(indices);
        mesh.update();

        return mesh;
    }
}

// container resource

class VoxContainerResource {
    constructor(device, voxModel) {
        this.device = device;
        this.voxModel = voxModel;
    }

    instantiateModelEntity(options) {
        return null;
    }

    instantiateRenderEntity(options) {
        const material = new pc.StandardMaterial();
        material.diffuseVertexColor = true;

        // generate animation frames
        const meshInstances = this.voxModel.frames.map((f, i) => {
            const mesh = VoxGen.mesh(this.device, this.voxModel, i);
            return new pc.MeshInstance(mesh, material);
        });

        const entity = new pc.Entity();
        entity.addComponent('render', {
            material: material,
            meshInstances: meshInstances
        });

        entity.addComponent('voxanim', { });

        this.renders = [];

        return entity;
    }
}

// component / system support

const VoxAnimComponentSchema =  ['enabled'];

class VoxAnimComponentData {
    constructor() {
        this.enabled = true;
    }
}

class VoxAnimComponent extends Component {
    constructor(system, entity) {
        super(system, entity);

        this.playing = true;
        this.timer = 0;
        this.fps = 10;
    }

    update(dt) {
        if (this.playing) {
            this.timer += dt;
        }

        const meshInstances = this.entity.render?.meshInstances || this.entity.model?.meshInstances;
        if (meshInstances) {
            const frame = Math.floor(this.timer * this.fps) % meshInstances.length;
            for (let i = 0; i < meshInstances.length; ++i) {
                meshInstances[i].visible = (i === frame);
            }
        }
    }
}

class VoxAnimSystem extends ComponentSystem {
    constructor(app) {
        super(app);

        this.id = 'voxanim';
        this.ComponentType = VoxAnimComponent;
        this.DataType = VoxAnimComponentData;

        this.schema = VoxAnimComponentSchema;

        this.app.systems.on('update', this.onUpdate, this);
    }

    initializeComponentData(component, data, properties) {
        properties = [
            'playing',
            'timer',
            'fps'
        ];

        for (let i = 0; i < properties.length; i++) {
            if (data.hasOwnProperty(properties[i])) {
                component[properties[i]] = data[properties[i]];
            }
        }

        super.initializeComponentData(component, data, VoxAnimComponentSchema);
    }

    cloneComponent(entity, clone) {
        const srcComponent = entity.voxanim;
        const cloneData = {
            playing: srcComponent.playing,
            timer: srcComponent.timer,
            fps: srcComponent.fps
        };

        return this.addComponent(clone, cloneData);
    }

    onUpdate(dt) {
        const components = this.store;
        for (const id in components) {
            if (components.hasOwnProperty(id)) {
                const entity = components[id].entity;
                if (entity.enabled) {
                    const component = entity.voxanim;
                    if (component.enabled) {
                        component.update(dt);
                    }
                }
            }
        }
    }

    destroy() {
        super.destroy();
        this.app.systems.off('update', this.onUpdate, this);
    }
}

Component._buildAccessors(VoxAnimComponent.prototype, VoxAnimComponentSchema);

// parser

class VoxParser {
    constructor(device, assets, maxRetries) {
        this._device = device;
        this._assets = assets;
        this._maxRetries = maxRetries;
    }

    load(url, callback, asset) {
        pc.Asset.fetchArrayBuffer(url.load, (err, result) => {
            if (err) {
                callback(err);
            } else {
                callback(null, new VoxContainerResource(this._device, VoxLoader.load(result)));
            }
        }, asset, this._maxRetries);
    }

    open(url, data, asset) {
        return data;
    }
}

const registerVoxParser = (app) => {
    // register the animation component system
    app.systems.add(new VoxAnimSystem(app));

    // register resource handler
    app.loader.getHandler("container").parsers.vox = new VoxParser(app.graphicsDevice, app.assets);
};

export {
    registerVoxParser
};
