/**
 * @namespace All code related to integrating the PlayCanvas Designer tool with the engine. 
 * @name pc.designer
 * @private
 */
pc.designer = function () {
    // Private members
    
    // Public Interface
    /**
     * @name pc.designer.Application
     * @class The Application that runs the design view in the PlayCanvas Designer
     * @param {Object} canvas
     * @param {Object} options
     * @extends pc.fw.Application
     * @private
     */
    var Application = function (canvas, options) {
        var gizmo, designer;

        // Create systems that are only used by the Designer
        gizmo = new pc.fw.GizmoComponentSystem(this.context);
        designer = new pc.designer.DesignerComponentSystem(this.context);

        this.grid = new pc.designer.graphics.Grid();
        this.viewCube = new pc.designer.graphics.ViewCube();

        this.quadView = {
            bottomLeft: {
                cameraName: 'Left'
            },
            bottomRight: {
                cameraName: 'Perspective'
            },
            topLeft: {
                cameraName: 'Top'
            },
            topRight: {
                cameraName: 'Front'
            }
        };
        this.activeViewport = {
            name: 'bottomRight',
            maximized: true
        };
        
        this.resize(canvas.width, canvas.height);
    }
    Application = Application.extendsFrom(pc.fw.Application)

    Application.prototype.init = function () {
    };
    
    Application.prototype.render = function () {
        var inTools = !!window.pc.apps.designer;
        var context = this.context;
        
        context.root.syncHierarchy();

        var device = this.graphicsDevice;
        device.setCurrent();
        var backBuffer = pc.gfx.FrameBuffer.getBackBuffer();
        var backBufferTarget = new pc.gfx.RenderTarget(backBuffer);

        // Give viewport(s) a grey border
        device.setRenderTarget(backBufferTarget);
        device.updateBegin();
        device.clear({
            color: [0.5, 0.5, 0.5, 1],
            flags: pc.gfx.ClearFlag.COLOR
        });
        device.updateEnd();

        // Render the quad view viewports
        var renderViewport = function (viewport, active) {
            // FIXME: This breaks if the user has created entities with the same names as the default cameras
            var cameraEntity = context.root.findOne("getName", viewport.cameraName);
            if (cameraEntity) {
                if (active) {
                    // Render a yellow border around the active viewport
                    var avp = this.quadView[this.activeViewport.name].viewport;
                    var vp = { x: avp.x - 1, y: avp.y - 1, width: avp.width + 2, height: avp.height + 2 };
                    backBufferTarget.setViewport(vp);
                    device.setRenderTarget(backBufferTarget);
                    device.updateBegin();
                    device.clear({
                        color: [1, 1, 0, 1],
                        flags: pc.gfx.ClearFlag.COLOR
                    });
                    device.updateEnd();
                }
                
                var camera = context.systems.camera.get(cameraEntity, "cam");
                // Link the named camera to the relevant viewport
                camera.setRenderTarget(viewport.target);

                if (camera.getProjection() === pc.scene.Projection.ORTHOGRAPHIC) {
                    var vw = camera.getViewWindow();
                    camera.setViewWindow(pc.math.vec2.create(vw[1] * viewport.viewport.width / viewport.viewport.height, vw[1]));
                }

                context.systems.camera.push(cameraEntity);
                context.systems.camera.frameBegin();

                pc.fw.ComponentSystem.render(context, inTools);

                context.scene.enqueue("opaque", (function(grid) {
                        return function () {
                            grid.render(pc.math.mat4.clone(pc.math.mat4.identity));
                        }
                    })(this.grid));
                context.scene.enqueue("overlay", (function(viewCube) {
                        return function () {
                            viewCube.render();
                        }
                    })(this.viewCube));

                context.scene.dispatch(context.systems.camera._camera);
                context.scene.flush();

                context.systems.camera.frameEnd();
                context.systems.camera.pop();
            }
        }.bind(this);
        
        if (this.activeViewport.maximized) {
            var viewport = this.quadView[this.activeViewport.name];
            renderViewport(viewport, true);
        } else {
            for (var viewportName in this.quadView) {
                var viewport = this.quadView[viewportName];
                renderViewport(viewport, viewportName === this.activeViewport.name);
            }
        }
    };

    Application.prototype.resize = function (w, h) {
        // Set the effective resolution of the canvas to the new styled width and height
        this.canvas.width = w;
        this.canvas.height = h;

        // Calculate the viewports of each quad view
        var halfWidth = Math.floor(w / 2);
        var halfHeight = Math.floor(h / 2);
        this.quadView['bottomLeft'].viewport = { x: 0, y: 0, width: halfWidth, height: halfHeight };
        this.quadView['bottomRight'].viewport = { x: halfWidth, y: 0, width: w - halfWidth, height: halfHeight };
        this.quadView['topLeft'].viewport = { x: 0, y: halfHeight, width: halfWidth, height: h - halfHeight };
        this.quadView['topRight'].viewport = { x: halfWidth, y: halfHeight, width: w - halfWidth, height: h - halfHeight };
        // Override the maximized viewport size if necessary
        if (this.activeViewport.maximized) {
            this.quadView[this.activeViewport.name].viewport = { x: 0, y: 0, width: w, height: h }
        }

        // Adjust to allow for a nice border around each viewport of 2 pixels
        for (var viewportName in this.quadView) {
            var viewport = this.quadView[viewportName];
            viewport.viewport.x += 2;
            viewport.viewport.y += 2;
            viewport.viewport.width -= 4;
            viewport.viewport.height -= 4;
        }

        var backBuffer = pc.gfx.FrameBuffer.getBackBuffer();
        for (var viewportName in this.quadView) {
            var viewport = this.quadView[viewportName];
            viewport.target = new pc.gfx.RenderTarget(backBuffer, viewport.viewport);
        }
    }

    Application.prototype.enableQuadView = function (enabled) {
        this.activeViewport.maximized = !enabled;
        this.resize(this.canvas.width, this.canvas.height);
    };

    Application.prototype.setCameraOnViewport = function (viewport, camera) {
        var camera = this.context.root.findOne("getGuid", camera);
        this.quadView[viewport].camera = camera;
    };

    Application.prototype.getActiveViewport = function () {
        var activeViewport = (this.activeViewport.maximized) ? 
            new pc.gfx.RenderTarget(pc.gfx.FrameBuffer.getBackBuffer()).getViewport() :
            this.quadView[this.activeViewport.name].target.getViewport();
        console.log('VIEWPORT: ' + activeViewport.x + ' ' + activeViewport.y + ' ' + activeViewport.width + ' ' + activeViewport.height);
        return activeViewport;
    };

    Application.prototype.enableViewport = function (viewportName) {
        // Can only switch active viewport if quad view is active
        this.activeViewport.name = viewportName;
        var cameraEntity = this.context.root.findOne("getName", this.quadView[viewportName].cameraName);
        if (cameraEntity) {
            this.context.systems.camera.push(cameraEntity);
        }
    };

    /**
     * Called when one or more entities are selected
     * @param {Object} entities List of entity guids
     * @private
     */
    Application.prototype.select = function(entities) {
        var index, selection = [];
        
        for (index = 0; index < entities.length; ++index) {
            selection.push(this.context.root.findOne("getGuid", entities[index]));
        }
        this.context.systems.gizmo.setSelection(selection);
    }

    return {
        Application: Application
    };
}();
