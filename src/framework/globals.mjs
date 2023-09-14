import { GraphicsDeviceAccess } from "../platform/graphics/graphics-device-access.mjs";

let currentApplication;

function getApplication() {
    return currentApplication;
}

function setApplication(app) {
    currentApplication = app;
    GraphicsDeviceAccess.set(app?.graphicsDevice);
}

export {
    getApplication,
    setApplication
};
