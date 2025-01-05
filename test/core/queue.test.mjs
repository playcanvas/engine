import { expect } from 'chai';

import { Queue } from '../../src/core/queue.js';

describe('Queue', function () {
    let queue;

    beforeEach(function () {
        queue = new Queue(2);
    });

    it('should initialize as empty', function () {
        expect(queue.isEmpty()).to.be.true;
        expect(queue.size()).to.equal(0);
    });

    it('should enqueue elements into the queue', function () {
        queue.enqueue(1);
        expect(queue.isEmpty()).to.be.false;
        expect(queue.size()).to.equal(1);
        expect(queue.peek()).to.equal(1);
    });

    it('should dequeue elements from the queue', function () {
        queue.enqueue(1);
        queue.enqueue(2);
        const dequeued = queue.dequeue();
        expect(dequeued).to.equal(1);
        expect(queue.size()).to.equal(1);
        expect(queue.peek()).to.equal(2);
    });

    it('should return undefined when dequeuing from an empty queue', function () {
        const dequeued = queue.dequeue();
        expect(dequeued).to.be.undefined;
        expect(queue.isEmpty()).to.be.true;
    });

    it('should peek at the front element without dequeuing it', function () {
        queue.enqueue(1);
        const front = queue.peek();
        expect(front).to.equal(1);
        expect(queue.size()).to.equal(1);
    });

    it('should resize when capacity is exceeded', function () {
        queue.enqueue(1);
        queue.enqueue(2);
        queue.enqueue(3); // This should trigger a resize
        expect(queue.size()).to.equal(3);
        expect(queue.peek()).to.equal(1);
    });

    it('should maintain order after resizing', function () {
        queue.enqueue(1);
        queue.enqueue(2);
        queue.enqueue(3);
        expect(queue.dequeue()).to.equal(1);
        expect(queue.dequeue()).to.equal(2);
        expect(queue.dequeue()).to.equal(3);
    });

    it('should correctly report if the queue is empty', function () {
        expect(queue.isEmpty()).to.be.true;
        queue.enqueue(1);
        expect(queue.isEmpty()).to.be.false;
        queue.dequeue();
        expect(queue.isEmpty()).to.be.true;
    });

    it('should correctly report the size of the queue', function () {
        expect(queue.size()).to.equal(0);
        queue.enqueue(1);
        expect(queue.size()).to.equal(1);
        queue.enqueue(2);
        expect(queue.size()).to.equal(2);
        queue.dequeue();
        expect(queue.size()).to.equal(1);
    });
});
