describe('pc.GraphNode', function () {
    beforeEach(function () {
        this.app = new pc.Application(document.createElement('canvas'));
    });

    afterEach(function () {
        this.app.destroy();
    });

    function buildGraph() {
        var g1 = new pc.GraphNode();
        g1.name = 'g1';

        var g2 = new pc.GraphNode();
        g2.name = 'g2';

        var g3 = new pc.GraphNode();
        g3.name = 'g3';

        g1.addChild(g2);
        g2.addChild(g3);

        return g1;
    }

    it('GraphNode: find', function () {
        var root, found;
        root = buildGraph();
        found = root.find('name', 'g1');
        equal(found.length, 1);
        equal(found[0], root);
        found = root.find('name', 'g2');
        equal(found.length, 1);
        equal(found[0].parent, root);
        found = root.find('name', 'g3');
        equal(found.length, 1);
        equal(found[0].parent.parent, root);

        found = root.find(function (node) {
            return node.name === 'g1';
        });
        equal(found.length, 1);
        equal(found[0], root);
        found = root.find(function (node) {
            return node.name === 'g2';
        });
        equal(found.length, 1);
        equal(found[0].parent, root);
        found = root.find(function (node) {
            return node.name === 'g3';
        });
        equal(found.length, 1);
        equal(found[0].parent.parent, root);
    });

    it('GraphNode: findByName same entity', function () {
        var node = buildGraph();
        var found = node.findByName('g1');
        equal(found, node);
    });

    it('GraphNode: findByName grandchild', function () {
        var node = buildGraph();
        var child = node.children[0];
        var grandchild = child.children[0];

        var found = node.findByName('g3');
        equal(found, grandchild);
    });

    it('GraphNode: findByName when entity does not exist', function () {
        var node = buildGraph();
        var found = node.findByName('g4');
        equal(found, null);
    });

    it('GraphNode: findByPath without slashes', function () {
        var node = buildGraph();
        var child = node.children[0];
        var found = node.findByPath('g2');
        equal(found, child);
    });

    it('GraphNode: findByPath with slashes', function () {
        var node = buildGraph();
        var child = node.children[0];
        var grandchild = child.children[0];

        var found = node.findByPath('g2/g3');

        equal(found, grandchild);
    });

    it('GraphNode: findByPath does not include same entity', function () {
        var node = buildGraph();
        var found = node.findByPath('g1/g2/g3');
        equal(found, null);
    });

    it('GraphNode: findByPath when entity does not exist', function () {
        var node = buildGraph();
        var found = node.findByPath('g4');
        equal(found, null);
    });

    it('GraphNode: path', function () {
        var node = buildGraph();
        var child = node.children[0];
        var grandchild = child.children[0];

        equal(grandchild.path, 'g2/g3');
    });

    it('GraphNode: path of root entity', function () {
        var node = buildGraph();
        equal(node.path, '');
    });

    it('GraphNode: addChild', function () {
        var g1 = new pc.GraphNode('g1');
        var g2 = new pc.GraphNode('g2');

        g1.addChild(g2);

        equal(g1.children[0], g2);
    });

    it('GraphNode: insertChild', function () {
        var g1 = new pc.GraphNode('g1');
        var g2 = new pc.GraphNode('g2');
        var g3 = new pc.GraphNode('g3');

        g1.addChild(g2);
        g1.insertChild(g3, 0);

        equal(g1.children[0], g3);
        equal(g1.children[1], g2);
    });

    it('GraphNode: removeChild', function () {
        var g1 = new pc.GraphNode('g1');
        var g2 = new pc.GraphNode('g2');

        g1.addChild(g2);

        g1.removeChild(g2);

        equal(g1.children.length, 0);
    });

    it('GraphNode: reparent', function () {
        var g1 = new pc.GraphNode('g1');
        var g2 = new pc.GraphNode('g2');
        var g3 = new pc.GraphNode('g3');

        g1.addChild(g2);
        g2.reparent(g3);

        equal(g3.children.length, 1);
        equal(g3.children[0], g2);
        equal(g1.children.length, 0);
    });

    it('GraphNode: reparent at specific index', function () {
        var g1 = new pc.GraphNode('g1');
        var g2 = new pc.GraphNode('g2');
        var g3 = new pc.GraphNode('g3');
        var g4 = new pc.GraphNode('g4');

        g1.addChild(g2);

        g3.addChild(g4);

        g2.reparent(g3, 0);

        equal(g3.children.length, 2);
        equal(g3.children[0], g2);
        equal(g1.children.length, 0);

        g2.reparent(g3, 1);
        equal(g3.children.length, 2);
        equal(g3.children[0], g4);
        equal(g3.children[1], g2);
    });

    it('GraphNode: reparent error on self parent', function () {
        var g1 = new pc.GraphNode('g1');

        var error = {};
        try {
            g1.reparent(g1);
        } catch (e) {
            error = e;
        }

        equal(error.message, 'GraphNode cannot be parented to self');
    });

    it('GraphNode: children', function () {
        var g1 = new pc.GraphNode('g1');
        var g2 = new pc.GraphNode('g2');
        var g3 = new pc.GraphNode('g3');

        g1.addChild(g2);
        g1.addChild(g3);

        equal(g1.children[0], g2);
        equal(g1.children[1], g3);

    });

    it('GraphNode: g/setEulerAngles', function () {
        var g1 = new pc.GraphNode('g1');

        g1.setEulerAngles(1, 2, 3);

        var angles = g1.getEulerAngles();
        close(angles.x, 1, 0.0001);
        close(angles.y, 2, 0.0001);
        close(angles.z, 3, 0.0001);
    });

    it('GraphNode: rotate', function () {
        var g;
        var angles;

        g = new pc.GraphNode('g1');
        g.rotate(10, 0, 0);
        angles = g.getEulerAngles();
        close(angles.x, 10, 0.0001);
        close(angles.y, 0, 0.0001);
        close(angles.z, 0, 0.0001);

        g = new pc.GraphNode('g1');
        g.rotate(0, 10, 0);
        angles = g.getEulerAngles();
        close(angles.x, 0, 0.0001);
        close(angles.y, 10, 0.0001);
        close(angles.z, 0, 0.0001);

        g = new pc.GraphNode('g1');
        g.rotate(0, 0, 10);
        angles = g.getEulerAngles();
        close(angles.x, 0, 0.0001);
        close(angles.y, 0, 0.0001);
        close(angles.z, 10, 0.0001);

        g = new pc.GraphNode('g1');
        g.rotate(10, 20, 30);
        angles = g.getEulerAngles();
        close(angles.x, 10, 0.0001);
        close(angles.y, 20, 0.0001);
        close(angles.z, 30, 0.0001);
    });

    it('GraphNode: rotate in hierarchy', function () {
        var p = new pc.GraphNode('g0');
        p.setEulerAngles(10, 10, 10);
        var g;
        var angles;

        g = new pc.GraphNode('g1');
        p.setEulerAngles(10, 0, 0);
        p.addChild(g);
        g.rotate(10, 0, 0);
        angles = g.getEulerAngles();
        close(angles.x, 20, 0.0001);
        close(angles.y, 0, 0.0001);
        close(angles.z, 0, 0.0001);
        p.removeChild(g);

        g = new pc.GraphNode('g1');
        p.setEulerAngles(0, 10, 0);
        p.addChild(g);
        g.rotate(0, 10, 0);
        angles = g.getEulerAngles();
        close(angles.x, 0, 0.0001);
        close(angles.y, 20, 0.0001);
        close(angles.z, 0, 0.0001);
        p.removeChild(g);

        g = new pc.GraphNode('g1');
        p.setEulerAngles(0, 0, 10);
        p.addChild(g);
        g.rotate(0, 0, 10);
        angles = g.getEulerAngles();
        close(angles.x, 0, 0.0001);
        close(angles.y, 0, 0.0001);
        close(angles.z, 20, 0.0001);
        p.removeChild(g);
    });

    it('GraphNode: rotateLocal', function () {
        var g;
        var angles;

        g = new pc.GraphNode('g1');

        g.rotateLocal(10, 0, 0);
        angles = g.getLocalEulerAngles();
        close(angles.x, 10, 0.001);
        close(angles.y, 0, 0.001);
        close(angles.z, 0, 0.001);

        angles = g.getEulerAngles();
        close(angles.x, 10, 0.001);
        close(angles.y, 0, 0.001);
        close(angles.z, 0, 0.001);
    });

    it('GraphNode: rotateLocal in hierarchy', function () {
        var p = new pc.GraphNode('parent');
        var g;
        var angles;

        p.setEulerAngles(1, 2, 3);

        g = new pc.GraphNode('g1');
        p.addChild(g);

        g.rotateLocal(10, 0, 0);
        angles = g.getLocalEulerAngles();
        close(angles.x, 10, 0.001);
        close(angles.y, 0, 0.001);
        close(angles.z, 0, 0.001);

        angles = g.getEulerAngles();
        close(angles.x, 11, 0.001);
        close(angles.y, 2, 0.001);
        close(angles.z, 3, 0.001);
    });

    it('GraphNode: translate in hierarchy', function () {
        var p = new pc.GraphNode('parent');
        var g;
        var pos;

        p.setPosition(10, 20, 30);

        g = new pc.GraphNode('g1');
        p.addChild(g);

        g.translate(10, 20, 30);
        pos = g.getPosition();
        close(pos.x, 20, 0.001);
        close(pos.y, 40, 0.001);
        close(pos.z, 60, 0.001);

        pos = g.getLocalPosition();
        close(pos.x, 10, 0.001);
        close(pos.y, 20, 0.001);
        close(pos.z, 30, 0.001);
    });

    it('GraphNode: translateLocal in hierarchy', function () {
        var p = new pc.GraphNode('parent');
        var g;
        var pos;

        p.setPosition(10, 20, 30);

        g = new pc.GraphNode('g1');
        p.addChild(g);

        g.rotateLocal(0, 180, 0);
        g.translateLocal(10, 20, 30);

        pos = g.getPosition();
        close(pos.x, 0, 0.001);
        close(pos.y, 40, 0.001);
        close(pos.z, 0, 0.001);

        pos = g.getLocalPosition();
        close(pos.x, -10, 0.001);
        close(pos.y, 20, 0.001);
        close(pos.z, -30, 0.001);

    });

    it('GraphNode: frozen flag after reparent and sync for world-dirty node', function () {
        var p = new pc.GraphNode('parent');
        p.syncHierarchy();

        var c = new pc.GraphNode('child');
        c._dirtifyWorld();

        p.addChild(c);
        p.syncHierarchy();

        equal(c._frozen, true);
    });

});
