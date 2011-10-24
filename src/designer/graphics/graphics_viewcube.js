pc.extend(pc.designer.graphics, function() {
    // Private members

    function createTextTexture(textContext, text) {
        // White background
        textContext.fillStyle = 'rgb(76, 82, 93)';
        textContext.fillRect(0, 0, textContext.canvas.width, textContext.canvas.height);
        textContext.fillStyle = 'rgb(184, 189, 197)';
        textContext.fillRect(5, 5, textContext.canvas.width-10, textContext.canvas.height-10);

        // Write white text with black border
        textContext.fillStyle = 'rgb(76, 82, 93)';
        textContext.lineWidth = 2.5;
        textContext.strokeStyle = 'black';
        textContext.save();
        textContext.font = '50px Verdana';
        textContext.textAlign = 'center';
        textContext.textBaseline = 'middle';
        var leftOffset = textContext.canvas.width / 2;
        var topOffset = textContext.canvas.height / 2;
        textContext.strokeText(text, leftOffset, topOffset);
        textContext.fillText(text, leftOffset, topOffset);
        textContext.restore();

        // Create a texture
        textTexture = new pc.gfx.Texture2D();
        textTexture.setSource(textContext.canvas);
        textTexture.setFilterMode(pc.gfx.TextureFilter.LINEAR, pc.gfx.TextureFilter.LINEAR);
        textTexture.setAddressMode(pc.gfx.TextureAddress.CLAMP_TO_EDGE, pc.gfx.TextureAddress.CLAMP_TO_EDGE);
        textTexture.upload();

        return textTexture;
    }

    // Public Interface
    var ViewCube = function () {
        var library = pc.gfx.Device.getCurrent().getProgramLibrary();
        var program = library.getProgram("basic", { vertexColors: false, diffuseMap: true });

        var textCanvas = document.createElement('canvas');
        textCanvas.width = 256;
        textCanvas.height = 128;
        var textContext = textCanvas.getContext("2d");
        
        var lookAts = [
          { pos: [-0.5, 0, 0], target: [-1.0, 0, 0], up: [0,-1,0] },
          { pos: [0.5, 0, 0], target: [1.0, 0, 0], up: [0,-1,0] },
          { pos: [0, 0.5, 0], target: [0, 1.0, 0], up: [0,0,1] },
          { pos: [0, -0.5, 0, 0], target: [0, -1.0, 0], up: [0,0,1] },
          { pos: [0, 0, 0.5], target: [0, 0, 1.0], up: [0,-1,0] },
          { pos: [0, 0, -0.5], target: [0, 0, -1.0], up: [0,-1,0] }
        ];
        this.faces = [
            { name: "LEFT" },
            { name: "RIGHT" },
            { name: "TOP" },
            { name: "BOTTOM" },
            { name: "FRONT" },
            { name: "BACK" }
        ];
        for (var i = 0; i < this.faces.length; i++) {
            this.faces[i].texture = createTextTexture(textContext, this.faces[i].name);
            var faceMaterial = new pc.scene.Material();
            faceMaterial.setParameter("constant_color", [1, 1, 1, 0.35]);
            faceMaterial.setParameter("texture_diffuseMap", this.faces[i].texture);
            faceMaterial.setProgram(program);
            faceMaterial.setState({
                blend: true,
                blendModes: { srcBlend: pc.gfx.BlendMode.SRC_ALPHA, dstBlend: pc.gfx.BlendMode.ONE_MINUS_SRC_ALPHA },
                cull: true,
                depthTest: false,
                depthWrite: false
            });
            this.faces[i].plane = pc.graph.procedural.createPlane({
                material: faceMaterial
            });
            var lookAt = pc.math.mat4.makeLookAt(lookAts[i].pos, lookAts[i].target, lookAts[i].up);
            var rot = pc.math.mat4.makeRotate(-Math.PI / 2.0, [1, 0, 0]);
            this.faces[i].xform = pc.math.mat4.multiply(lookAt, rot);
        }

        this.projection = pc.math.mat4.makePerspective(30, 1, 0.1, 10);
    }

    ViewCube.prototype.render = function (transform) {
        var device = pc.gfx.Device.getCurrent();
        var target = device.getRenderTarget();
        device.updateEnd();
        var oldViewport = target.getViewport();
        target.setViewport({
            x: oldViewport.x + (oldViewport.width - 100),
            y: oldViewport.y + (oldViewport.height - 100),
            width: 100,
            height: 100
        });
        device.setRenderTarget(target);
        device.updateBegin();
        var projId = device.scope.resolve("matrix_projection");
        var viewId = device.scope.resolve("matrix_view");
        var viewProjId = device.scope.resolve("matrix_viewProjection");
        var projMat = projId.getValue();
        var viewMat = viewId.getValue();
        var viewProjMat = viewProjId.getValue();

        projId.setValue(this.projection);
        viewId.setValue(pc.math.mat4.identity);
        viewProjId.setValue(this.projection);

        for (var i = 0; i < this.faces.length; i++) {
            var newView = pc.math.mat4.clone(viewMat);
            newView[12] = 0;
            newView[13] = 0;
            newView[14] = 0;
            var mat = pc.math.mat4.multiply(newView, this.faces[i].xform);
            mat[14] -= 4;
            this.faces[i].plane.dispatch(mat);
        }

        projId.setValue(projMat);
        viewId.setValue(viewMat);
        viewProjId.setValue(viewProjMat);
        
        device.updateEnd();
        target.setViewport(oldViewport);
        device.updateBegin();
    };

    return {
        ViewCube: ViewCube
    }
}());