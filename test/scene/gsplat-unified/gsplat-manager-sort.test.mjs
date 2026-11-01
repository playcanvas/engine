import { expect } from 'chai';

import { Vec3 } from '../../../src/core/math/vec3.js';
import { PROJECTION_ORTHOGRAPHIC, PROJECTION_PERSPECTIVE } from '../../../src/scene/constants.js';
import { GraphNode } from '../../../src/scene/graph-node.js';
import { GSplatManager } from '../../../src/scene/gsplat-unified/gsplat-manager.js';
import { GSplatUnifiedSorter } from '../../../src/scene/gsplat-unified/gsplat-unified-sorter.js';

describe('GSplatManager#testCameraMovedForSort', function () {

    // A manager whose last CPU sort was taken from the camera's current pose and sort mode, with
    // only the properties the test reads.
    const makeManager = ({ radialSorting = false, projection = PROJECTION_PERSPECTIVE, fisheye = 0 } = {}) => {
        const cameraNode = new GraphNode();
        cameraNode.camera = { projection };
        cameraNode.setPosition(1, 2, 3);
        cameraNode.setEulerAngles(10, 20, 0);

        const manager = Object.create(GSplatManager.prototype);
        manager.gsplat = { radialSorting, fisheye };
        manager.cameraNode = cameraNode;
        manager.lastSortCameraPos = cameraNode.getPosition().clone();
        manager.lastSortCameraFwd = cameraNode.forward.clone();
        manager.lastSortKeyMode = manager._sortKeyMode();
        return manager;
    };

    const move = (manager) => {
        manager.cameraNode.setPosition(new Vec3(1, 2, 3).add(new Vec3(0.5, 0, 0)));
    };

    const turn = (manager) => {
        manager.cameraNode.setEulerAngles(10, 25, 0);
    };

    it('does not re-sort a camera that has not changed', function () {
        expect(makeManager().testCameraMovedForSort()).to.equal(false);
        expect(makeManager({ radialSorting: true }).testCameraMovedForSort()).to.equal(false);
    });

    it('re-sorts a radial sort on a move but not on a turn', function () {
        const moved = makeManager({ radialSorting: true });
        move(moved);
        expect(moved.testCameraMovedForSort()).to.equal(true);

        const turned = makeManager({ radialSorting: true });
        turn(turned);
        expect(turned.testCameraMovedForSort()).to.equal(false);
    });

    it('re-sorts a perspective depth sort on a move and on a turn', function () {
        const moved = makeManager();
        move(moved);
        expect(moved.testCameraMovedForSort()).to.equal(true);

        const turned = makeManager();
        turn(turned);
        expect(turned.testCameraMovedForSort()).to.equal(true);
    });

    it('re-sorts an orthographic or fisheye depth sort on a turn only', function () {
        for (const options of [{ projection: PROJECTION_ORTHOGRAPHIC }, { fisheye: 1 }]) {
            const moved = makeManager(options);
            move(moved);
            expect(moved.testCameraMovedForSort()).to.equal(false);

            const turned = makeManager(options);
            turn(turned);
            expect(turned.testCameraMovedForSort()).to.equal(true);
        }
    });

    it('re-sorts a still camera when its projection or sort mode changes', function () {
        const orthographic = makeManager();
        orthographic.cameraNode.camera.projection = PROJECTION_ORTHOGRAPHIC;
        expect(orthographic.testCameraMovedForSort()).to.equal(true);

        const fisheye = makeManager();
        fisheye.gsplat.fisheye = 1;
        expect(fisheye.testCameraMovedForSort()).to.equal(true);

        const radial = makeManager();
        radial.gsplat.radialSorting = true;
        expect(radial.testCameraMovedForSort()).to.equal(true);
    });
});

describe('GSplatUnifiedSorter#setSortParams', function () {

    // A sorter whose worker only counts the jobs posted to it.
    const makeSorter = () => {
        const sorter = Object.create(GSplatUnifiedSorter.prototype);
        sorter.posted = 0;
        sorter.worker = {
            postMessage: () => {
                sorter.posted++;
            }
        };
        sorter.bufferLength = 4;
        sorter.availableOrderData = [];
        sorter.jobsInFlight = 0;
        sorter.hasNewVersion = false;
        return sorter;
    };

    it('reports whether it sent the job, so a turned away sort can be asked for again', function () {
        const sorter = makeSorter();
        expect(sorter.setSortParams([], false, 0.1, true)).to.equal(true);

        // a job of this version is in flight
        expect(sorter.setSortParams([], false, 0.1, true)).to.equal(false);
        expect(sorter.posted).to.equal(1);

        // the job returned
        sorter.jobsInFlight = 0;
        expect(sorter.setSortParams([], false, 0.1, true)).to.equal(true);
        expect(sorter.posted).to.equal(2);
    });
});
