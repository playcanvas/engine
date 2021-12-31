import { SortedLoopArray } from '../../src/core/sorted-loop-array.js';

import { expect } from 'chai';

describe('SortedLoopArray', function () {

    describe('#constructor', function () {

        it('creates a new sorted loop array', function () {
            const array = new SortedLoopArray({
                sortBy: 'priority'
            });
            expect(array.length).to.equal(0);
            expect(array.items).to.be.an('array');
            expect(array.items.length).to.equal(0);
        });

    });

    describe('#append()', function () {

        it('adds item to array', function () {
            const arr = new SortedLoopArray({ sortBy: 'priority' });
            expect(arr.items.length).to.equal(0);

            const item = {
                priority: 1
            };

            arr.append(item);
            expect(arr.items.length).to.equal(1);
            expect(arr.items[0]).to.equal(item);
        });

        it('increases length', function () {
            const arr = new SortedLoopArray({ sortBy: 'priority' });
            expect(arr.length).to.equal(0);
            arr.append({ priority: 1 });
            expect(arr.length).to.equal(1);
        });

        it('does not modify loopIndex', function () {
            const arr = new SortedLoopArray({ sortBy: 'priority' });
            const a = {
                priority: 1
            };
            const b = {
                priority: 2
            };
            const c = {
                priority: 3
            };

            arr.insert(a);
            arr.insert(b);

            arr.loopIndex = 1;
            arr.append(c);
            expect(arr.loopIndex).to.equal(1);
        });

        it('always adds item to the end', function () {
            const arr = new SortedLoopArray({ sortBy: 'priority' });
            const a = {
                priority: 1
            };
            const b = {
                priority: 2
            };
            const c = {
                priority: 0
            };

            arr.insert(a);
            arr.insert(b);
            arr.append(c);
            expect(arr.items.length).to.equal(3);
            expect(arr.items[0]).to.equal(a);
            expect(arr.items[1]).to.equal(b);
            expect(arr.items[2]).to.equal(c);
        });

    });

    describe('#insert()', function () {

        it('adds item to array', function () {
            const arr = new SortedLoopArray({ sortBy: 'priority' });
            expect(arr.items.length).to.equal(0);

            const item = {
                priority: 1
            };
            arr.insert(item);

            expect(arr.items.length).to.equal(1);
            expect(arr.items[0]).to.equal(item);
        });

        it('adds item after items with lower priority', function () {
            const arr = new SortedLoopArray({ sortBy: 'priority' });
            const a = {
                priority: 1
            };
            const b = {
                priority: 2
            };
            arr.insert(a);
            arr.insert(b);

            expect(arr.items.length).to.equal(2);
            expect(arr.items[0]).to.equal(a);
            expect(arr.items[1]).to.equal(b);
        });

        it('adds item after items with equal priority', function () {
            const arr = new SortedLoopArray({ sortBy: 'priority' });
            const a = {
                priority: 1
            };
            const b = {
                priority: 1
            };
            arr.insert(a);
            arr.insert(b);

            expect(arr.items.length).to.equal(2);
            expect(arr.items[0]).to.equal(a);
            expect(arr.items[1]).to.equal(b);
        });

        it('adds item between items with lower and higher priority', function () {
            const arr = new SortedLoopArray({ sortBy: 'priority' });
            const a = {
                priority: 1
            };
            const c = {
                priority: 3
            };
            const b = {
                priority: 2
            };
            arr.insert(a);
            arr.insert(c);
            arr.insert(b);

            expect(arr.items.length).to.equal(3);
            expect(arr.items[0]).to.equal(a);
            expect(arr.items[1]).to.equal(b);
            expect(arr.items[2]).to.equal(c);
        });

        it('adds item after items with lower and equal priority', function () {
            const arr = new SortedLoopArray({ sortBy: 'priority' });
            const a = {
                priority: 1
            };
            const b = {
                priority: 2
            };
            const c = {
                priority: 2
            };
            arr.insert(a);
            arr.insert(b);
            arr.insert(c);

            expect(arr.items.length).to.equal(3);
            expect(arr.items[0]).to.equal(a);
            expect(arr.items[1]).to.equal(b);
            expect(arr.items[2]).to.equal(c);
        });

        it('adds item before items with higher priority', function () {
            const arr = new SortedLoopArray({ sortBy: 'priority' });
            const a = {
                priority: 1
            };
            const b = {
                priority: 2
            };
            const c = {
                priority: 3
            };
            arr.insert(b);
            arr.insert(c);
            arr.insert(a);

            expect(arr.items.length).to.equal(3);
            expect(arr.items[0]).to.equal(a);
            expect(arr.items[1]).to.equal(b);
            expect(arr.items[2]).to.equal(c);
        });

        it('does not modify loopIndex for item added after it', function () {
            const arr = new SortedLoopArray({ sortBy: 'priority' });
            const a = {
                priority: 1
            };
            const b = {
                priority: 2
            };
            const c = {
                priority: 3
            };

            arr.insert(a);
            arr.insert(b);

            arr.loopIndex = 1;
            arr.insert(c);
            expect(arr.loopIndex).to.equal(1);
        });

        it('modifies loopIndex for item added before it', function () {
            const arr = new SortedLoopArray({ sortBy: 'priority' });
            const a = {
                priority: 1
            };
            const b = {
                priority: 2
            };
            const c = {
                priority: 3
            };

            arr.insert(b);
            arr.insert(c);

            arr.loopIndex = 1;
            arr.insert(a);
            expect(arr.loopIndex).to.equal(2);
        });

        it('modifies loopIndex for item added on the same slot', function () {
            const arr = new SortedLoopArray({ sortBy: 'priority' });
            const a = {
                priority: 1
            };
            const b = {
                priority: 2
            };
            const c = {
                priority: 3
            };

            arr.insert(b);
            arr.insert(c);

            arr.loopIndex = 0;
            arr.insert(a);
            expect(arr.loopIndex).to.equal(1);
        });

        it('increases length', function () {
            const arr = new SortedLoopArray({ sortBy: 'priority' });
            expect(arr.length).to.equal(0);
            arr.insert({ priority: 1 });
            expect(arr.length).to.equal(1);
        });

    });

    describe('#remove()', function () {

        it('removes item from array', function () {
            const arr = new SortedLoopArray({ sortBy: 'priority' });
            expect(arr.items.length).to.equal(0);

            const item = {
                priority: 1
            };

            arr.insert(item);

            expect(arr.items.length).to.equal(1);
            expect(arr.items[0]).to.equal(item);

            arr.remove(item);
            expect(arr.items.length).to.equal(0);
        });

        it('decreases length', function () {
            const arr = new SortedLoopArray({ sortBy: 'priority' });
            const item = { priority: 1 };
            expect(arr.length).to.equal(0);
            arr.insert(item);
            expect(arr.length).to.equal(1);
            arr.remove(item);
            expect(arr.length).to.equal(0);

            // does not go below 0
            arr.remove(item);
            expect(arr.length).to.equal(0);
        });

        it('does not modify loopIndex for item removed after it', function () {
            const arr = new SortedLoopArray({ sortBy: 'priority' });
            const a = {
                priority: 1
            };
            const b = {
                priority: 2
            };
            const c = {
                priority: 3
            };

            arr.insert(a);
            arr.insert(b);
            arr.insert(c);

            arr.loopIndex = 1;
            arr.remove(c);
            expect(arr.loopIndex).to.equal(1);
        });

        it('modifies loopIndex for item removed before it', function () {
            const arr = new SortedLoopArray({ sortBy: 'priority' });
            const a = {
                priority: 1
            };
            const b = {
                priority: 2
            };
            const c = {
                priority: 3
            };

            arr.insert(a);
            arr.insert(b);
            arr.insert(c);

            arr.loopIndex = 1;
            arr.remove(a);
            expect(arr.loopIndex).to.equal(0);
        });

        it('modifies loopIndex when item it points to was removed', function () {
            const arr = new SortedLoopArray({ sortBy: 'priority' });
            const a = {
                priority: 1
            };
            const b = {
                priority: 2
            };
            const c = {
                priority: 3
            };

            arr.insert(a);
            arr.insert(b);
            arr.insert(c);

            arr.loopIndex = 1;
            arr.remove(b);
            expect(arr.loopIndex).to.equal(0);
        });

        it('does not modify loopIndex if element does not exist', function () {
            const arr = new SortedLoopArray({ sortBy: 'priority' });
            const a = {
                priority: 1
            };
            const b = {
                priority: 2
            };
            const c = {
                priority: 3
            };

            arr.insert(a);
            arr.insert(b);

            arr.loopIndex = 1;
            arr.remove(c);
            expect(arr.loopIndex).to.equal(1);
        });

    });

    describe('#sort', function () {

        it('sorts items', function () {
            const arr = new SortedLoopArray({ sortBy: 'priority' });
            const a = {
                priority: 1
            };
            const b = {
                priority: 2
            };
            const c = {
                priority: 3
            };

            arr.items = [c, b, a];
            arr.sort();
            expect(arr.items.length).to.equal(3);
            expect(arr.items[0]).to.equal(a);
            expect(arr.items[1]).to.equal(b);
            expect(arr.items[2]).to.equal(c);
        });

        it('updates loopIndex', function () {
            const arr = new SortedLoopArray({ sortBy: 'priority' });
            const a = {
                priority: 1
            };
            const b = {
                priority: 2
            };
            const c = {
                priority: 3
            };

            arr.items = [c, b, a];
            arr.loopIndex = 0;
            arr.sort();
            expect(arr.loopIndex).to.equal(2);
        });

        it('does not update loopIndex if it cannot find element it\'s pointing to', function () {
            const arr = new SortedLoopArray({ sortBy: 'priority' });
            const a = {
                priority: 1
            };
            const b = {
                priority: 2
            };
            const c = {
                priority: 3
            };

            arr.items = [c, b, a];
            arr.loopIndex = -1;
            arr.sort();
            expect(arr.loopIndex).to.equal(-1);
        });

    });

});
