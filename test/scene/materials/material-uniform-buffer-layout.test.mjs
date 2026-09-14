import { expect } from 'chai';

import { UNIFORMTYPE_FLOAT, UNIFORMTYPE_VEC3, UNIFORMTYPE_VEC4 } from '../../../src/platform/graphics/constants.js';
import { MaterialProperty, convertColorToLinear } from '../../../src/scene/materials/material-property.js';
import { getMaterialLayout, getMaterialLayoutKey } from '../../../src/scene/materials/material-uniform-buffer-layout.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

describe('MaterialUniformBufferLayout', function () {

    const noop = () => {};
    const diffuse = new MaterialProperty('diffuse', 'material_diffuse', UNIFORMTYPE_VEC3, convertColorToLinear);
    const gloss = new MaterialProperty('gloss', 'material_gloss', UNIFORMTYPE_FLOAT, noop);
    const tint = new MaterialProperty('tint', 'material_tint', UNIFORMTYPE_VEC4, noop);

    describe('getMaterialLayoutKey', function () {

        it('does not depend on the order of the properties', function () {
            expect(getMaterialLayoutKey([diffuse, gloss, tint])).to.equal(getMaterialLayoutKey([tint, diffuse, gloss]));
        });

        it('differs for a different set of properties', function () {
            expect(getMaterialLayoutKey([diffuse, gloss])).to.not.equal(getMaterialLayoutKey([diffuse, tint]));
            expect(getMaterialLayoutKey([diffuse])).to.not.equal(getMaterialLayoutKey([diffuse, gloss]));
        });

        it('includes the uniform type', function () {
            const asVec4 = new MaterialProperty('diffuse', 'material_diffuse', UNIFORMTYPE_VEC4, noop);
            expect(getMaterialLayoutKey([asVec4])).to.not.equal(getMaterialLayoutKey([diffuse]));
        });

    });

    describe('getMaterialLayout', function () {

        let app;

        beforeEach(function () {
            jsdomSetup();
            app = createApp();
        });

        afterEach(function () {
            app.destroy();
            jsdomTeardown();
        });

        it('shares one layout between the same properties in any order', function () {
            const device = app.graphicsDevice;
            const a = getMaterialLayout(device, [diffuse, gloss, tint]);
            const b = getMaterialLayout(device, [tint, gloss, diffuse]);
            expect(b).to.equal(a);
            expect(a.key).to.equal(getMaterialLayoutKey([diffuse, gloss, tint]));
        });

        it('creates a different layout for a different set of properties', function () {
            const device = app.graphicsDevice;
            const a = getMaterialLayout(device, [diffuse]);
            const b = getMaterialLayout(device, [diffuse, gloss]);
            expect(b).to.not.equal(a);
            expect(b.uniformBufferFormat).to.not.equal(a.uniformBufferFormat);
        });

        it('lays the uniforms out in layout key order and describes a single-buffer bind group', function () {
            const device = app.graphicsDevice;
            const layout = getMaterialLayout(device, [tint, diffuse, gloss]);
            const format = layout.uniformBufferFormat;
            expect(format.uniforms.map(uniform => uniform.name)).to.deep.equal(['material_diffuse', 'material_gloss', 'material_tint']);
            expect(format.get('material_diffuse').type).to.equal(UNIFORMTYPE_VEC3);
            expect(layout.bindGroupFormat.uniformBufferFormats).to.have.lengthOf(1);
            expect(layout.bindGroupFormat.textureFormats).to.have.lengthOf(0);
        });

    });

});
