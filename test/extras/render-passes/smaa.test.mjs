import { expect } from 'chai';

import {
    getSmaaAreaData,
    getSmaaSearchData
} from '../../../src/extras/render-passes/smaa/smaa-lookup-data.js';

const hashData = (data) => {
    let hash = 2166136261;
    for (let i = 0; i < data.length; i++) {
        hash = Math.imul(hash ^ data[i], 16777619);
    }
    return hash >>> 0;
};

describe('SMAA lookup data', function () {
    it('decodes the canonical area texture', function () {
        const data = getSmaaAreaData();
        expect(data).to.have.length(160 * 560 * 2);
        expect(hashData(data)).to.equal(2295323533);
    });

    it('decodes the canonical search texture', function () {
        const data = getSmaaSearchData();
        expect(data).to.have.length(64 * 16);
        expect(hashData(data)).to.equal(16827397);
    });
});
