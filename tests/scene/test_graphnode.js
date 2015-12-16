module('pc.GraphNode');


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

test('GraphNode: addLabel', function () {
    var node = buildGraph();

    node.addLabel("new label");

    ok(node.hasLabel("new label"));
    equal(node.getLabels().length, 1);
    equal(node.getLabels()[0], "new label");
});

test('GraphNode: removeLabel', function () {
    var node = buildGraph();

    node.addLabel("new label");
    node.removeLabel("new label");

    equal(node.hasLabel("new label"), false);
    equal(node.getLabels().length, 0);

});

test('GraphNode: findByLabel', function () {
    var node = buildGraph();

    var child = node.getChildren()[0];
    var grandchild = child.getChildren()[0]
    child.addLabel("new label");

    var found = node.findByLabel("new label");

    equal(found.length, 1);
    equal(found[0].getName(), child.getName());
});

test('GraphNode: findByName same entity', function () {
    var node = buildGraph();
    var child = node.getChildren()[0];
    var grandchild = child.getChildren()[0];

    var found = node.findByName('g1');
    equal(found, node);
});

test('GraphNode: findByName grandchild', function () {
    var node = buildGraph();
    var child = node.getChildren()[0];
    var grandchild = child.getChildren()[0];

    var found = node.findByName('g3');
    equal(found, grandchild);
});

test('GraphNode: findByName when entity does not exist', function () {
    var node = buildGraph();
    var child = node.getChildren()[0];
    var grandchild = child.getChildren()[0];

    var found = node.findByName('g4');
    equal(found, null);
});

test('GraphNode: findByPath without slashes', function () {
    var node = buildGraph();
    var child = node.getChildren()[0];
    var grandchild = child.getChildren()[0];

    var found = node.findByPath('g2');
    equal(found, child);
});

test('GraphNode: findByPath with slashes', function () {
    var node = buildGraph();
    var child = node.getChildren()[0];
    var grandchild = child.getChildren()[0];

    var found = node.findByPath('g2/g3');

    equal(found, grandchild);
});

test('GraphNode: findByPath does not include same entity', function () {
    var node = buildGraph();
    var child = node.getChildren()[0];
    var grandchild = child.getChildren()[0];

    var found = node.findByPath('g1/g2/g3');
    equal(found, null);
});

test('GraphNode: findByPath when entity does not exist', function () {
    var node = buildGraph();
    var child = node.getChildren()[0];
    var grandchild = child.getChildren()[0];

    var found = node.findByPath('g4');
    equal(found, null);
});

test('GraphNode: getPath', function () {
    var node = buildGraph();
    var child = node.getChildren()[0];
    var grandchild = child.getChildren()[0];

    equal(grandchild.getPath(), 'g2/g3');
});

test('GraphNode: getPath of root entity', function () {
    var node = buildGraph();
    equal(node.getPath(), '');
});

test('GraphNode: addChild', function () {
    var g1 = new pc.GraphNode('g1');
    var g2 = new pc.GraphNode('g2');

    g1.addChild(g2);

    equal(g1.getChildren()[0], g2);
});

test('GraphNode: insertChild', function () {
    var g1 = new pc.GraphNode('g1');
    var g2 = new pc.GraphNode('g2');
    var g3 = new pc.GraphNode('g3');

    g1.addChild(g2);
    g1.insertChild(g3, 0);

    equal(g1.getChildren()[0], g3);
    equal(g1.getChildren()[1], g2);
});

test('GraphNode: removeChild', function () {
    var g1 = new pc.GraphNode('g1');
    var g2 = new pc.GraphNode('g2');

    g1.addChild(g2);

    g1.removeChild(g2);

    equal(g1.getChildren().length, 0);
});

test('GraphNode: reparent', function () {
    var g1 = new pc.GraphNode('g1');
    var g2 = new pc.GraphNode('g2');
    var g3 = new pc.GraphNode('g3');

    g1.addChild(g2);
    g2.reparent(g3);

    equal(g3.getChildren().length, 1);
    equal(g3.getChildren()[0], g2);
    equal(g1.getChildren().length, 0);
});

test('GraphNode: reparent at specific index', function () {
    var g1 = new pc.GraphNode('g1');
    var g2 = new pc.GraphNode('g2');
    var g3 = new pc.GraphNode('g3');
    var g4 = new pc.GraphNode('g4');

    g1.addChild(g2);

    g3.addChild(g4);

    g2.reparent(g3, 0);

    equal(g3.getChildren().length, 2);
    equal(g3.getChildren()[0], g2);
    equal(g1.getChildren().length, 0);

    g2.reparent(g3, 1);
    equal(g3.getChildren().length, 2);
    equal(g3.getChildren()[0], g4);
    equal(g3.getChildren()[1], g2);
});

test('GraphNode: getChildren', function () {
    var g1 = new pc.GraphNode('g1');
    var g2 = new pc.GraphNode('g2');
    var g3 = new pc.GraphNode('g3');

    g1.addChild(g2);
    g1.addChild(g3);

    equal(g1.getChildren()[0], g2);
    equal(g1.getChildren()[1], g3);

});

test('GraphNode: g/setEulerAngles', function () {
    var g1 = new pc.GraphNode('g1');

    g1.setEulerAngles(1,2,3);

    var angles = g1.getEulerAngles();
    QUnit.close(angles.x, 1, 0.0001);
    QUnit.close(angles.y, 2, 0.0001);
    QUnit.close(angles.z, 3, 0.0001);
});

