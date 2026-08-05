import { expect } from 'chai';
import { restore, stub } from 'sinon';

import { AnimStateGraph } from '../../../src/framework/anim/state-graph/anim-state-graph.js';
import { AnimStateGraphHandler } from '../../../src/framework/handlers/anim-state-graph.js';
import { http } from '../../../src/platform/net/http.js';

// a minimal state graph data block (the object form of layers/states/transitions)
const stateGraphData = {
    layers: {
        0: { name: 'Base', states: [0, 1], transitions: [0] }
    },
    states: {
        0: { name: 'START', speed: 1 },
        1: { name: 'New State', speed: 1, loop: true, defaultState: true }
    },
    transitions: {
        0: { from: 0, to: 1, conditions: {} }
    },
    parameters: {}
};

describe('AnimStateGraphHandler', function () {

    afterEach(function () {
        restore();
    });

    it('loads the resource and returns the fetched response', function () {
        const handler = new AnimStateGraphHandler({});
        stub(http, 'get').callsFake((url, options, callback) => {
            callback(null, stateGraphData);
        });

        let result;
        handler.load({ load: 'x.json', original: 'x.json' }, (err, res) => {
            expect(err).to.equal(null);
            result = res;
        });
        expect(result).to.equal(stateGraphData);
    });

    it('reports a load error including the url', function () {
        const handler = new AnimStateGraphHandler({});
        stub(http, 'get').callsFake((url, options, callback) => {
            callback('404');
        });

        let err;
        handler.load({ load: 'file.json', original: 'file.json' }, (e) => {
            err = e;
        });
        expect(err).to.include('Error loading animation state graph resource');
        expect(err).to.include('file.json');
        expect(err).to.include('404');
    });

    it('open builds an AnimStateGraph from the data', function () {
        const handler = new AnimStateGraphHandler({});
        const graph = handler.open('x.json', stateGraphData);
        expect(graph).to.be.an.instanceof(AnimStateGraph);
        expect(graph.layers).to.have.lengthOf(1);
        expect(graph.layers[0].name).to.equal('Base');
    });
});
