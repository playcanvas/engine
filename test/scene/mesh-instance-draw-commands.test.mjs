import { expect } from 'chai';

import { Camera } from '../../src/scene/camera.js';
import { ShaderMaterial } from '../../src/scene/materials/shader-material.js';
import { MeshInstance } from '../../src/scene/mesh-instance.js';
import { Mesh } from '../../src/scene/mesh.js';
import { createGraphicsDevice } from '../device.mjs';

describe('MeshInstance draw commands', function () {

    let device;
    let meshInstance;

    beforeEach(function () {
        device = createGraphicsDevice({ width: 1, height: 1 });

        // only WebGPU opts into indirect draw, and these tests cover the draw command
        // bookkeeping rather than the platform support for it
        device.supportsIndirectDraw = true;

        meshInstance = new MeshInstance(new Mesh(device), new ShaderMaterial());
    });

    afterEach(function () {
        meshInstance.destroy();
        device.destroy();
    });

    it('reuses cached commands instead of allocating a set every frame', function () {
        meshInstance.setIndirect(null, 3);
        const commands = meshInstance.getDrawCommands(null);
        expect(commands.slotIndex).to.equal(3);

        device.frameEnd();
        meshInstance.setIndirect(null, 7);

        expect(meshInstance.getDrawCommands(null)).to.equal(commands);
        expect(commands.slotIndex).to.equal(7);
    });

    it('expires indirect commands at the end of the frame, as their slot is recycled', function () {
        meshInstance.setIndirect(null, 3);
        expect(meshInstance.getDrawCommands(null)).to.exist;

        device.frameEnd();
        expect(meshInstance.getDrawCommands(null)).to.be.undefined;

        // and they come back when assigned again
        meshInstance.setIndirect(null, 3);
        expect(meshInstance.getDrawCommands(null)).to.exist;
    });

    it('keeps multi-draw commands across frames', function () {
        const commands = meshInstance.setMultiDraw(null, 2);

        device.frameEnd();
        device.frameEnd();

        expect(meshInstance.getDrawCommands(null)).to.equal(commands);
    });

    it('replaces a cached set when a key switches from indirect to multi-draw', function () {
        meshInstance.setIndirect(null, 3);
        const indirect = meshInstance.getDrawCommands(null);
        device.frameEnd();

        const commands = meshInstance.setMultiDraw(null, 2);
        expect(commands).to.not.equal(indirect);
        expect(commands.multiDraw).to.be.true;
        expect(meshInstance.getDrawCommands(null)).to.equal(commands);

        // and they stay valid from there on, like any other multi-draw commands
        device.frameEnd();
        expect(meshInstance.getDrawCommands(null)).to.equal(commands);
    });

    it('replaces a cached set when a key switches from multi-draw to indirect', function () {
        const multi = meshInstance.setMultiDraw(null, 2);
        device.frameEnd();

        meshInstance.setIndirect(null, 3);
        const commands = meshInstance.getDrawCommands(null);

        // reusing the multi-draw set would point the indirect draw at its storage buffer rather
        // than at the device indirect draw buffer
        expect(commands).to.not.equal(multi);
        expect(commands.multiDraw).to.be.false;
        expect(commands.slotIndex).to.equal(3);
    });

    it('keys commands by camera id rather than by the camera itself', function () {
        const camera = new Camera(device);
        meshInstance.setIndirect({ camera }, 5);

        expect([...meshInstance.drawCommands.keys()]).to.deep.equal([camera.id]);
        expect(meshInstance.getDrawCommands(camera).slotIndex).to.equal(5);
    });

    it('prefers a camera specific set over the shared one, ignoring expired sets', function () {
        const camera = new Camera(device);
        meshInstance.setIndirect(null, 1);
        meshInstance.setIndirect({ camera }, 2);
        expect(meshInstance.getDrawCommands(camera).slotIndex).to.equal(2);

        // the camera specific set expires, and does not mask the shared one assigned this frame
        device.frameEnd();
        meshInstance.setIndirect(null, 3);
        expect(meshInstance.getDrawCommands(camera).slotIndex).to.equal(3);
    });

    it('releases the cached commands when indirect rendering is turned off', function () {
        meshInstance.setIndirect(null, 3);
        meshInstance.setIndirect(null, -1);

        expect(meshInstance.drawCommands).to.be.null;
        expect(meshInstance.getDrawCommands(null)).to.be.undefined;
    });

    it('ignores indirect rendering on a device that does not support it', function () {
        // as WebGL does - draw commands it cannot execute would take it down its multi-draw path
        device.supportsIndirectDraw = false;
        meshInstance.setIndirect(null, 3);

        expect(meshInstance.drawCommands).to.be.null;
        expect(meshInstance.getDrawCommands(null)).to.be.undefined;
    });

    it('still releases cached commands when turning indirect off on an unsupported device', function () {
        meshInstance.setIndirect(null, 3);
        expect(meshInstance.getDrawCommands(null)).to.exist;

        device.supportsIndirectDraw = false;
        meshInstance.setIndirect(null, -1);
        expect(meshInstance.drawCommands).to.be.null;
    });

    it('assigns each camera a unique id', function () {
        expect(new Camera(device).id).to.not.equal(new Camera(device).id);
    });
});
