import { expect } from 'chai';

import { XrMesh } from '../../../src/framework/xr/xr-mesh.js';

describe('XrMesh', function () {

    describe('#destroy', function () {

        it('keeps the attributes of the mesh readable once it is removed', function () {
            const xrMesh = {
                meshSpace: {},
                vertices: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
                indices: new Uint32Array([0, 1, 2]),
                semanticLabel: 'couch',
                lastChangedTime: 1
            };
            const mesh = new XrMesh({ _manager: { _referenceSpace: {} } }, xrMesh);

            let removed = null;
            mesh.on('remove', () => {
                removed = { label: mesh.label, vertices: mesh.vertices, indices: mesh.indices };
            });
            mesh.destroy();

            expect(removed).to.deep.equal({ label: 'couch', vertices: xrMesh.vertices, indices: xrMesh.indices });
            expect(mesh.xrMesh).to.equal(xrMesh);
        });

    });

});
