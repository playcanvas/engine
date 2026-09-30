import { expect } from 'chai';

import {
    FUNC_LESSEQUAL, FUNC_ALWAYS, FUNC_GREATER, FUNC_NOTEQUAL
} from '../../../src/platform/graphics/constants.js';
import { DepthState } from '../../../src/platform/graphics/depth-state.js';

describe('DepthState', function () {

    describe('#constructor', function () {

        it('empty', function () {
            const ds = new DepthState();
            expect(ds.func).to.equal(FUNC_LESSEQUAL);
            expect(ds.write).to.equal(true);
        });

        it('full parameters', function () {
            const ds = new DepthState(FUNC_NOTEQUAL, false);
            expect(ds.func).to.equal(FUNC_NOTEQUAL);
            expect(ds.write).to.equal(false);
        });

    });

    describe('#test property', function () {

        it('test enabled', function () {
            const ds = new DepthState();
            ds.test = true;
            expect(ds.func).to.equal(FUNC_LESSEQUAL);
            expect(ds.test).to.equal(true);
        });

        it('test disabled', function () {
            const ds = new DepthState();
            ds.test = false;
            expect(ds.func).to.equal(FUNC_ALWAYS);
            expect(ds.test).to.equal(false);
        });

        it('enabling an enabled test keeps the depth function', function () {
            const ds = new DepthState(FUNC_GREATER);
            const key = ds.key;
            ds.test = true;
            expect(ds.func).to.equal(FUNC_GREATER);
            expect(ds.key).to.equal(key);
        });

        it('enabling a disabled test sets the default depth function', function () {
            const ds = new DepthState(FUNC_ALWAYS);
            ds.test = true;
            expect(ds.func).to.equal(FUNC_LESSEQUAL);
            expect(ds.equals(DepthState.DEFAULT)).to.equal(true);
        });

        it('disabling the test keeps depth writes', function () {
            const ds = new DepthState(FUNC_GREATER, true);
            ds.test = false;
            expect(ds.write).to.equal(true);
            expect(ds.equals(DepthState.WRITEDEPTH)).to.equal(true);
        });

    });

});
