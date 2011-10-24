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


