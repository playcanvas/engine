Object.assign(pc, function () {
    // Sample Obj model parser. This is not added to built into the engine library by default.
    //
    // To use, first register the parser:
    //
    // // add parser to model resource handler
    // var objParser = new pc.ObjModelParser(this.app.graphicsDevice);
    // this.app.loader.getHandler("model").addParser(objParser, function (url) {
    //     return (pc.path.getExtension(url) === '.obj');
    // });
    //
    // Then load obj as a model asset:
    //
    // var asset = new pc.Asset("MyObj", "model", {
    //    url: "model.obj"
    // });
    // this.app.assets.add(asset);
    // this.app.assets.load(asset);
    var ObjModelParser = function (device) {
        this._device = device;
        this._defaultMaterial = pc.getDefaultMaterial();
    };

    Object.assign(ObjModelParser.prototype, {
        // First draft obj parser
        // probably doesn't handle a lot of the obj spec
        // Known issues:
        // - can't handle meshes larger than 65535 verts
        // - assigns default material to all meshes
        // - doesn't created indexed geometry
        parse: function (input) {
            // expanded vert, uv and normal values from face indices
            var parsed = {
                default: {
                    verts: [],
                    normals: [],
                    uvs: [],
                    indices: []
                }
            };
            var group = "default"; // current group
            var lines = input.split("\n");
            var verts = [], normals = [], uvs = [];
            var i;

            for (i = 0; i < lines.length; i++) {
                var line = lines[i].trim();
                var parts = line.split( /\s+/ );

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
                    var p, r;
                    if (parts.length === 4) {
                        // triangles
                        for (p = 1; p < parts.length; p++) {
                            r = this._parseIndices(parts[p]);
                            parsed[group].verts.push(verts[r[0] * 3], verts[r[0] * 3 + 1], verts[r[0] * 3 + 2]); // expand uvs from indices
                            parsed[group].uvs.push(uvs[r[1] * 2], uvs[r[1] * 2 + 1]); // expand uvs from indices
                            parsed[group].normals.push(normals[r[2] * 3], normals[r[2] * 3 + 1], normals[r[2] * 3 + 2]); // expand normals from indices
                        }

                    } else if (parts.length === 5) {
                        // quads
                        var order = [1, 2, 3, 3, 4, 1]; // split quad into to triangles;
                        p = 1;
                        for (var o = 0; o < order.length; o++) {
                            p = order[o];
                            r = this._parseIndices(parts[p]);
                            parsed[group].verts.push(verts[r[0] * 3], verts[r[0] * 3 + 1], verts[r[0] * 3 + 2]); // expand uvs from indices
                            if (r[1] * 2 < uvs.length)
                                parsed[group].uvs.push(uvs[r[1] * 2], uvs[r[1] * 2 + 1]); // expand uvs from indices
                            if (r[2] * 3 < normals.length)
                                parsed[group].normals.push(normals[r[2] * 3], normals[r[2] * 3 + 1], normals[r[2] * 3 + 2]); // expand normals from indices
                        }
                    } else {
                        console.error(pc.string.format("OBJ uses unsupported {0}-gons", parts.length - 1));
                    }
                }
            }

            var model = new pc.Model();
            var groupNames = Object.keys(parsed);
            var root = new pc.GraphNode();
            // create a new mesh instance for each "group"
            for (i = 0; i < groupNames.length; i++) {
                var currentGroup = parsed[groupNames[i]];
                if (!currentGroup.verts.length) continue;
                if (currentGroup.verts.length > 65535) {
                    console.warn("Warning: mesh with more than 65535 vertices");
                }
                var mesh = pc.createMesh(this._device, currentGroup.verts, {
                    normals: currentGroup.normals,
                    uvs: currentGroup.uvs
                });
                var mi = new pc.MeshInstance(new pc.GraphNode(), mesh, this._defaultMaterial);
                model.meshInstances.push(mi);
                root.addChild(mi.node);
            }
            model.graph = root;
            model.getGraph().syncHierarchy();
            return model;
        },

        _parseIndices: function (str) {
            var result = [];
            var indices = str.split("/");
            for (var i = 0; i < 3; i++) {
                if (indices[i]) {
                    result[i] = parseInt(indices[i], 10) - 1; // convert to 0-indexed
                }
            }
            return result;
        }
    });

    return {
        ObjModelParser: ObjModelParser
    };
}());
