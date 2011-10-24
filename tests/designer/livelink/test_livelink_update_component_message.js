module("pc.designer.LiveLinkUpdateComponentMessage");

test("new", function () {
    var m = new pc.designer.LiveLinkUpdateComponentMessage(1, "component", "attribute", "value");
    
    equal(m.type, pc.designer.LiveLinkMessageType.UPDATE_COMPONENT);
    equal(m.content.id, 1);
    equal(m.content.component, "component");
    equal(m.content.attribute, "attribute");
    equal(m.content.value, "value");    
});

test("serialize", function () {
    var m = new pc.designer.LiveLinkUpdateComponentMessage(1, "component", "attribute", "value");
    m.id = null;
    
    var d = pc.designer.LiveLinkMessage.serialize(m);
    
    equal(d, '{"type":"UPDATE_COMPONENT","content":{"id":1,"component":"component","attribute":"attribute","value":"value"},"id":null,"senderid":null}');
});

test("deserialize", function () {
    var data = '{"type":"UPDATE_COMPONENT","content":{"id":1,"component":"component","attribute":"attribute","value":"value"}}';
    
    var m = pc.designer.LiveLinkMessage.deserialize(data);
    
    equal(m.type, pc.designer.LiveLinkMessageType.UPDATE_COMPONENT);
    equal(m.content.id, 1);
    equal(m.content.component, "component");
    equal(m.content.attribute, "attribute");
    equal(m.content.value, "value");    
});
