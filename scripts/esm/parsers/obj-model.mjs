import { Geometry, GraphNode, Http, Mesh, MeshInstance, Model, StandardMaterial } from 'playcanvas';

/**
 * A basic OBJ model parser for the `model` resource handler. It is not built into the engine
 * library by default and probably doesn't handle a lot of the OBJ spec.
 *
 * Known issues:
 *
 * - Can't handle meshes larger than 65535 vertices.
 * - Assigns a default material to all meshes.
 * - Doesn't create indexed geometry.
 *
 * @example
 * import { ObjModelParser } from 'playcanvas/scripts/esm/parsers/obj-model.mjs';
 *
 * // add the parser to the model resource handler
 * app.loader.getHandler('model').addParser(new ObjModelParser(app.graphicsDevice));
 *
 * // then load .obj files as model assets
 * const asset = new pc.Asset('MyObj', 'model', { url: 'model.obj' });
 * app.assets.add(asset);
 * app.assets.load(asset);
 * @category Parsers
 */
class ObjModelParser {
    constructor(device) {
        this._device = device;
        this._defaultMaterial = new StandardMaterial();
    }

    canParse(context) {
        return context.ext === 'obj';
    }

    load(url, callback, asset) {
        this.handler.fetch(url, Http.ResponseType.TEXT, (err, response) => {
            if (err) {
                callback(err);
            } else {
                this.parse(response, callback);
            }
        }, asset);
    }

    parse(input, callback) {
        // expanded vert, uv and normal values from face indices
        const parsed = {
            default: {
                verts: [],
                normals: [],
                uvs: [],
                indices: []
            }
        };
        let group = 'default'; // current group
        const lines = input.split('\n');
        const verts = [], normals = [], uvs = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            const parts = line.split(/\s+/);

            if (line[0] === 'v') {
                if (parts[0] === 'v') {
                    verts.push(parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3]));
                } else if (parts[0] === 'vn') {
                    normals.push(parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3]));
                } else if (parts[0] === 'vt') {
                    uvs.push(parseFloat(parts[1]), parseFloat(parts[2]));
                }
            } else if (line[0] === 'g' || line[0] === 'o' || line[0] === 'u') {
                // split into groups for 'g' 'o' and 'usemtl' elements
                group = parts[1]; // only first value for name for now
                if (!parsed[group]) {
                    parsed[group] = {
                        verts: [],
                        normals: [],
                        uvs: []
                    };
                }
            } else if (line[0] === 'f') {
                if (parts.length === 4) {
                    // triangles
                    for (let p = 1; p < parts.length; p++) {
                        const r = this._parseIndices(parts[p]);
                        parsed[group].verts.push(verts[r[0] * 3], verts[r[0] * 3 + 1], verts[r[0] * 3 + 2]); // expand uvs from indices
                        if (r[1] * 2 < uvs.length) {
                            parsed[group].uvs.push(uvs[r[1] * 2], uvs[r[1] * 2 + 1]);
                        } // expand uvs from indices
                        if (r[2] * 3 < normals.length) {
                            parsed[group].normals.push(normals[r[2] * 3], normals[r[2] * 3 + 1], normals[r[2] * 3 + 2]);
                        } // expand normals from indices
                    }

                } else if (parts.length === 5) {
                    // quads
                    const order = [1, 2, 3, 3, 4, 1]; // split quad into to triangles;
                    for (let o = 0; o < order.length; o++) {
                        const p = order[o];
                        const r = this._parseIndices(parts[p]);
                        parsed[group].verts.push(verts[r[0] * 3], verts[r[0] * 3 + 1], verts[r[0] * 3 + 2]); // expand uvs from indices
                        if (r[1] * 2 < uvs.length) {
                            parsed[group].uvs.push(uvs[r[1] * 2], uvs[r[1] * 2 + 1]);
                        } // expand uvs from indices
                        if (r[2] * 3 < normals.length) {
                            parsed[group].normals.push(normals[r[2] * 3], normals[r[2] * 3 + 1], normals[r[2] * 3 + 2]);
                        } // expand normals from indices
                    }
                } else {
                    console.error(`OBJ uses unsupported ${parts.length - 1}-gons`);
                }
            }
        }

        const model = new Model();
        const groupNames = Object.keys(parsed);
        const root = new GraphNode();
        // create a new mesh instance for each "group"
        for (let i = 0; i < groupNames.length; i++) {
            const currentGroup = parsed[groupNames[i]];
            if (!currentGroup.verts.length) continue;
            if (currentGroup.verts.length > 65535) {
                console.warn('Warning: mesh with more than 65535 vertices');
            }

            const geom = new Geometry();
            geom.positions = currentGroup.verts;
            if (currentGroup.normals.length > 0) {
                geom.normals = currentGroup.normals;
            }
            if (currentGroup.uvs.length > 0) {
                geom.uvs = currentGroup.uvs;
            }

            const mesh = Mesh.fromGeometry(this._device, geom);

            const mi = new MeshInstance(mesh, this._defaultMaterial, new GraphNode());
            model.meshInstances.push(mi);
            root.addChild(mi.node);
        }
        model.graph = root;
        model.getGraph().syncHierarchy();
        callback(null, model);
    }

    _parseIndices(str) {
        const result = [];
        const indices = str.split('/');
        for (let i = 0; i < 3; i++) {
            if (indices[i]) {
                result[i] = parseInt(indices[i], 10) - 1; // convert to 0-indexed
            }
        }
        return result;
    }
}

export { ObjModelParser };
