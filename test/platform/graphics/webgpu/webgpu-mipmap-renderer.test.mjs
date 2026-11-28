import { expect } from 'chai';

import { MIPMAPFILTER_BOX, MIPMAPFILTER_GAUSSIAN } from '../../../../src/platform/graphics/constants.js';
import { WebgpuDebug } from '../../../../src/platform/graphics/webgpu/webgpu-debug.js';
import { WebgpuMipmapRenderer } from '../../../../src/platform/graphics/webgpu/webgpu-mipmap-renderer.js';

// The mipmap renderer keeps the views of each mip level of a texture, and the bind groups sampling
// them, so a texture whose mipmaps are generated every frame - a render target - does not create
// new ones each time.
describe('WebgpuMipmapRenderer#generate', function () {

    let skipValidation;
    let counts;
    let renderer;
    let passes;

    // a render pass encoder recording the bind groups it is given
    const createPassEncoder = () => ({
        setPipeline() {},
        setBindGroup(index, bindGroup) {
            passes.push(bindGroup);
        },
        draw() {},
        end() {}
    });

    // a 2D texture with the given number of mip levels, on its own GPU texture
    const createTexture = (mipLevelCount, options = {}) => ({
        desc: { mipLevelCount, format: 'rgba8unorm' },
        texture: { name: 'texture', volume: false, cubemap: !!options.cubemap, array: false },
        gpuTexture: {},
        createView(desc) {
            counts.views++;
            return { desc };
        }
    });

    beforeEach(function () {
        skipValidation = WebgpuDebug.skipValidation;
        WebgpuDebug.skipValidation = true;
        counts = { views: 0, bindGroups: 0 };
        passes = [];

        const pipelines = new Map();
        const device = {
            wgpu: {
                createSampler: () => ({}),
                createBindGroup: (desc) => {
                    counts.bindGroups++;
                    return { desc };
                }
            },
            getCommandEncoder: () => ({ beginRenderPass: () => createPassEncoder() }),
            pushMarker() {},
            popMarker() {},
            pipeline: null
        };

        // the renderer without its shaders, which a test has no device to compile: a pipeline per
        // variant and format stands in for each
        renderer = Object.create(WebgpuMipmapRenderer.prototype);
        renderer.device = device;
        renderer.pipelineCache = new Map();
        renderer.shaders = new Map();
        renderer.linearSampler = null;
        renderer.minSampler = {};
        renderer._passes = new WeakMap();
        renderer.getPipeline = (variant, format) => {
            const key = `${variant}-${format}`;
            if (!pipelines.has(key)) {
                pipelines.set(key, { key, getBindGroupLayout: () => ({}) });
            }
            return pipelines.get(key);
        };
    });

    afterEach(function () {
        WebgpuDebug.skipValidation = skipValidation;
    });

    it('creates the views and bind groups of a texture once', function () {
        const texture = createTexture(4);

        renderer.generate(texture);
        expect(counts.views).to.equal(4);
        expect(counts.bindGroups).to.equal(3);
        expect(passes).to.have.lengthOf(3);
        const first = passes.slice();

        renderer.generate(texture);
        renderer.generate(texture);
        expect(counts.views).to.equal(4);
        expect(counts.bindGroups).to.equal(3);

        // each generation renders all levels again, with the same bind groups
        expect(passes).to.have.lengthOf(9);
        expect(passes.slice(3, 6)).to.deep.equal(first);
        expect(passes.slice(6, 9)).to.deep.equal(first);
    });

    it('samples each level from the view of the level above it', function () {
        const texture = createTexture(3);
        renderer.generate(texture);

        const levels = passes.map(bindGroup => bindGroup.desc.entries[1].resource.desc.baseMipLevel);
        expect(levels).to.deep.equal([0, 1]);
    });

    it('creates new views for a recreated GPU texture', function () {
        const texture = createTexture(3);
        renderer.generate(texture);
        expect(counts.views).to.equal(3);

        texture.gpuTexture = {};
        renderer.generate(texture);
        expect(counts.views).to.equal(6);
        expect(counts.bindGroups).to.equal(4);
    });

    it('creates new bind groups when the filter changes the pipeline and the sampler', function () {
        const texture = createTexture(3);
        renderer.generate(texture, undefined, MIPMAPFILTER_BOX);
        renderer.generate(texture, undefined, MIPMAPFILTER_GAUSSIAN);
        expect(counts.bindGroups).to.equal(4);

        // and keeps them while the filter stays
        renderer.generate(texture, undefined, MIPMAPFILTER_GAUSSIAN);
        expect(counts.bindGroups).to.equal(4);
    });

    it('keeps the views of each face of a cubemap', function () {
        const texture = createTexture(3, { cubemap: true });

        renderer.generate(texture, 2);
        expect(counts.views).to.equal(3);

        renderer.generate(texture, 4);
        expect(counts.views).to.equal(6);

        renderer.generate(texture);
        expect(counts.views).to.equal(18);

        renderer.generate(texture);
        expect(counts.views).to.equal(18);
        expect(counts.bindGroups).to.equal(12);
    });

    it('does nothing for a texture without mipmaps', function () {
        renderer.generate(createTexture(1));
        expect(counts.views).to.equal(0);
        expect(passes).to.have.lengthOf(0);
    });
});
