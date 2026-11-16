import { expect } from 'chai';
import { spy } from 'sinon';

import { LIGHTSHAPE_DISK, LIGHTSHAPE_RECT, LIGHTSHAPE_SPHERE } from '../../../src/scene/constants.js';
import { LightingParams } from '../../../src/scene/lighting/lighting-params.js';

describe('LightingParams', function () {

    describe('area light shapes', function () {

        const create = (dirtyLightsFnc = () => {}) => new LightingParams(true, 4096, dirtyLightsFnc);

        it('supports all area light shapes by default', function () {
            const params = create();
            expect(params.areaLightRectEnabled).to.equal(true);
            expect(params.areaLightDiskEnabled).to.equal(true);
            expect(params.areaLightSphereEnabled).to.equal(true);
        });

        it('rebuilds the lit shaders only when a shape is enabled or disabled', function () {
            const dirty = spy();
            const params = create(dirty);

            params.areaLightDiskEnabled = true;
            expect(dirty.called).to.equal(false);

            params.areaLightRectEnabled = false;
            params.areaLightDiskEnabled = false;
            params.areaLightSphereEnabled = false;
            expect(dirty.callCount).to.equal(3);

            params.areaLightSphereEnabled = false;
            expect(dirty.callCount).to.equal(3);
        });

        it('masks the enabled shapes, and none while area lights are disabled', function () {
            const params = create();
            expect(params.areaLightShapes).to.equal(0);

            params.areaLightsEnabled = true;
            expect(params.areaLightShapes).to.equal((1 << LIGHTSHAPE_RECT) | (1 << LIGHTSHAPE_DISK) | (1 << LIGHTSHAPE_SPHERE));

            params.areaLightDiskEnabled = false;
            params.areaLightSphereEnabled = false;
            expect(params.areaLightShapes).to.equal(1 << LIGHTSHAPE_RECT);
        });
    });
});
