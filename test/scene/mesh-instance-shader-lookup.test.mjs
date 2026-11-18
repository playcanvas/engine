import { expect } from 'chai';
import { stub } from 'sinon';

import { SHADER_FORWARD, SHADER_SHADOW } from '../../src/scene/constants.js';
import { GraphNode } from '../../src/scene/graph-node.js';
import { StandardMaterial } from '../../src/scene/materials/standard-material.js';
import { MeshInstance } from '../../src/scene/mesh-instance.js';
import { Mesh } from '../../src/scene/mesh.js';
import { createGraphicsDevice } from '../device.mjs';

// MeshInstance#getShaderInstance returns the shader instance of the last lookup of a pass again when
// it is asked with the same lights, shader defines and camera parameters, and looks up again
// whenever one of them changed or the shaders were cleared.
describe('MeshInstance#getShaderInstance', function () {
    let device;
    let material;
    let meshInstance;
    let variant;

    const lights = hash => ({ hash });
    const camera = hash => ({ hash });

    beforeEach(function () {
        device = createGraphicsDevice({ id: 'shader-lookup-test' });
        material = new StandardMaterial();
        meshInstance = new MeshInstance(new Mesh(device), material, new GraphNode('node'));
        // a new shader object per variant compiled
        variant = stub(material, 'getShaderVariant').callsFake(() => ({}));
    });

    afterEach(function () {
        variant.restore();
        meshInstance.destroy();
        material.destroy();
        device.destroy();
    });

    const get = (pass, l, c) => meshInstance.getShaderInstance(pass, l, null, c, null);

    it('returns the same shader instance for the same lookup', function () {
        const a = get(SHADER_FORWARD, lights(1), camera(7));
        const b = get(SHADER_FORWARD, lights(1), camera(7));
        expect(b).to.equal(a);
        expect(variant.callCount).to.equal(1);
    });

    it('keeps the passes apart', function () {
        const forward = get(SHADER_FORWARD, lights(1), camera(7));
        const shadow = get(SHADER_SHADOW, lights(1), camera(7));
        expect(shadow).to.not.equal(forward);
        expect(get(SHADER_FORWARD, lights(1), camera(7))).to.equal(forward);
        expect(get(SHADER_SHADOW, lights(1), camera(7))).to.equal(shadow);
        expect(variant.callCount).to.equal(2);
    });

    it('looks up again when the lights, the camera parameters or the shader defines change', function () {
        const a = get(SHADER_FORWARD, lights(1), camera(7));
        const b = get(SHADER_FORWARD, lights(2), camera(7));
        expect(b).to.not.equal(a);
        const c = get(SHADER_FORWARD, lights(2), camera(8));
        expect(c).to.not.equal(b);
        meshInstance._shaderDefs ^= 1 << 20;
        const d = get(SHADER_FORWARD, lights(2), camera(8));
        expect(d).to.not.equal(c);

        // back to the first values: the instance cached for them, without a new variant
        meshInstance._shaderDefs ^= 1 << 20;
        expect(get(SHADER_FORWARD, lights(1), camera(7))).to.equal(a);
        expect(variant.callCount).to.equal(4);
    });

    it('looks up again after the shaders were cleared', function () {
        const a = get(SHADER_FORWARD, lights(1), camera(7));
        meshInstance.clearShaders();
        const b = get(SHADER_FORWARD, lights(1), camera(7));
        expect(b).to.not.equal(a);
        expect(b.shader).to.equal(a.shader);  // the material keeps its variant
    });

    it('looks up again after the material changed its shaders', function () {
        const a = get(SHADER_FORWARD, lights(1), camera(7));
        material.clearVariants();
        const b = get(SHADER_FORWARD, lights(1), camera(7));
        expect(b).to.not.equal(a);
        expect(variant.callCount).to.equal(2);
    });
});
