import { Application } from '../../framework/application.js';

function getDefaultMaterial() {
    return Application.getApplication().scene.defaultMaterial;
}

export { getDefaultMaterial };