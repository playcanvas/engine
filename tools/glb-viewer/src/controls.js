
var animList = document.getElementById('anim-list');

// called when animations are loaded
var onAnimationsLoaded = function (animationList) {
    // clear previous list
    animList.innerHTML = "";

    for (var i = 0; i < animationList.length; ++i) {
        var button = document.createElement('button');
        button.innerHTML = button.innerHTML + animationList[i];
        button.onclick = (function (animation) {
            return function () {
                viewer.play(animation);
            }
        })(animationList[i]);
        var li = document.createElement('li');
        li.appendChild(button);
        animList.appendChild(li);
    }
};
