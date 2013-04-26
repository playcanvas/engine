pc.extend(pc.resources, function () {
    
    var count = 0;

    /**
    * @name pc.resources.ResourceLoaderDisplay
    * @class Creates a DOMElement containing updated detailed information about what is loading/loaded. Useful for debugging loading errors.
    * This class is only really suitable for debug display at the moment.
    * @param {DOMElement} element The DOMElement to attach this display to
    */
    var ResourceLoaderDisplay = function (element, loader) {

        loader.on('request', this.handleRequest, this);
        loader.on('load', this.handleLoad, this);
        loader.on('error', this.handleError, this);
        loader.on('progress', this.handleProgress, this);
        
        this.addCss();
        
        this._element = element;
        this._domCreate();
    };
    
    ResourceLoaderDisplay.prototype = {
        addCss: function () {
            var styles = [
                '.pc-resourceloaderdisplay-root {',
                '   font-family: sans-serif;',
                '   font-size: 0.7em;',
                '   color: #aaa;',
                '   border-collapse: collapse;',
                '   position: absolute;',
                '   top: 10px;',
                '   left: 10px;',
                '   background-color: black;',
                '   opacity: 0.6;',
                '}',
                '.pc-resourceloaderdisplay-root td {',
                '   border: 1px solid #aaa;',
                '}',
                '.pc-resourceloaderdisplay-subtable {',
                '   border-collapse: collapse;',
                '}'
            ].join('\n');
            
            var style = document.createElement( 'style' );

            document.getElementsByTagName('head')[0].appendChild( style );

            if ( style.styleSheet ) { // IE
                style.styleSheet.cssText = styles;
            } else {
                var cssText = document.createTextNode( styles );
                style.appendChild( cssText );
            }            
        },

        handleRequest: function (request) {
            console.warn('request: ' + request.id)
            this._domAddRequest(request);
        },

        handleLoad: function (request, resource) {
            console.warn('load: ' + request.id)
            var id = 'pc-resourcesloaderdisplay-progress-' + request.id;
            var el = document.getElementsByClassName(id);
            if (el) {
                for(var i = 0; i<el.length; i++) {
                    el[i].textContent = '100%';
                }
            }
        },

        handleError: function (request, error) {
            var id = 'pc-resourcesloaderdisplay-progress-' + request.id;
            var el = document.getElementsByClassName(id);
            if (el) {
                for(var i = 0; i<el.length; i++) {
                    el[i].textContent = error;
                }
            }
        },

        handleProgress: function (value) {

        },

        /**
        * @function
        * @private
        * @name pc.resources.ResourceLoaderDisplay#_domCreate
        * @description Create the DOM structure for the basic table
        */
        _domCreate: function () {
            this._rootTable = document.createElement('table');
            this._rootTable.setAttribute('class', 'pc-resourceloaderdisplay-root');
            this._element.appendChild(this._rootTable);
        },

        _domAddRequest: function (request) {
            var id = 'pc-resourcesloaderdisplay-progress-' + request.id;
            // if (document.getElementsByClass(id).length) {
            //     return;
            // }

            var row = document.createElement('tr');
            var titleEl = document.createElement('td');
            titleEl.textContent = request.identifier;

            var progressEl = document.createElement('td');
            progressEl.className = id;
            progressEl.textContent = '0%';

            row.appendChild(titleEl);
            row.appendChild(progressEl);

            this._rootTable.appendChild(row);
        },

        /**
        * @function
        * @private
        * @name pc.resources.ResourceLoaderDisplay#_sanitizeId
        * @description Clean up the a text string for use as a dom element id
        */
        _sanitizeId: function (id) {
            return id.replace(/\//, '').replace(/\./, '');
        },

    };

    return {
        ResourceLoaderDisplay: ResourceLoaderDisplay
    };
}());