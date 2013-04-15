pc.dom = function () {
    return {
        getWidth: function (element) {
            return element.offsetWidth;
        },
        
        getHeight: function (element) {
            return element.offsetHeight;
        },
        
        setText: function (element, text) {
            if (element.textContent) {
                element.textContent = text;
            } else if (element.innerText) {
                element.innerText = text;
            }
        },
        
        getText: function (element) {
            return element.textContent || element.innerText;
        }
    };
}();