test('GraphNode: rotate', function () {
    var g;
    var angles;

    g = new pc.GraphNode('g1');
    g.rotate(10, 0, 0);
    angles = g.getEulerAngles();
    QUnit.close(angles.x, 10, 0.0001);
    QUnit.close(angles.y, 0, 0.0001);
    QUnit.close(angles.z, 0, 0.0001);

    g = new pc.GraphNode('g1');
    g.rotate(0, 10, 0);
    angles = g.getEulerAngles();
    QUnit.close(angles.x, 0, 0.0001);
    QUnit.close(angles.y, 10, 0.0001);
    QUnit.close(angles.z, 0, 0.0001);

    g = new pc.GraphNode('g1');
    g.rotate(0, 0, 10);
    angles = g.getEulerAngles();
    QUnit.close(angles.x, 0, 0.0001);
    QUnit.close(angles.y, 0, 0.0001);
    QUnit.close(angles.z, 10, 0.0001);

    g = new pc.GraphNode('g1');
    g.rotate(10, 20, 30);
    angles = g.getEulerAngles();
    QUnit.close(angles.x, 10, 0.0001);
    QUnit.close(angles.y, 20, 0.0001);
    QUnit.close(angles.z, 30, 0.0001);
});

test('GraphNode: rotate in hierarchy', function () {
    var p = new pc.GraphNode('g0');
    p.setEulerAngles(10,10,10);
    var angles;

    g = new pc.GraphNode('g1');
    p.setEulerAngles(10,0,0);
    p.addChild(g);
    g.rotate(10, 0, 0);
    angles = g.getEulerAngles();
    QUnit.close(angles.x, 20, 0.0001);
    QUnit.close(angles.y, 0, 0.0001);
    QUnit.close(angles.z, 0, 0.0001);
    p.removeChild(g);

    g = new pc.GraphNode('g1');
    p.setEulerAngles(0,10,0);
    p.addChild(g);
    g.rotate(0, 10, 0);
    angles = g.getEulerAngles();
    QUnit.close(angles.x, 0, 0.0001);
    QUnit.close(angles.y, 20, 0.0001);
    QUnit.close(angles.z, 0, 0.0001);
    p.removeChild(g);

    g = new pc.GraphNode('g1');
    p.setEulerAngles(0,0,10);
    p.addChild(g);
    g.rotate(0, 0, 10);
    angles = g.getEulerAngles();
    QUnit.close(angles.x, 0, 0.0001);
    QUnit.close(angles.y, 0, 0.0001);
    QUnit.close(angles.z, 20, 0.0001);
    p.removeChild(g);
});

test('GraphNode: rotateLocal', function () {
    var g;
    var angles;

    g = new pc.GraphNode('g1');

    g.rotateLocal(10, 0, 0);
    angles = g.getLocalEulerAngles();
    QUnit.close(angles.x, 10, 0.001);
    QUnit.close(angles.y, 0, 0.001);
    QUnit.close(angles.z, 0, 0.001);

    angles = g.getEulerAngles();
    QUnit.close(angles.x, 10, 0.001);
    QUnit.close(angles.y, 0, 0.001);
    QUnit.close(angles.z, 0, 0.001);
});


test('GraphNode: rotateLocal in hierarchy', function () {
    var p = new pc.GraphNode('parent')
    var g;
    var angles;

    p.setEulerAngles(1,2,3);

    g = new pc.GraphNode('g1');
    p.addChild(g);

    g.rotateLocal(10, 0, 0);
    angles = g.getLocalEulerAngles();
    QUnit.close(angles.x, 10, 0.001);
    QUnit.close(angles.y, 0, 0.001);
    QUnit.close(angles.z, 0, 0.001);

    angles = g.getEulerAngles();
    QUnit.close(angles.x, 11, 0.001);
    QUnit.close(angles.y, 2, 0.001);
    QUnit.close(angles.z, 3, 0.001);
});

test('GraphNode: translate in hierarchy', function () {
    var p = new pc.GraphNode('parent')
    var g;
    var pos;

    p.setPosition(10,20,30);

    g = new pc.GraphNode('g1');
    p.addChild(g);

    g.translate(10, 20, 30);
    pos = g.getPosition();
    QUnit.close(pos.x, 20, 0.001);
    QUnit.close(pos.y, 40, 0.001);
    QUnit.close(pos.z, 60, 0.001);

    pos = g.getLocalPosition();
    QUnit.close(pos.x, 10, 0.001);
    QUnit.close(pos.y, 20, 0.001);
    QUnit.close(pos.z, 30, 0.001);
});

test('GraphNode: translateLocal in hierarchy', function () {
    var p = new pc.GraphNode('parent')
    var g;
    var pos;

    p.setPosition(10,20,30);

    g = new pc.GraphNode('g1');
    p.addChild(g);

    g.rotateLocal(0,180,0);
    g.translateLocal(10, 20, 30);

    pos = g.getPosition();
    QUnit.close(pos.x, 0, 0.001);
    QUnit.close(pos.y, 40, 0.001);
    QUnit.close(pos.z, 0, 0.001);

    pos = g.getLocalPosition();
    QUnit.close(pos.x, -10, 0.001);
    QUnit.close(pos.y, 20, 0.001);
    QUnit.close(pos.z, -30, 0.001);

});

