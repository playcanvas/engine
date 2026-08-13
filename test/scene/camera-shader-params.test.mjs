import { expect } from 'chai';

import { CameraShaderParams } from '../../src/scene/camera-shader-params.js';

describe('CameraShaderParams', function () {

    describe('#sceneTextures', function () {

        it('defaults to an empty list which generates no defines', function () {
            const params = new CameraShaderParams();
            expect(params.sceneTextures).to.deep.equal([]);
            expect(params.defines.has('SCENE_TEXTURE_DEPTH')).to.be.false;
        });

        it('generates an enable and a slot define per name, numbered from one', function () {
            const params = new CameraShaderParams();
            params.sceneTextures = ['depth', 'velocity'];

            const defines = params.defines;
            expect(defines.get('SCENE_TEXTURE_DEPTH')).to.equal('');
            expect(defines.get('{SCENE_TEXTURE_DEPTH_SLOT}')).to.equal('1');
            expect(defines.get('SCENE_TEXTURE_VELOCITY')).to.equal('');
            expect(defines.get('{SCENE_TEXTURE_VELOCITY_SLOT}')).to.equal('2');
        });

        it('upper cases the names of the defines', function () {
            const params = new CameraShaderParams();
            params.sceneTextures = ['my_texture'];
            expect(params.defines.has('SCENE_TEXTURE_MY_TEXTURE')).to.be.true;
        });

        it('treats undefined as an empty list', function () {
            const params = new CameraShaderParams();
            params.sceneTextures = ['depth'];
            params.sceneTextures = undefined;
            expect(params.sceneTextures).to.deep.equal([]);
            expect(params.defines.has('SCENE_TEXTURE_DEPTH')).to.be.false;
        });

        it('does not alias the supplied array', function () {
            const params = new CameraShaderParams();
            const names = ['depth'];
            params.sceneTextures = names;
            names.push('velocity');
            expect(params.sceneTextures).to.deep.equal(['depth']);
        });

        it('takes part in the hash', function () {
            const params = new CameraShaderParams();
            const empty = params.hash;

            params.sceneTextures = ['depth'];
            const depth = params.hash;
            expect(depth).to.not.equal(empty);

            params.sceneTextures = ['depth', 'velocity'];
            expect(params.hash).to.not.equal(depth);
        });

        it('does not invalidate anything when reassigned the same names in a new array', function () {
            const params = new CameraShaderParams();
            params.sceneTextures = ['depth'];

            // the render passes assign this around every layer step they render, so an equal value
            // must not dirty the hash which the shader variants of every material are keyed on. Note
            // that the hash itself cannot show this, as recomputing it yields the same number
            let dirtied = 0;
            params.markDirty = () => {
                dirtied++;
            };

            params.sceneTextures = ['depth'];
            expect(dirtied).to.equal(0);

            params.sceneTextures = ['depth', 'velocity'];
            expect(dirtied).to.equal(1);
        });

        it('reflects the names in the order they are supplied', function () {
            const params = new CameraShaderParams();
            params.sceneTextures = ['velocity', 'depth'];
            expect(params.defines.get('{SCENE_TEXTURE_VELOCITY_SLOT}')).to.equal('1');
            expect(params.defines.get('{SCENE_TEXTURE_DEPTH_SLOT}')).to.equal('2');
        });
    });
});
