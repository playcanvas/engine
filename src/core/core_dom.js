pc.dom = function () {
    return {
        getWidth: function (element) {
            return element.offsetWidth;
        },
        
        getHeight: function (element) {
            return element.offsetHeight;
        }
    }
}();
