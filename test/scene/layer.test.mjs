import { expect } from 'chai';
import sinon from 'sinon';

import { NullGraphicsDevice } from '../../src/platform/graphics/null/null-graphics-device.js';
import { Layer } from '../../src/scene/layer.js';
import { StandardMaterial } from '../../src/scene/materials/standard-material.js';
import { MeshInstance } from '../../src/scene/mesh-instance.js';
import { Mesh } from '../../src/scene/mesh.js';

describe('Layer mesh membership', function () {
    let device;
    let material;
    let instances;
    let layer;

    beforeEach(function () {
        device = new NullGraphicsDevice({ id: 'layer-test' });
        material = new StandardMaterial();
        const mesh = new Mesh(device);
        instances = Array.from({ length: 8 }, () => {
            const instance = new MeshInstance(mesh, material);
            instance.castShadow = true;
            return instance;
        });
        layer = new Layer();
    });

    afterEach(function () {
        sinon.restore();
        layer.clearMeshInstances();
        instances.forEach(instance => instance.destroy());
        material.destroy();
        device.destroy();
    });

    it('accepts instances without a material and keeps later additions working', function () {
        const noMaterial = new MeshInstance(instances[0].mesh, material);
        noMaterial.material = null;
        const other = new Layer();
        layer._shaderVersion = material._shaderVersion + 1;
        other._shaderVersion = layer._shaderVersion;

        expect(() => layer.addMeshInstances([noMaterial])).to.not.throw();
        expect(layer.meshInstances).to.deep.equal([noMaterial]);

        other.addMeshInstances([instances[0]]);
        expect(material._shaderVersion).to.equal(other._shaderVersion);
        expect(other.meshInstances).to.deep.equal([instances[0]]);

        other.clearMeshInstances();
        noMaterial.destroy();
    });

    it('does not carry materials over from an addition that threw', function () {
        const failing = new StandardMaterial();
        failing.getShaderVariant = () => null;
        const clearVariants = sinon.stub(failing, 'clearVariants').throws(new Error('clear failed'));
        const failingInstance = new MeshInstance(instances[0].mesh, failing);
        const other = new Layer();
        layer._shaderVersion = failing._shaderVersion + 1;
        other._shaderVersion = layer._shaderVersion + 1;

        expect(() => layer.addMeshInstances([failingInstance])).to.throw('clear failed');

        // the next addition, on any layer, only processes its own materials
        expect(() => other.addMeshInstances([instances[0]])).to.not.throw();
        expect(clearVariants.callCount).to.equal(1);
        expect(material._shaderVersion).to.equal(other._shaderVersion);

        other.clearMeshInstances();
        failingInstance.destroy();
        failing.destroy();
    });
});
