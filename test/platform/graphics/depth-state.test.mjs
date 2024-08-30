import { DepthState } from '../../../src/platform/graphics/depth-state.js';
import {
    FUNC_LESSEQUAL, FUNC_ALWAYS, FUNC_NOTEQUAL
} from '../../../src/platform/graphics/constants.js';

import { expect } from 'chai';

describe('DepthState', () => {

    describe('#constructor', () => {

        it('empty', () => {
            const ds = new DepthState();
            expect(ds.func).to.equal(FUNC_LESSEQUAL);
            expect(ds.write).to.equal(true);
        });

        it('full parameters', () => {
            const ds = new DepthState(FUNC_NOTEQUAL, false);
            expect(ds.func).to.equal(FUNC_NOTEQUAL);
            expect(ds.write).to.equal(false);
        });

    });

    describe('#test property', () => {

        it('test enabled', () => {
            const ds = new DepthState();
            ds.test = true;
            expect(ds.func).to.equal(FUNC_LESSEQUAL);
            expect(ds.test).to.equal(true);
        });

        it('test disabled', () => {
            const ds = new DepthState();
            ds.test = false;
            expect(ds.func).to.equal(FUNC_ALWAYS);
            expect(ds.test).to.equal(false);
        });

    });

});
