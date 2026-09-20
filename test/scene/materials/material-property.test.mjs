import { expect } from 'chai';

import { Color } from '../../../src/core/math/color.js';
import { UNIFORMTYPE_VEC3 } from '../../../src/platform/graphics/constants.js';
import { MaterialProperty, convertColorToLinear } from '../../../src/scene/materials/material-property.js';

describe('MaterialProperty', function () {

    const diffuse = new MaterialProperty('diffuse', 'material_diffuse', UNIFORMTYPE_VEC3, convertColorToLinear);

    describe('#constructor', function () {

        it('derives the backing name and defaults to a non-array uniform', function () {
            expect(diffuse.name).to.equal('diffuse');
            expect(diffuse.backingName).to.equal('_diffuse');
            expect(diffuse.uniformName).to.equal('material_diffuse');
            expect(diffuse.type).to.equal(UNIFORMTYPE_VEC3);
            expect(diffuse.count).to.equal(0);
            expect(diffuse.convert).to.equal(convertColorToLinear);
        });

    });

    describe('convertColorToLinear', function () {

        it('writes the linear color at the offset and leaves the rest of the storage alone', function () {
            const storage = new Float32Array(8).fill(-1);
            convertColorToLinear(new Color(1, 1, 1), storage, 4);
            expect(Array.from(storage)).to.deep.equal([-1, -1, -1, -1, 1, 1, 1, -1]);

            convertColorToLinear(new Color(0, 0, 0), storage, 4);
            expect(Array.from(storage.subarray(4, 7))).to.deep.equal([0, 0, 0]);
        });

        it('matches the sRGB to linear conversion of Color', function () {
            const storage = new Float32Array(3);
            convertColorToLinear(new Color(0.5, 0.25, 0.75, 0.2), storage, 0);
            const expected = new Color().linear(new Color(0.5, 0.25, 0.75));
            expect(storage[0]).to.be.closeTo(expected.r, 1e-6);
            expect(storage[1]).to.be.closeTo(expected.g, 1e-6);
            expect(storage[2]).to.be.closeTo(expected.b, 1e-6);
        });

    });

});
