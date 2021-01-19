let currentApplication;

function getApplication() {
    return currentApplication;
}

function setApplication(app) {
    currentApplication = app;
}

export {
    getApplication,
    setApplication
};