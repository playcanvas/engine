import { SortedLoopArray } from '../../src/core/sorted-loop-array.js';

import { expect } from 'chai';

describe('SortedLoopArray', () => {

    describe('#constructor', () => {

        it('creates a new sorted loop array', () => {
            const array = new SortedLoopArray({
                sortBy: 'priority'
            });
            expect(array.length).to.equal(0);
            expect(array.items).to.be.an('array');
            expect(array.items.length).to.equal(0);
        });

    });

    describe('#append()', () => {

        it('adds item to array', () => {
            const arr = new SortedLoopArray({ sortBy: 'priority' });
            expect(arr.items.length).to.equal(0);

            const item = {
                priority: 1
            };

            arr.append(item);
            expect(arr.items.length).to.equal(1);
            expect(arr.items[0]).to.equal(item);
        });

        it('increases length', () => {
            const arr = new SortedLoopArray({ sortBy: 'priority' });
            expect(arr.length).to.equal(0);
            arr.append({ priority: 1 });
            expect(arr.length).to.equal(1);
        });

        it('does not modify loopIndex', () => {
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

        it('always adds item to the end', () => {
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

    describe('#insert()', () => {

        it('adds item to array', () => {
            const arr = new SortedLoopArray({ sortBy: 'priority' });
            expect(arr.items.length).to.equal(0);

            const item = {
                priority: 1
            };
            arr.insert(item);

            expect(arr.items.length).to.equal(1);
            expect(arr.items[0]).to.equal(item);
        });

        it('adds item after items with lower priority', () => {
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

        it('adds item after items with equal priority', () => {
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

        it('adds item between items with lower and higher priority', () => {
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

        it('adds item after items with lower and equal priority', () => {
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

        it('adds item before items with higher priority', () => {
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

        it('does not modify loopIndex for item added after it', () => {
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

        it('modifies loopIndex for item added before it', () => {
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

        it('modifies loopIndex for item added on the same slot', () => {
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

        it('increases length', () => {
            const arr = new SortedLoopArray({ sortBy: 'priority' });
            expect(arr.length).to.equal(0);
            arr.insert({ priority: 1 });
            expect(arr.length).to.equal(1);
        });

    });

    describe('#remove()', () => {

        it('removes item from array', () => {
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

        it('decreases length', () => {
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

        it('does not modify loopIndex for item removed after it', () => {
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

        it('modifies loopIndex for item removed before it', () => {
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

        it('modifies loopIndex when item it points to was removed', () => {
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

        it('does not modify loopIndex if element does not exist', () => {
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

    describe('#sort', () => {

        it('sorts items', () => {
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

        it('updates loopIndex', () => {
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

        it('does not update loopIndex if it cannot find element it\'s pointing to', () => {
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
