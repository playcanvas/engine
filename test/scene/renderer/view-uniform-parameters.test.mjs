import { expect } from 'chai';
import sinon from 'sinon';

import { Debug } from '../../../src/core/debug.js';
import { Entity } from '../../../src/framework/entity.js';
import { StandardMaterial } from '../../../src/scene/materials/standard-material.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

// The uniforms of the view uniform buffer - the camera, the fog, the lights of the pass - are set
// once per pass, so a parameter of the same name set on a material or a mesh instance is ignored.
// Debug builds warn about it when the material or the mesh instance is drawn.
describe('View uniform parameters', function () {

    let app;
    let warn;

    beforeEach(function () {
        jsdomSetup();
        app = createApp();
        warn = sinon.spy(Debug, 'warnOnce');

        const camera = new Entity('camera');
        camera.addComponent('camera');
        camera.setPosition(0, 0, 5);
        app.root.addChild(camera);
    });

    afterEach(function () {
        sinon.restore();
        app.destroy();
        jsdomTeardown();
    });

    const addBox = (material) => {
        const entity = new Entity('box');
        entity.addComponent('render', { type: 'box', material });
        app.root.addChild(entity);
        return entity.render.meshInstances[0];
    };

    const warnings = () => warn.args.map(args => String(args[0])).filter(message => message.includes('supplies once per pass, and a value set per'));

    it('warns about a material parameter of a view uniform', function () {
        const material = new StandardMaterial();
        material.setParameter('fog_color', [1, 0, 0]);
        material.update();
        addBox(material);
        app.render();

        expect(warnings()).to.deep.equal([
            'Material#setParameter: \'fog_color\' is a uniform the renderer supplies once per pass, and a value set per material is ignored.'
        ]);
    });

    it('warns about a mesh instance parameter of a view uniform', function () {
        const meshInstance = addBox(new StandardMaterial());
        meshInstance.setParameter('exposure', 2);
        app.render();

        expect(warnings()).to.deep.equal([
            'MeshInstance#setParameter: \'exposure\' is a uniform the renderer supplies once per pass, and a value set per mesh instance is ignored.'
        ]);
    });

    it('warns about a parameter of a uniform of the view uniform buffer of the shadow pass', function () {
        const light = new Entity('light');
        light.addComponent('light', { type: 'directional', castShadows: true });
        app.root.addChild(light);

        const material = new StandardMaterial();
        material.setParameter('light_radius', 1);
        material.update();
        const meshInstance = addBox(material);
        meshInstance.castShadow = true;
        app.render();

        expect(warnings()).to.include('Material#setParameter: \'light_radius\' is a uniform the renderer supplies once per pass, and a value set per material is ignored.');
    });

    it('does not warn about other parameters', function () {
        const material = new StandardMaterial();
        material.setParameter('myTint', [1, 0, 0]);
        material.update();
        const meshInstance = addBox(material);
        meshInstance.setParameter('myScale', 2);
        app.render();

        expect(warnings()).to.deep.equal([]);
    });
});
