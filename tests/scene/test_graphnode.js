module('pc.scene.GraphNode');


function buildGraph() {
    var g1 = new pc.scene.GraphNode("g1");
    var g2 = new pc.scene.GraphNode("g2");
    var g3 = new pc.scene.GraphNode("g3");
    
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

test('GraphNode: addChild', function () {
    var g1 = new pc.scene.GraphNode('g1');
    var g2 = new pc.scene.GraphNode('g2');

    g1.addChild(g2);

    equal(g1.getChildren()[0], g2);
});

test('GraphNode: removeChild', function () {
    var g1 = new pc.scene.GraphNode('g1');
    var g2 = new pc.scene.GraphNode('g2');

    g1.addChild(g2);

    g1.removeChild(g2);

    equal(g1.getChildren().length, 0);
});

test('GraphNode: getChildren', function () {
    var g1 = new pc.scene.GraphNode('g1');
    var g2 = new pc.scene.GraphNode('g2');
    var g3 = new pc.scene.GraphNode('g3');

    g1.addChild(g2);
    g1.addChild(g3);

    equal(g1.getChildren()[0], g2);
    equal(g1.getChildren()[1], g3);

});

test('GraphNode: g/setEulerAngles', function () {
    var g1 = new pc.scene.GraphNode('g1');

    g1.setEulerAngles(1,2,3);

    var angles = pc.makeArray(g1.getEulerAngles());
    QUnit.close(angles[0], 1, 0.0001);
    QUnit.close(angles[1], 2, 0.0001);
    QUnit.close(angles[2], 3, 0.0001);
});

test('GraphNode: rotate', function () {
    var g;
    var angles;

    g = new pc.scene.GraphNode('g1');
    g.rotate(10, 0, 0);
    angles = g.getEulerAngles();
    QUnit.close(angles[0], 10, 0.0001);
    QUnit.close(angles[1], 0, 0.0001);
    QUnit.close(angles[2], 0, 0.0001);

    g = new pc.scene.GraphNode('g1');
    g.rotate(0, 10, 0);
    angles = g.getEulerAngles();
    QUnit.close(angles[0], 0, 0.0001);
    QUnit.close(angles[1], 10, 0.0001);
    QUnit.close(angles[2], 0, 0.0001);

    g = new pc.scene.GraphNode('g1');
    g.rotate(0, 0, 10);
    angles = g.getEulerAngles();
    QUnit.close(angles[0], 0, 0.0001);
    QUnit.close(angles[1], 0, 0.0001);
    QUnit.close(angles[2], 10, 0.0001);

    g = new pc.scene.GraphNode('g1');
    g.rotate(10, 20, 30);
    angles = g.getEulerAngles();
    QUnit.close(angles[0], 10, 0.0001);
    QUnit.close(angles[1], 20, 0.0001);
    QUnit.close(angles[2], 30, 0.0001);
});

test('GraphNode: rotate in hierarchy', function () {
    var p = new pc.scene.GraphNode('g0');
    p.setEulerAngles(10,10,10);
    var angles;

    g = new pc.scene.GraphNode('g1');
    p.addChild(g);
    g.rotate(10, 0, 0);
    angles = pc.makeArray(g.getEulerAngles());
    QUnit.close(angles[0], 20, 0.0001);
    QUnit.close(angles[1], 0, 0.0001);
    QUnit.close(angles[2], 0, 0.0001);
    p.removeChild(g);

    g = new pc.scene.GraphNode('g1');
    p.addChild(g);
    g.rotate(0, 10, 0);
    angles = pc.makeArray(g.getEulerAngles());
    QUnit.close(angles[0], 0, 0.0001);
    QUnit.close(angles[1], 20, 0.0001);
    QUnit.close(angles[2], 0, 0.0001);
    p.removeChild(g);

    g = new pc.scene.GraphNode('g1');
    p.addChild(g);
    g.rotate(0, 0, 10);
    angles = pc.makeArray(g.getEulerAngles());
    QUnit.close(angles[0], 0, 0.0001);
    QUnit.close(angles[1], 0, 0.0001);
    QUnit.close(angles[2], 20, 0.0001);
    p.removeChild(g);

    g = new pc.scene.GraphNode('g1');
    p.addChild(g);
    g.rotate(10, 20, 30);
    angles = pc.makeArray(g.getEulerAngles());
    QUnit.close(angles[0], 20, 0.0001);
    QUnit.close(angles[1], 30, 0.0001);
    QUnit.close(angles[2], 40, 0.0001);
    p.removeChild(g);
});

test('GraphNode: rotateLocal', function () {
    var g;
    var angles;

    g = new pc.scene.GraphNode('g1');

    g.rotateLocal(10, 0, 0);
    angles = g.getLocalEulerAngles();
    QUnit.close(angles[0], 10, 0.001);
    QUnit.close(angles[1], 0, 0.001);
    QUnit.close(angles[2], 0, 0.001);

    angles = g.getEulerAngles();
    QUnit.close(angles[0], 10, 0.001);
    QUnit.close(angles[1], 0, 0.001);
    QUnit.close(angles[2], 0, 0.001);
});


test('GraphNode: rotateLocal in hierarchy', function () {
    var p = new pc.scene.GraphNode('parent')
    var g;
    var angles;

    p.setEulerAngles(1,2,3);

    g = new pc.scene.GraphNode('g1');
    p.addChild(g);

    g.rotateLocal(10, 0, 0);
    angles = g.getLocalEulerAngles();
    QUnit.close(angles[0], 10, 0.001);
    QUnit.close(angles[1], 0, 0.001);
    QUnit.close(angles[2], 0, 0.001);

    angles = g.getEulerAngles();
    QUnit.close(angles[0], 11, 0.001);
    QUnit.close(angles[1], 2, 0.001);
    QUnit.close(angles[2], 3, 0.001);
});

test('GraphNode: translate in hierarchy', function () {
    var p = new pc.scene.GraphNode('parent')
    var g;
    var pos;

    p.setPosition(10,20,30);

    g = new pc.scene.GraphNode('g1');
    p.addChild(g);

    g.translate(10, 20, 30);
    pos = g.getPosition();
    QUnit.close(pos[0], 20, 0.001);
    QUnit.close(pos[1], 40, 0.001);
    QUnit.close(pos[2], 60, 0.001);

    pos = g.getLocalPosition();
    QUnit.close(pos[0], 10, 0.001);
    QUnit.close(pos[1], 20, 0.001);
    QUnit.close(pos[2], 30, 0.001);
});

test('GraphNode: translateLocal in hierarchy', function () {
    var p = new pc.scene.GraphNode('parent')
    var g;
    var pos;

    p.setPosition(10,20,30);

    g = new pc.scene.GraphNode('g1');
    p.addChild(g);

    g.rotateLocal(0,180,0);
    g.translateLocal(10, 20, 30);

    pos = g.getPosition();
    QUnit.close(pos[0], 0, 0.001);
    QUnit.close(pos[1], 40, 0.001);
    QUnit.close(pos[2], 0, 0.001);

    pos = g.getLocalPosition();
    QUnit.close(pos[0], -10, 0.001);
    QUnit.close(pos[1], 20, 0.001);
    QUnit.close(pos[2], -30, 0.001);

});

