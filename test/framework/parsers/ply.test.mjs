import { expect } from 'chai';
import { restore, stub } from 'sinon';

import { PlyParser } from '../../../src/framework/parsers/ply.js';
import { http } from '../../../src/platform/net/http.js';

describe('PlyParser', function () {

    afterEach(function () {
        restore();
        http.withCredentials = false;
    });

    // the parser streams the ply with fetch rather than through the http layer, so it has to apply
    // the credentials flag itself. The request is failed as soon as its arguments are recorded.
    const loadCredentials = async () => {
        const fetched = stub(global, 'fetch').rejects(new Error('recorded'));
        const parser = Object.create(PlyParser.prototype);
        parser.app = { scene: {} };

        await new Promise((resolve) => {
            parser.load({ load: 'test.ply', original: 'test.ply' }, resolve, {});
        });

        return fetched.firstCall.args[1]?.credentials;
    };

    it('streams without credentials by default', async function () {
        expect(await loadCredentials()).to.equal('same-origin');
    });

    it('streams with credentials once they are enabled', async function () {
        http.withCredentials = true;

        expect(await loadCredentials()).to.equal('include');
    });
});
