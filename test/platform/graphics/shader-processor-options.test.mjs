import { expect } from 'chai';

import { BindGroupFormat, BindTextureFormat } from '../../../src/platform/graphics/bind-group-format.js';
import {
    BINDGROUP_MATERIAL, BINDGROUP_MESH, BINDGROUP_MESH_UB, BINDGROUP_VIEW, bindGroupNames,
    SHADERSTAGE_FRAGMENT, UNIFORMTYPE_FLOAT, UNIFORMTYPE_MAT4, UNIFORMTYPE_VEC3
} from '../../../src/platform/graphics/constants.js';
import { ScopeSpace } from '../../../src/platform/graphics/scope-space.js';
import { ShaderProcessorOptions } from '../../../src/platform/graphics/shader-processor-options.js';
import { UniformBufferFormat, UniformFormat } from '../../../src/platform/graphics/uniform-buffer-format.js';

describe('bind group indices', function () {

    it('are contiguous and match the bind group names', function () {
        expect(BINDGROUP_VIEW).to.equal(0);
        expect(BINDGROUP_MATERIAL).to.equal(1);
        expect(BINDGROUP_MESH).to.equal(2);
        expect(BINDGROUP_MESH_UB).to.equal(3);
        expect(bindGroupNames).to.deep.equal(['view', 'material', 'mesh', 'mesh_ub']);
    });

});

describe('ShaderProcessorOptions', function () {

    const webgl = { isWebGPU: false };
    const webgpu = { isWebGPU: true };

    const createDevice = () => {
        let implKey = 0;
        return {
            scope: new ScopeSpace('test'),
            createBindGroupFormatImpl() {
                return { key: implKey++, destroy() {} };
            }
        };
    };

    const viewFormat = (device, uniforms = [new UniformFormat('matrix_viewProjection', UNIFORMTYPE_MAT4)]) => {
        return new UniformBufferFormat(device, uniforms);
    };

    describe('#generateKey', function () {

        it('is identical for options built from equivalent formats', function () {
            const device = createDevice();
            const a = new ShaderProcessorOptions(viewFormat(device));
            const b = new ShaderProcessorOptions(viewFormat(device));
            expect(a.generateKey(webgl)).to.equal(b.generateKey(webgl));
        });

        it('differs when the view uniform format layout differs', function () {
            const device = createDevice();
            const a = new ShaderProcessorOptions(viewFormat(device));
            const b = new ShaderProcessorOptions(viewFormat(device, [
                new UniformFormat('matrix_viewProjection', UNIFORMTYPE_MAT4),
                new UniformFormat('view_position', UNIFORMTYPE_VEC3)
            ]));
            expect(a.generateKey(webgl)).to.not.equal(b.generateKey(webgl));
        });

        it('differs when the same bind group format is assigned to another bind group index', function () {
            const device = createDevice();
            const textures = [new BindTextureFormat('sceneColor', SHADERSTAGE_FRAGMENT)];

            const a = new ShaderProcessorOptions(viewFormat(device));
            a.bindGroupFormats[BINDGROUP_VIEW] = new BindGroupFormat(device, textures);

            const b = new ShaderProcessorOptions(viewFormat(device));
            b.bindGroupFormats[BINDGROUP_MATERIAL] = new BindGroupFormat(device, textures);

            expect(a.generateKey(webgl)).to.not.equal(b.generateKey(webgl));
        });

        it('includes the vertex format only on WebGPU', function () {
            const device = createDevice();
            const withFormat = new ShaderProcessorOptions(viewFormat(device), { shaderProcessingHashString: 'position' });
            const withoutFormat = new ShaderProcessorOptions(viewFormat(device));

            expect(withFormat.generateKey(webgl)).to.equal(withoutFormat.generateKey(webgl));
            expect(withFormat.generateKey(webgpu)).to.not.equal(withoutFormat.generateKey(webgpu));
        });

        it('does not depend on the identity of the format objects', function () {
            const device = createDevice();
            const options = new ShaderProcessorOptions(viewFormat(device));
            const key = options.generateKey(webgl);

            // a new set of formats with the same layout reproduces the key
            const other = new ShaderProcessorOptions(viewFormat(device, [new UniformFormat('matrix_viewProjection', UNIFORMTYPE_MAT4)]));
            expect(other.generateKey(webgl)).to.equal(key);

            // while a type change of a single uniform does not
            const changed = new ShaderProcessorOptions(viewFormat(device, [new UniformFormat('matrix_viewProjection', UNIFORMTYPE_FLOAT)]));
            expect(changed.generateKey(webgl)).to.not.equal(key);
        });

    });

});
