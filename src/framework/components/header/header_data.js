pc.extend(pc.fw, function () {
    function HeaderComponentData() {
        this.name = "Untitled";
        this.description = "";
    }
    HeaderComponentData = pc.inherits(HeaderComponentData, pc.fw.ComponentData);
    
    return {
        HeaderComponentData: HeaderComponentData
    };
}());
// editor.link.addComponentType("header");


// editor.link.expose({
//     system: "header",
//     variable: "name",
//     displayName: "Name",
//     description: "Name of the component",
//     type: "string",
//     defaultValue: "Untitled"
// });

// editor.link.expose({
//     system: "header",
//     variable: "description",
//     displayName: "Description",
//     description: "Description of the component",
//     type: "string",
//     defaultValue: ""
// });