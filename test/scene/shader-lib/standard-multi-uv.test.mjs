import { expect } from 'chai';
import { stub } from 'sinon';

import {
    SEMANTIC_NORMAL, SEMANTIC_POSITION, SEMANTIC_TEXCOORD, TYPE_FLOAT32
} from '../../../src/platform/graphics/constants.js';
import { Texture } from '../../../src/platform/graphics/texture.js';
import { VertexFormat } from '../../../src/platform/graphics/vertex-format.js';
import { CameraShaderParams } from '../../../src/scene/camera-shader-params.js';
import { SHADER_FORWARD, SHADERDEF_INSTANCING } from '../../../src/scene/constants.js';
import { StandardMaterial } from '../../../src/scene/materials/standard-material.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

describe('StandardMaterial uv sets', function () {

    let app;

    const allSets = [0, 1, 2, 3, 4, 5, 6, 7];

    beforeEach(function () {
        jsdomSetup();
        app = createApp();

        // the clustered lighting shader chunks are registered by the renderer, which does not run
        // in these tests - disable clustered lighting so they are not required
        app.scene.clusteredLightingEnabled = false;
    });

    afterEach(function () {
        app.destroy();
        app = null;
        jsdomTeardown();
    });

    /**
     * @param {number[]} uvSets - The indices of the uv sets the format contains.
     * @returns {VertexFormat} A vertex format with position, normal and the given uv sets.
     */
    const createFormat = uvSets => new VertexFormat(app.graphicsDevice, [
        { semantic: SEMANTIC_POSITION, components: 3, type: TYPE_FLOAT32 },
        { semantic: SEMANTIC_NORMAL, components: 3, type: TYPE_FLOAT32 },
        ...uvSets.map(set => ({ semantic: SEMANTIC_TEXCOORD + set, components: 2, type: TYPE_FLOAT32 }))
    ]);

    /**
     * @param {Object<string, number>} maps - Map names mapped to the uv set they sample, for
     * example `{ diffuse: 3, emissive: 5 }`.
     * @returns {StandardMaterial} The material.
     */
    const createMaterial = (maps) => {
        const material = new StandardMaterial();
        for (const [name, uvSet] of Object.entries(maps)) {
            material[`${name}Map`] = new Texture(app.graphicsDevice, { name, width: 4, height: 4 });
            material[`${name}MapUv`] = uvSet;
        }
        material.update();
        return material;
    };

    /**
     * @param {StandardMaterial} material - The material.
     * @param {number[]} [uvSets] - The uv sets the mesh provides, all eight by default.
     * @param {number} [objDefs] - The object shader defines, none by default.
     * @returns {{ vshader: string, fshader: string, attributes: object }} The generated forward
     * pass shader.
     */
    const generate = (material, uvSets = allSets, objDefs = 0) => {
        const shader = material.getShaderVariant({
            device: app.graphicsDevice,
            scene: app.scene,
            objDefs: objDefs,
            pass: SHADER_FORWARD,
            cameraShaderParams: new CameraShaderParams(),
            vertexFormat: createFormat(uvSets)
        });

        // a null source means the shader failed to preprocess
        const { vshader, fshader, attributes } = shader.definition;
        expect(vshader).to.be.a('string');
        expect(fshader).to.be.a('string');
        return { vshader, fshader, attributes };
    };

    it('samples a map from any of the eight uv sets', function () {
        for (const set of allSets) {
            const { vshader, fshader, attributes } = generate(createMaterial({ diffuse: set }));

            expect(attributes[`vertex_texCoord${set}`]).to.equal(`TEXCOORD${set}`);
            expect(vshader).to.include(`vertex_texCoord${set}`);
            expect(vshader).to.include(`vUv${set}`);
            expect(fshader).to.include(`vUv${set}`);
            expect(fshader).to.include('texture_diffuseMap');

            // only the set the map uses reaches the shader
            for (const other of allSets) {
                if (other !== set) {
                    expect(attributes).to.not.have.property(`vertex_texCoord${other}`);
                    expect(vshader).to.not.include(`vertex_texCoord${other}`);
                }
            }
        }
    });

    it('combines maps from several uv sets in one shader', function () {
        const { vshader, fshader, attributes } = generate(createMaterial({ diffuse: 2, emissive: 5, ao: 7 }));

        for (const set of [2, 5, 7]) {
            expect(attributes[`vertex_texCoord${set}`]).to.equal(`TEXCOORD${set}`);
            expect(vshader).to.include(`vUv${set} = uv${set}`);
            expect(fshader).to.include(`vUv${set}`);
        }
        for (const set of [0, 1, 3, 4, 6]) {
            expect(attributes).to.not.have.property(`vertex_texCoord${set}`);
        }
    });

    it('routes a transformed map on a high uv set through the uv transform path', function () {
        const material = createMaterial({ diffuse: 6 });
        material.diffuseMapTiling.set(2, 2);
        material.update();

        const { vshader, fshader } = generate(material);

        expect(vshader).to.include('vertex_texCoord6');
        expect(vshader).to.include('texture_diffuseMapTransform0');
        expect(vshader).to.include('vUV6_');
        expect(fshader).to.include('vUV6_');

        // the set is only sampled transformed, so the untransformed varying is not emitted
        expect(vshader).to.not.include('vUv6');
        expect(fshader).to.not.include('vUv6');
    });

    it('samples a lightmap from a high uv set', function () {
        const { vshader, fshader, attributes } = generate(createMaterial({ light: 5 }));

        expect(attributes.vertex_texCoord5).to.equal('TEXCOORD5');
        expect(vshader).to.include('vUv5');
        expect(fshader).to.include('texture_lightMap');
        expect(fshader).to.include('vUv5');
    });

    /**
     * @param {StandardMaterial} material - The material.
     * @param {number} objDefs - The object shader defines.
     * @returns {string[]} The attribute location collisions asserted while generating the shader,
     * each as the message of one assert.
     */
    const collisions = (material, objDefs) => {
        const error = stub(console, 'error');
        try {
            generate(material, allSets, objDefs);
        } finally {
            error.restore();
        }
        return error.getCalls().map(call => call.args.join(' ')).filter(message => message.includes('attribute location'));
    };

    it('asserts when a uv set shares its attribute location with the default instancing format', function () {
        // uv sets 6 and 7 sit on the locations of the first two instance matrix rows
        for (const [set, line] of [[6, 'instance_line1'], [7, 'instance_line2']]) {
            const messages = collisions(createMaterial({ diffuse: set }), SHADERDEF_INSTANCING);
            expect(messages).to.have.lengthOf(1);
            expect(messages[0]).to.include(line);
            expect(messages[0]).to.include(`vertex_texCoord${set}`);
        }

        // the other sets are free to combine with instancing
        for (const set of [0, 1, 2, 3, 4, 5]) {
            expect(collisions(createMaterial({ diffuse: set }), SHADERDEF_INSTANCING)).to.have.lengthOf(0);
        }
    });

    it('asserts when a uv set shares its attribute location with the msdf text attributes', function () {
        const msdf = (set) => {
            const material = createMaterial({ msdf: 0, diffuse: set });
            material.msdfTextAttribute = true;
            material.update();
            return material;
        };

        expect(collisions(msdf(3), 0)[0]).to.include('vertex_outlineParameters');
        expect(collisions(msdf(4), 0)[0]).to.include('vertex_shadowParameters');
        expect(collisions(msdf(5), 0)).to.have.lengthOf(0);
    });

    it('drops a map assigned to a uv set the mesh does not provide', function () {
        const material = createMaterial({ diffuse: 6 });

        const missing = generate(material, [0, 1, 2, 3]);
        expect(missing.attributes).to.not.have.property('vertex_texCoord6');
        expect(missing.vshader).to.not.include('vertex_texCoord6');
        expect(missing.fshader).to.not.include('texture_diffuseMap');

        const present = generate(material, [0, 1, 2, 3, 6]);
        expect(present.attributes.vertex_texCoord6).to.equal('TEXCOORD6');
        expect(present.fshader).to.include('texture_diffuseMap');
    });
});
