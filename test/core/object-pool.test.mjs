import { expect } from 'chai';

import { ObjectPool } from '../../src/core/object-pool.js';

class SampleObject {
    constructor() {
        this.value = 0;
    }
}

describe('ObjectPool', function () {
    let pool;

    beforeEach(function () {
        pool = new ObjectPool(SampleObject, 2);
    });

    it('should allocate an object from the pool', function () {
        const obj = pool.allocate();
        expect(obj).to.be.an.instanceof(SampleObject);
    });

    it('should resize the pool when allocation exceeds size', function () {
        const obj1 = pool.allocate();
        const obj2 = pool.allocate();
        const obj3 = pool.allocate();
        expect(obj3).to.be.an.instanceof(SampleObject);
    });

    it('should free an allocated object back to the pool', function () {
        const obj = pool.allocate();
        const success = pool.free(obj);
        expect(success).to.be.true;
    });

    it('should not free an object not allocated from the pool', function () {
        const obj = new SampleObject();
        const success = pool.free(obj);
        expect(success).to.be.false;
    });

    it('should free all allocated objects', function () {
        pool.allocate();
        pool.allocate();
        pool.freeAll();
        const obj = pool.allocate();
        expect(obj).to.be.an.instanceof(SampleObject);
    });
});
