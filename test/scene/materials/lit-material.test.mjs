import { expect } from 'chai';
import sinon from 'sinon';

import { Debug } from '../../../src/core/debug.js';
import { Entity } from '../../../src/framework/entity.js';
import { LitMaterial } from '../../../src/scene/materials/lit-material.js';
import { StandardMaterial } from '../../../src/scene/materials/standard-material.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

describe('LitMaterial', function () {

    describe('#constructor()', function () {

        it('supplies the white ambient color the lit shader chunks read', function () {
            const material = new LitMaterial();
            expect(Array.from(material.getParameter('material_ambient').data)).to.deep.equal([1, 1, 1]);
        });

        it('keeps an ambient color set on the material, also in a clone', function () {
            const material = new LitMaterial();
            material.setParameter('material_ambient', [0.5, 0.25, 0]);
            expect(material.getParameter('material_ambient').data).to.deep.equal([0.5, 0.25, 0]);
            expect(material.clone().getParameter('material_ambient').data).to.deep.equal([0.5, 0.25, 0]);
        });
    });

    describe('rendering', function () {

        let app;

        beforeEach(function () {
            jsdomSetup();
            app = createApp();
            const camera = new Entity('camera');
            camera.addComponent('camera');
            camera.setPosition(0, 0, 8);
            app.root.addChild(camera);
        });

        afterEach(function () {
            sinon.restore();
            app.destroy();
            jsdomTeardown();
        });

        it('draws with the ambient color of its own after a StandardMaterial, which keeps it in its uniform buffer', function () {
            const warn = sinon.spy(Debug, 'warnOnce');
            const addBox = (material, x) => {
                const entity = new Entity();
                entity.addComponent('render', { type: 'box', material });
                entity.setPosition(x, 0, 0);
                app.root.addChild(entity);
            };
            addBox(new StandardMaterial(), -1);
            const lit = new LitMaterial();
            lit.shaderChunkGLSL = `
                #include "litShaderCorePS"
                void evaluateFrontend() {
                    litArgs_albedo = vec3(0.5);
                    litArgs_opacity = 1.0;
                    litArgs_worldNormal = dVertexNormalW;
                }`;
            lit.shaderChunkWGSL = `
                #include "litShaderCorePS"
                fn evaluateFrontend() {
                    litArgs_albedo = vec3f(0.5);
                    litArgs_opacity = 1.0;
                    litArgs_worldNormal = dVertexNormalW;
                }`;
            lit.update();
            addBox(lit, 1);

            const scopeId = app.graphicsDevice.scope.resolve('material_ambient');
            const ambient = [];
            const setParameters = lit.setParameters;
            sinon.stub(lit, 'setParameters').callsFake(function (...args) {
                const result = setParameters.apply(this, args);
                ambient.push(Array.from(scopeId.value));
                return result;
            });
            app.render();

            expect(ambient.length).to.be.greaterThan(0);
            expect(ambient[0]).to.deep.equal([1, 1, 1]);
            const unset = warn.args.filter(args => String(args[0]).includes('[material_ambient]'));
            expect(unset).to.have.lengthOf(0);
        });
    });
});
