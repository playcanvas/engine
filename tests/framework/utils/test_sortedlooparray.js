describe("pc.SortedLoopArray", function () {
    var arr;

    beforeEach(function () {
        arr = new pc.SortedLoopArray({ sortBy: 'priority' });
    });

    afterEach(function () {
        arr = null;
    });

    it('insert() adds item to array', function () {
        expect(arr.items.length).to.equal(0);

        var item = {
            priority: 1
        };

        arr.insert(item);

        expect(arr.items.length).to.equal(1);
        expect(arr.items[0]).to.equal(item);
    });

    it('append() adds item to array', function () {
        expect(arr.items.length).to.equal(0);

        var item = {
            priority: 1
        };

        arr.append(item);
        expect(arr.items.length).to.equal(1);
        expect(arr.items[0]).to.equal(item);
    });

    it('remove() removes item from array', function () {
        expect(arr.items.length).to.equal(0);

        var item = {
            priority: 1
        };

        arr.insert(item);

        expect(arr.items.length).to.equal(1);
        expect(arr.items[0]).to.equal(item);

        arr.remove(item);
        expect(arr.items.length).to.equal(0);
    });

    it('insert() adds item after items with lower priority', function () {
        var a = {
            priority: 1
        };
        var b = {
            priority: 2
        };
        arr.insert(a);
        arr.insert(b);

        expect(arr.items.length).to.equal(2);
        expect(arr.items[0]).to.equal(a);
        expect(arr.items[1]).to.equal(b);
    });

    it('insert() adds item after items with equal priority', function () {
        var a = {
            priority: 1
        };
        var b = {
            priority: 1
        };
        arr.insert(a);
        arr.insert(b);

        expect(arr.items.length).to.equal(2);
        expect(arr.items[0]).to.equal(a);
        expect(arr.items[1]).to.equal(b);
    });

    it('insert() adds item between items with lower and higher priority', function () {
        var a = {
            priority: 1
        };
        var c = {
            priority: 3
        };
        var b = {
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

    it('insert() adds item after items with lower and equal priority', function () {
        var a = {
            priority: 1
        };
        var b = {
            priority: 2
        };
        var c = {
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

    it('insert() adds item before items with higher priority', function () {
        var a = {
            priority: 1
        };
        var b = {
            priority: 2
        };
        var c = {
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

    it('insert() does not modify loopIndex for item added after it', function () {
        var a = {
            priority: 1
        };
        var b = {
            priority: 2
        };
        var c = {
            priority: 3
        };

        arr.insert(a);
        arr.insert(b);

        arr.loopIndex = 1;
        arr.insert(c);
        expect(arr.loopIndex).to.equal(1);
    });

    it('insert() modifies loopIndex for item added before it', function () {
        var a = {
            priority: 1
        };
        var b = {
            priority: 2
        };
        var c = {
            priority: 3
        };

        arr.insert(b);
        arr.insert(c);

        arr.loopIndex = 1;
        arr.insert(a);
        expect(arr.loopIndex).to.equal(2);
    });

    it('insert() modifies loopIndex for item added on the same slot', function () {
        var a = {
            priority: 1
        };
        var b = {
            priority: 2
        };
        var c = {
            priority: 3
        };

        arr.insert(b);
        arr.insert(c);

        arr.loopIndex = 0;
        arr.insert(a);
        expect(arr.loopIndex).to.equal(1);
    });

    it('insert() increases length', function () {
        expect(arr.length).to.equal(0);
        arr.insert({ priority: 1 });
        expect(arr.length).to.equal(1);
    });

    it('append() increases length', function () {
        expect(arr.length).to.equal(0);
        arr.append({ priority: 1 });
        expect(arr.length).to.equal(1);
    });

    it('remove() decreases length', function () {
        var item = { priority: 1 };
        expect(arr.length).to.equal(0);
        arr.insert(item);
        expect(arr.length).to.equal(1);
        arr.remove(item);
        expect(arr.length).to.equal(0);

        // does not go below 0
        arr.remove(item);
        expect(arr.length).to.equal(0);
    });

    it('remove() does not modify loopIndex for item removed after it', function () {
        var a = {
            priority: 1
        };
        var b = {
            priority: 2
        };
        var c = {
            priority: 3
        };

        arr.insert(a);
        arr.insert(b);
        arr.insert(c);

        arr.loopIndex = 1;
        arr.remove(c);
        expect(arr.loopIndex).to.equal(1);
    });

    it('remove() modifies loopIndex for item removed before it', function () {
        var a = {
            priority: 1
        };
        var b = {
            priority: 2
        };
        var c = {
            priority: 3
        };

        arr.insert(a);
        arr.insert(b);
        arr.insert(c);

        arr.loopIndex = 1;
        arr.remove(a);
        expect(arr.loopIndex).to.equal(0);
    });

    it('remove() modifies loopIndex when item it points to was removed', function () {
        var a = {
            priority: 1
        };
        var b = {
            priority: 2
        };
        var c = {
            priority: 3
        };

        arr.insert(a);
        arr.insert(b);
        arr.insert(c);

        arr.loopIndex = 1;
        arr.remove(b);
        expect(arr.loopIndex).to.equal(0);
    });

    it('remove() does not modify loopIndex if element does not exist', function () {
        var a = {
            priority: 1
        };
        var b = {
            priority: 2
        };
        var c = {
            priority: 3
        };

        arr.insert(a);
        arr.insert(b);

        arr.loopIndex = 1;
        arr.remove(c);
        expect(arr.loopIndex).to.equal(1);

    });

    it('append() does not modify loopIndex', function () {
        var a = {
            priority: 1
        };
        var b = {
            priority: 2
        };
        var c = {
            priority: 3
        };

        arr.insert(a);
        arr.insert(b);

        arr.loopIndex = 1;
        arr.append(c);
        expect(arr.loopIndex).to.equal(1);
    });

    it('append() always adds item to the end', function () {
        var a = {
            priority: 1
        };
        var b = {
            priority: 2
        };
        var c = {
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

    it('sort() sorts items', function () {
        var a = {
            priority: 1
        };
        var b = {
            priority: 2
        };
        var c = {
            priority: 3
        };

        arr.items = [c, b, a];
        arr.sort();
        expect(arr.items.length).to.equal(3);
        expect(arr.items[0]).to.equal(a);
        expect(arr.items[1]).to.equal(b);
        expect(arr.items[2]).to.equal(c);
    });

    it('sort() updates loopIndex', function () {
        var a = {
            priority: 1
        };
        var b = {
            priority: 2
        };
        var c = {
            priority: 3
        };

        arr.items = [c, b, a];
        arr.loopIndex = 0;
        arr.sort();
        expect(arr.loopIndex).to.equal(2);
    });

    it('sort() does not update loopIndex if it cannot find element it\'s pointing to', function () {
        var a = {
            priority: 1
        };
        var b = {
            priority: 2
        };
        var c = {
            priority: 3
        };

        arr.items = [c, b, a];
        arr.loopIndex = -1;
        arr.sort();
        expect(arr.loopIndex).to.equal(-1);
    });
});
