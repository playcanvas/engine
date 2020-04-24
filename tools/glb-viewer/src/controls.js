// initialize controls
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

document.getElementById('wireframe').onclick = function (e) {
    viewer.setWireframe(this.checked);
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

document.getElementById('directl').oninput = function (e) {
    viewer.setDirectLighting(Number.parseFloat(this.value));
};

document.getElementById('envl').oninput = function (e) {
    viewer.setEnvLighting(Number.parseFloat(this.value));
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

    var theviewer = viewer;
    for (var i = 0; i < morphList.length; ++i) {
        var label = document.createElement('label');
        label.innerHTML += morphList[i];

        var input = document.createElement('input');
        input.class = 'setting';
        input.type = 'range';
        input.min = 0;
        input.max = 1;
        input.value = 0;
        input.step = 'any';
        input.oninput = (function(morph) {
            return function () {
                theviewer.setMorphWeight(morph, this.value);
            }
        })(morphList[i]);

        var div = document.createElement('div');
        div.appendChild(label);
        div.appendChild(input);

        morphListElement.appendChild(div);
    }
};

/* eslint-enable no-unused-vars */
