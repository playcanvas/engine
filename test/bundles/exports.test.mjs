import { expect } from 'chai';

import {
    ESM_TARGETS, EXPECTED_EXPORTS, SOURCE_INDEX, UMD_TARGETS,
    exportNames, loadEsm, loadUmdGlobal
} from './helpers.mjs';

describe('build / exports', function () {
    this.timeout(30000);

    let source;

    before(async function () {
        source = exportNames(await loadEsm(SOURCE_INDEX));
    });

    describe('expected exports present', function () {
        UMD_TARGETS.forEach((t) => {
            it(t.name, function () {
                const { pc, dom } = loadUmdGlobal(t.path);
                EXPECTED_EXPORTS.forEach(n => expect(pc, n).to.have.property(n));
                dom.window.close();
            });
        });

        ESM_TARGETS.forEach((t) => {
            it(t.name, async function () {
                const ns = await loadEsm(t.path);
                EXPECTED_EXPORTS.forEach(n => expect(ns, n).to.have.property(n));
            });
        });
    });

    describe('export parity with src/index.js', function () {
        UMD_TARGETS.forEach((t) => {
            it(t.name, function () {
                const { pc, dom } = loadUmdGlobal(t.path);
                expect(exportNames(pc)).to.deep.equal(source);
                dom.window.close();
            });
        });

        ESM_TARGETS.forEach((t) => {
            it(t.name, async function () {
                expect(exportNames(await loadEsm(t.path))).to.deep.equal(source);
            });
        });
    });
});
