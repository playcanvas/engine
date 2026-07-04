import { expect } from 'chai';

import { WORKBUFFER_UPDATE_ALWAYS, WORKBUFFER_UPDATE_AUTO, WORKBUFFER_UPDATE_ONCE } from '../../../src/scene/constants.js';
import { GraphNode } from '../../../src/scene/graph-node.js';
import { GSplatPlacement } from '../../../src/scene/gsplat-unified/gsplat-placement.js';

describe('GSplatPlacement', function () {

    describe('dirty state', function () {

        it('starts with dirtyVersion 0 and AUTO update mode', function () {
            const placement = new GSplatPlacement(null, new GraphNode());
            expect(placement.dirtyVersion).to.equal(0);
            expect(placement.workBufferUpdate).to.equal(WORKBUFFER_UPDATE_AUTO);
        });

        it('markDirty increments dirtyVersion', function () {
            const placement = new GSplatPlacement(null, new GraphNode());
            placement.markDirty();
            expect(placement.dirtyVersion).to.equal(1);
            placement.markDirty();
            expect(placement.dirtyVersion).to.equal(2);
        });

        it('WORKBUFFER_UPDATE_ONCE bumps dirtyVersion without changing the stored mode', function () {
            const placement = new GSplatPlacement(null, new GraphNode());
            placement.workBufferUpdate = WORKBUFFER_UPDATE_ONCE;
            expect(placement.dirtyVersion).to.equal(1);
            expect(placement.workBufferUpdate).to.equal(WORKBUFFER_UPDATE_AUTO);
        });

        it('WORKBUFFER_UPDATE_ALWAYS sets the mode without bumping dirtyVersion', function () {
            const placement = new GSplatPlacement(null, new GraphNode());
            placement.workBufferUpdate = WORKBUFFER_UPDATE_ALWAYS;
            expect(placement.dirtyVersion).to.equal(0);
            expect(placement.workBufferUpdate).to.equal(WORKBUFFER_UPDATE_ALWAYS);
        });

        it('setting workBufferModifier bumps dirtyVersion', function () {
            const placement = new GSplatPlacement(null, new GraphNode());
            placement.workBufferModifier = { code: 'void modifySplatCenter() {}', hash: 1 };
            expect(placement.dirtyVersion).to.equal(1);
            placement.workBufferModifier = null;
            expect(placement.dirtyVersion).to.equal(2);
        });

    });
});
