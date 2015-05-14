pc.extend(pc, function () {

    function renderMesh(meshInstance, matrix, material) {
        var app = pc.Application.getApplication();
        app.scene.drawCalls.push(meshInstance);
        app.scene.drawCalls.pop();
    }

    return {
        renderMesh: renderMesh
    };
}());
