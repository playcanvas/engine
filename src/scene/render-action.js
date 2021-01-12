// class representing an entry in the final order of rendering of cameras and layers in the engine
// this is populated at runtime based on LayerComposition
class RenderAction {
    constructor() {

        // index into a layer stored in LayerComposition.layerList
        this.layerIndex = 0;

        // index into a camera array of the layer, stored in Layer.cameras
        this.cameraIndex = 0;

        // render target this render action renders to (taken from either camera or layer)
        this.renderTarget = null;
    }
}

export { RenderAction };
