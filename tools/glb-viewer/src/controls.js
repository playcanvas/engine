// initialize controls
document.getElementById('play').onclick = function () {
    viewer.play();
};

document.getElementById('stop').onclick = function () {
    viewer.stop();
};

document.getElementById('speed').onchange = function (e) {
    viewer.setSpeed(Number.parseFloat(this.value));
};

document.getElementById('speed').oninput = function (e) {
    viewer.setSpeed(Number.parseFloat(this.value));
};

document.getElementById('graphs').onclick = function (e) {
    viewer.setGraphs(this.checked);
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

/* eslint-enable no-unused-vars */
