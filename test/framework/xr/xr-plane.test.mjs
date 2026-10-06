import { expect } from 'chai';

import { XrPlane } from '../../../src/framework/xr/xr-plane.js';

/**
 * Creates a stand-in for an XRPlane.
 *
 * @returns {object} The plane.
 */
const createXrPlane = () => ({
    planeSpace: {},
    polygon: [{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 1, y: 0, z: 1 }],
    orientation: 'horizontal',
    semanticLabel: 'table',
    lastChangedTime: 1
});

describe('XrPlane', function () {

    /**
     * Creates a plane for an XRPlane.
     *
     * @param {object} xrPlane - The XRPlane.
     * @returns {XrPlane} The plane.
     */
    const createPlane = xrPlane => new XrPlane({ _manager: { _referenceSpace: {} } }, xrPlane);

    describe('#orientation', function () {

        it('follows the orientation of the XRPlane as it changes', function () {
            const xrPlane = createXrPlane();
            const plane = createPlane(xrPlane);
            expect(plane.orientation).to.equal('horizontal');

            xrPlane.orientation = 'vertical';
            expect(plane.orientation).to.equal('vertical');
        });

    });

    describe('#destroy', function () {

        it('keeps the attributes of the plane readable once it is removed', function () {
            const xrPlane = createXrPlane();
            const plane = createPlane(xrPlane);

            let removed = null;
            plane.on('remove', () => {
                removed = { label: plane.label, orientation: plane.orientation, points: plane.points };
            });
            plane.destroy();

            expect(removed).to.deep.equal({ label: 'table', orientation: 'horizontal', points: xrPlane.polygon });
            expect(plane.label).to.equal('table');
        });

    });

});
