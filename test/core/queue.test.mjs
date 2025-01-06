import { expect } from 'chai';

import { Queue } from '../../src/core/queue.js';

describe('Queue', function () {
    let queue;

    beforeEach(function () {
        queue = new Queue(2);
    });

    describe('#constructor', function () {
        it('should initialize as empty', function () {
            expect(queue.isEmpty()).to.be.true;
            expect(queue.length).to.equal(0);
        });

        it('should return the initial capacity from the constructor', function () {
            expect(queue.capacity).to.equal(2);

            const customQueue = new Queue(5);
            expect(customQueue.capacity).to.equal(5);
        });
    });

    describe('#enqueue()/#dequeue()', function () {
        it('should enqueue elements into the queue', function () {
            queue.enqueue(1);
            expect(queue.isEmpty()).to.be.false;
            expect(queue.length).to.equal(1);
            expect(queue.peek()).to.equal(1);
        });

        it('should dequeue elements from the queue', function () {
            queue.enqueue(1);
            queue.enqueue(2);
            const dequeued = queue.dequeue();
            expect(dequeued).to.equal(1);
            expect(queue.length).to.equal(1);
            expect(queue.peek()).to.equal(2);
        });

        it('should return undefined when dequeuing from an empty queue', function () {
            const dequeued = queue.dequeue();
            expect(dequeued).to.be.undefined;
            expect(queue.isEmpty()).to.be.true;
        });

        it('should resize when capacity is exceeded', function () {
            queue.enqueue(1);
            queue.enqueue(2);
            queue.enqueue(3); // This should trigger a resize
            expect(queue.length).to.equal(3);
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
            expect(queue.length).to.equal(0);
            queue.enqueue(1);
            expect(queue.length).to.equal(1);
            queue.enqueue(2);
            expect(queue.length).to.equal(2);
            queue.dequeue();
            expect(queue.length).to.equal(1);
        });

        it('should handle multiple resizes', function () {
            for (let i = 1; i <= 5; i++) {
                queue.enqueue(i);
            }

            expect(queue.capacity).to.be.at.least(4);
            expect(queue.length).to.equal(5);

            expect(queue.dequeue()).to.equal(1);
            expect(queue.dequeue()).to.equal(2);
            expect(queue.dequeue()).to.equal(3);
            expect(queue.dequeue()).to.equal(4);
            expect(queue.dequeue()).to.equal(5);
        });

        it('should allow enqueuing after manually setting a larger capacity', function () {
            expect(queue.capacity).to.equal(2);
            queue.capacity = 10;
            expect(queue.capacity).to.equal(10);

            for (let i = 0; i < 10; i++) {
                queue.enqueue(i);
            }
            expect(queue.length).to.equal(10);
            expect(queue.capacity).to.equal(10);
        });
    });

    describe('#capacity', function () {
        it('should not reduce capacity if new capacity is smaller or equal to current length', function () {
            queue.enqueue(1);
            queue.enqueue(2);
            expect(queue.length).to.equal(2);

            queue.capacity = 1;
            expect(queue.capacity).to.equal(2);

            expect(queue.dequeue()).to.equal(1);
            expect(queue.dequeue()).to.equal(2);
            expect(queue.isEmpty()).to.be.true;
        });

        it('should set a larger capacity if new capacity is bigger than current size', function () {
            expect(queue.capacity).to.equal(2);
            queue.enqueue(1);

            queue.capacity = 5;
            expect(queue.capacity).to.equal(5);
            expect(queue.length).to.equal(1);
            expect(queue.dequeue()).to.equal(1);
        });

        it('should handle wrap-around when manually setting capacity', function () {
            queue.enqueue(1);
            queue.enqueue(2);

            const first = queue.dequeue();
            expect(first).to.equal(1);

            queue.enqueue(3);

            queue.capacity = 4;
            expect(queue.capacity).to.equal(4);

            expect(queue.dequeue()).to.equal(2);
            expect(queue.dequeue()).to.equal(3);
            expect(queue.isEmpty()).to.be.true;
        });
    });

    describe('#length', function () {
        it('should accurately reflect the number of items in the queue', function () {
            expect(queue.length).to.equal(0);

            queue.enqueue(10);
            queue.enqueue(20);
            expect(queue.length).to.equal(2);

            queue.dequeue();
            expect(queue.length).to.equal(1);

            queue.enqueue(30);
            expect(queue.length).to.equal(2);

            queue.dequeue();
            queue.dequeue();
            expect(queue.length).to.equal(0);
            expect(queue.isEmpty()).to.be.true;
        });
    });

    describe('#isEmpty()', function () {
        it('should return true when queue is newly created', function () {
            expect(queue.isEmpty()).to.be.true;
        });

        it('should return false when at least one item is enqueued', function () {
            queue.enqueue('test');
            expect(queue.isEmpty()).to.be.false;
        });

        it('should return true after enqueuing and then dequeuing the same number of items', function () {
            queue.enqueue('a');
            queue.enqueue('b');
            queue.dequeue();
            queue.dequeue();
            expect(queue.isEmpty()).to.be.true;
        });
    });

    describe('#peek()', function () {
        it('should return undefined if the queue is empty', function () {
            expect(queue.peek()).to.be.undefined;
        });

        it('should peek at the front element without dequeuing it', function () {
            queue.enqueue(1);
            const front = queue.peek();
            expect(front).to.equal(1);
            expect(queue.length).to.equal(1);
        });

        it('should return the front element after multiple enqueues/dequeues', function () {
            queue.enqueue(1);
            queue.enqueue(2);
            queue.enqueue(3);
            queue.dequeue();

            expect(queue.peek()).to.equal(2);
        });
    });
});
