pc.extend(pc, function () {
    DesignerComponentData = function () {
        this.fillWindow = true;
        this.width = 800;
        this.height = 450;
    };
    DesignerComponentData = pc.inherits(DesignerComponentData, pc.ComponentData);
    
    return {
        DesignerComponentData: DesignerComponentData
    };
}());

// editor.link.addComponentType("designer");

// editor.link.expose({
//     system: 'designer',
//     variable: 'fillWindow',
//     displayName: 'Fill Window',
//     description: 'Canvas will resize to fill window, this setting overrides the width and height',
//     type: 'boolean',
//     defaultValue: true
// });

// editor.link.expose({
//     system: 'designer',
//     variable: 'width',
//     displayName: 'Width',
//     description: 'Horizontal resolution of the application canvas',
//     type: 'number',
//     options: {
//         min: '0',
//         step: '100'        
//     },
//     defaultValue: 800 
// });

// editor.link.expose({
//     system: 'designer',
//     variable: 'height',
//     displayName: 'Height',
//     description: 'Vertical resolution of the application canvas',
//     type: 'number',
//     options: {
//         min: '0',
//         step: '100'
//     },
//     defaultValue: 450
// });