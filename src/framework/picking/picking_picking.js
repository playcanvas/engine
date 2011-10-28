/**
 * @namespace Functionality to allow picking. i.e. identifying Entities from the pixel co-ordinates on the canvas
 * @name pc.fw.picking
 */
pc.fw.picking = function() {

    /**
     * @class Picker object used to identify Entities from the pixel co-ordinate on screen
     * The Picker can be used to identify Entities that are drawn using a RenderComponent
     * or Entities that have a PickComponent. For RenderComponents the Entity is selected if the
     * pixel picked was drawn by the RenderComponent, PickComponents contains a shape which is used
     * to perform the picking.
     * @constructor Create a new instance of a Picker object
     * @param {Object} canvas The canvas element
     * @param {pc.fw.ModelComponentSystem} model The ModelComponentSystem
     * @param {pc.fw.PickComponentSystem} pick The PickComponentSystem
     * @name pc.fw.picking.Picker
     */
    var Picker = function(width, height, model, pick) {
        this._width = width;
        this._height = height;
        this._model = model;
        this._pick = pick;
        
        var library = pc.gfx.Device.getCurrent().getProgramLibrary();
        var pickProgram = library.getProgram("pick", { skinning: false });
        this._pickMaterial = new pc.scene.Material();
        this._pickMaterial.setProgram(pickProgram);

        var pickFrameBuffer = new pc.gfx.FrameBuffer(this._width, this._height, true);
        this._offscreenRenderTarget = new pc.gfx.RenderTarget(pickFrameBuffer);
    };

    Picker.prototype.getWidth = function () {
        return this._width;
    };

    Picker.prototype.getHeight = function () {
        return this._height;
    };

    /**
     * Pick the entity that is visible at (x,y) in screen coordinates
     * Use options to select which entities are available
     * <ul>
     * <li>options.useRender - Include all Render Components [default = true]</li>
     * <li>options.usePick - Include all Pick Components [default = true]</li>
     * <li>options.layers - Only Pick Component in the named layers will be used, an empty Array specifies all layers [default = []]</li>
     * </ul>
     * @param {Object} x
     * @param {Object} y
     * @param {Object} options
     * @function
     * @name pc.fw.picking.Picker.pick
     */
    Picker.prototype.pick = function(x, y, options) {
        var componentIndex;
        var subMeshIndex;
        var entity;
        var model;
        var geometry, geometries;
        var subMesh, subMeshes;
        var i, j;
        var count = 0;
        var rgba = 0;
        var device = pc.gfx.Device.getCurrent();
        var gl = device.gl;
        var entities = {};
        var renderComponents = {};
        var elementWidth = pc.dom.getWidth(device.canvas);
        var elementHeight = pc.dom.getHeight(device.canvas);

        // Set up default options
        options = options || {};
        options.useRender = options.useRender !== undefined ? options.useRender : true;
        options.usePick = options.usePick !== undefined ? options.usePick : true;
        options.layers = options.layers || [];

        if (this._model) {
            renderComponents = this._model._getComponents();
        }

        // Iterate all model Components and add shader program for rendering to buffer.
        for (componentIndex in renderComponents) {
            if (renderComponents.hasOwnProperty(componentIndex)) {
                model = this._model.getModel(renderComponents[componentIndex].entity)
                if (!model) {
                    continue;
                }
                geometries = model.getGeometries();
                for (i = 0; i < geometries.length; i++) {
                    geometry = geometries[i];
                    subMeshes = geometry.getSubMeshes();
                    for (j = 0; j < subMeshes.length; j++) {
                        subMesh = subMeshes[j];
                        subMesh._cachedMaterial = subMesh.getMaterial();
                        subMesh.setMaterial(this._pickMaterial);
                    }
                }
            }
        }

        // Set renderTarget to offscreen buffer
        device.setRenderTarget(this._offscreenRenderTarget);
        device.clear({
            color: [0.0, 0.0, 0.0, 1.0],
            depth: 1.0,
            flags: pc.gfx.ClearFlag.COLOR | pc.gfx.ClearFlag.DEPTH
        });
        device.updateBegin();

        // Render all render components in a different color and store a lookup
        count = 1;        
        if(options.useRender) {
            for (componentIndex in renderComponents) {
                if (renderComponents.hasOwnProperty(componentIndex)) {
    
                    rgba = (count << 8) + 255
                    color = pc.math.intToBytes32(rgba);
                    this._pickMaterial.setParameter("pick_color", [color[0] / 255, color[1] / 255, color[2] / 255, color[3] / 255]);
                    entities[rgba] = {
                        entity: renderComponents[componentIndex].entity,
                        index: 0
                    };
                    count++;
    
                    model = this._model.getModel(renderComponents[componentIndex].entity);
                    if(model) {
                        model.dispatch();
                    }
                }
            }            
        }
        
        if (this._pick && options.usePick) {
            this._pick.draw(pc.callback(this, function(entity, component, index) {
                if (!options.layers.length || options.layers.indexOf(component.layer) >= 0) {
                    rgba = (count << 8) + 255
                    color = pc.math.intToBytes32(rgba);
                    this._pick.setRenderColor(entity, [color[0] / 255, color[1] / 255, color[2] / 255, color[3] / 255]);
                    entities[rgba] = {
                        entity: entity,
                        index: index
                    };
                    count++;
                }
            }));
        }

        device.updateEnd();

        // Remove picking shader program and restore original
        for (componentIndex in renderComponents) {
            if (renderComponents.hasOwnProperty(componentIndex)) {
                model = this._model.getModel(renderComponents[componentIndex].entity)
                if (!model) {
                    continue;
                }
                geometries = model.getGeometries();
                for (i = 0; i < geometries.length; i++) {
                    geometry = geometries[i];
                    subMeshes = geometry.getSubMeshes();
                    for (j = 0; j < subMeshes.length; j++) {
                        subMesh = subMeshes[j];
                        subMesh.setMaterial(subMesh._cachedMaterial);
                        delete subMesh._cachedMaterial;
                    }
                }
            }
        }

        var pixel = new ArrayBuffer(4);
        var pixelBytes = new Uint8Array(pixel);
        gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixelBytes);

        return {
            entity: entities[pc.math.bytesToInt(pixelBytes)] ? entities[pc.math.bytesToInt(pixelBytes)].entity : null,
            index: entities[pc.math.bytesToInt(pixelBytes)] ? entities[pc.math.bytesToInt(pixelBytes)].index : null
        };
    };


    return {
        Picker: Picker
    };
} ();
