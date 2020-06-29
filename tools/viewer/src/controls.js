// initialize controls

// populate select inputs with manifest assets
var handleAssetManifest = function (err, result) {
    if (err) {
        console.warn(err);
    } else {
        var models = document.getElementById('model');
        result.models.forEach(function (model) {
            var option = document.createElement("option");
            option.text = model.label;
            option.value = model.filename;
            models.add(option);
        });

        var skyboxes = document.getElementById('skybox');
        result.skyboxes.forEach(function (skybox) {
            var option = document.createElement("option");
            option.text = skybox.label;
            option.value = skybox.filename;
            skyboxes.add(option);
        });
    }
};

document.getElementById('model').onchange = function (e) {
    if (this.value) {
        if (viewer.load("models/" + this.value) && !e.shiftKey) {
            viewer.resetScene();
        }
    } else {
        viewer.resetScene();
    }
};

document.getElementById('shiny').onclick = function (e) {
    viewer.setShowShinyBall(this.checked);
};

document.getElementById('stats').onclick = function (e) {
    viewer.setStats(this.checked);
};

document.getElementById('wireframe').onclick = function (e) {
    viewer.setShowWireframe(this.checked);
};

document.getElementById('bounds').onclick = function (e) {
    viewer.setShowBounds(this.checked);
};

document.getElementById('skeleton').onclick = function (e) {
    viewer.setShowSkeleton(this.checked);
};

document.getElementById('normals').oninput = function (e) {
    viewer.setNormalLength(Number.parseFloat(this.value));
};

document.getElementById('fov').oninput = function (e) {
    viewer.setFov(Number.parseFloat(this.value));
};

document.getElementById('directl').oninput = function (e) {
    viewer.setDirectLighting(Number.parseFloat(this.value));
};

document.getElementById('envl').oninput = function (e) {
    viewer.setEnvLighting(Number.parseFloat(this.value));
};

document.getElementById('skybox').onchange = function (e) {
    if (this.value) {
        viewer.load("skybox/" + this.value);
    } else {
        viewer.clearSkybox();
    }
};

document.getElementById('play').onclick = function () {
    viewer.play();
};

document.getElementById('stop').onclick = function () {
    viewer.stop();
};

document.getElementById('speed').oninput = function (e) {
    viewer.setSpeed(Number.parseFloat(this.value));
};

document.getElementById('graphs').onclick = function (e) {
    viewer.setShowGraphs(this.checked);
};

var animList = document.getElementById('anim-list');

/* eslint-disable no-unused-vars */

// called when animations are loaded
var onAnimationsLoaded = function (animationList) {
    // clear previous list
    animList.innerHTML = "";

    var theviewer = viewer;
    for (var i = 0; i < animationList.length; ++i) {
        var button = document.createElement('button');
        button.innerHTML += animationList[i];
        button.onclick = (function (animation) {
            return function () {
                theviewer.play(animation);
            };
        })(animationList[i]);
        var li = document.createElement('li');
        li.appendChild(button);
        animList.appendChild(li);
    }
};

var morphListElement = document.getElementById('morph-targets');

var onMorphTargetsLoaded = function (morphList) {
    morphListElement.innerHTML = "";
    morphListElement.height = 150;

    var theviewer = viewer;
    for (var i = 0; i < morphList.length; ++i) {
        var morph = morphList[i];
        var input;
        var label = document.createElement('label');
        label.innerHTML += morph.name;
        label.style.width = "130px";

        if (morph.hasOwnProperty("weight")) {

            input = document.createElement('input');
            input.style.width = "100px";
            input.class = 'setting';
            input.step = 'any';
            input.type = 'range';
            input.min = 0;
            input.max = 1;
            input.value = morph.weight.toString();
            input.oninput = (function (morph) {
                return function () {
                    theviewer.setMorphWeight(morph, this.value);
                };
            })(morph.name);
        }

        var div = document.createElement('div');
        div.appendChild(label);

        if (input) {
            div.appendChild(input);
        }

        morphListElement.appendChild(div);
    }
};

/* eslint-enable no-unused-vars */
