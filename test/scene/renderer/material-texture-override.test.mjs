import { expect } from 'chai';
import sinon from 'sinon';

import { Entity } from '../../../src/framework/entity.js';
import {
    BindGroupFormat, BindTextureFormat, BindUniformBufferFormat
} from '../../../src/platform/graphics/bind-group-format.js';
import { BindGroup } from '../../../src/platform/graphics/bind-group.js';
import {
    BINDGROUP_MATERIAL, SHADERSTAGE_FRAGMENT, SHADERSTAGE_VERTEX, UNIFORM_BUFFER_DEFAULT_SLOT_NAME
} from '../../../src/platform/graphics/constants.js';
import { Texture } from '../../../src/platform/graphics/texture.js';
import { LAYERID_WORLD, SORTMODE_NONE } from '../../../src/scene/constants.js';
import { StandardMaterial } from '../../../src/scene/materials/standard-material.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

describe('mesh instance texture overrides', function () {

    let app;
    let device;

    beforeEach(function () {
        jsdomSetup();
        app = createApp();
        device = app.graphicsDevice;

        // draws stay in the order the entities are added, so the overriding one comes first
        app.scene.layers.getLayerById(LAYERID_WORLD).opaqueSortMode = SORTMODE_NONE;

        const camera = new Entity('Camera');
        camera.addComponent('camera');
        app.root.addChild(camera);
    });

    afterEach(function () {
        sinon.restore();
        app.destroy();
        jsdomTeardown();
    });

    const texture = name => new Texture(device, { name: name, width: 4, height: 4 });

    /**
     * A material whose bind group holds a texture. No material layout claims a texture slot yet,
     * so the slot the mesh instances override is given to the material here.
     *
     * @returns {StandardMaterial} The material.
     */
    const materialWithTextureSlot = () => {
        const material = new StandardMaterial();
        material.update();
        material.prepareForRender(device, app.scene);

        const format = new BindGroupFormat(device, [
            new BindUniformBufferFormat(UNIFORM_BUFFER_DEFAULT_SLOT_NAME, SHADERSTAGE_VERTEX | SHADERSTAGE_FRAGMENT),
            new BindTextureFormat('texture_overridden', SHADERSTAGE_FRAGMENT)
        ]);
        material._uniformBufferBindGroup.destroy();
        material._uniformBufferBindGroup = new BindGroup(device, format, material.uniformBuffer);
        material._uniformBufferBindGroup.setTexture('texture_overridden', texture('material'));

        // the mesh instances classified their parameters against the previous layout
        material._layoutVersion++;

        return material;
    };

    const addBox = (material, x) => {
        const entity = new Entity(`box${x}`);
        entity.addComponent('render', { type: 'box', material: material });
        entity.setLocalPosition(x, 0, -4);
        app.root.addChild(entity);
        return entity.render.meshInstances[0];
    };

    it('applies a parameter naming a texture of the material through the copy of its bind group', function () {
        const material = materialWithTextureSlot();
        const meshInstance = addBox(material, 0);
        meshInstance.setParameter('texture_overridden', texture('override'));

        app.render();

        expect(meshInstance._materialTextureOverrides).to.have.lengthOf(1);
        expect(meshInstance.getParameter('texture_overridden').textureSlot).to.equal(0);
        expect(meshInstance._scopeParameters).to.have.lengthOf(0);
        expect(meshInstance._materialBindGroup.textures[0].name).to.equal('override');

        // the material keeps its own
        expect(material.uniformBufferBindGroup.textures[0].name).to.equal('material');
    });

    it('binds the material bind group back after a draw whose only override is a texture', function () {
        const material = materialWithTextureSlot();
        const overriding = addBox(material, -1);
        addBox(material, 1);
        overriding.setParameter('texture_overridden', texture('override'));

        // the parameters are classified and the copy built on the first frame
        app.render();

        const setBindGroup = sinon.spy(device, 'setBindGroup');

        app.render();

        const bound = setBindGroup.args.filter(([index]) => index === BINDGROUP_MATERIAL).map(([, bindGroup]) => bindGroup);

        // the material's group, the copy for the overriding draw, then the material's group again
        // for the draw which overrides nothing
        expect(bound.length).to.be.at.least(3);
        expect(bound).to.include(overriding._materialBindGroup);
        expect(bound[bound.length - 1]).to.equal(material.uniformBufferBindGroup);
    });

    it('removes a deleted parameter from the list of texture overrides', function () {
        const material = materialWithTextureSlot();
        const meshInstance = addBox(material, 0);
        meshInstance.setParameter('texture_overridden', texture('override'));
        app.render();
        expect(meshInstance._materialTextureOverrides).to.have.lengthOf(1);

        meshInstance.deleteParameter('texture_overridden');

        expect(meshInstance._materialTextureOverrides).to.have.lengthOf(0);
        expect(meshInstance.getParameter('texture_overridden')).to.equal(undefined);
    });
});
