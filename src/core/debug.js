let table = null;
let row = null;
let title = null;
let field = null;

function init() {
    table = document.createElement('table');
    row = document.createElement('tr');
    title = document.createElement('td');
    field = document.createElement('td');

    table.style.cssText = 'position:absolute;font-family:sans-serif;font-size:12px;color:#cccccc';
    table.style.top = '0px';
    table.style.left = '0px';
    table.style.border = 'thin solid #cccccc';

    document.body.appendChild(table);
}

/**
 * @private
 * @name debug
 * @namespace
 */
const debug = {
    /**
     * @private
     * @function
     * @name debug.display
     * @description Display an object and its data in a table on the page.
     * @param {object} data - The object to display.
     */
    display: function (data) {
        if (!table) {
            init();
        }

        table.innerHTML = '';
        for (const key in data) {
            const r = row.cloneNode();
            const t = title.cloneNode();
            const f = field.cloneNode();

            t.textContent = key;
            f.textContent = data[key];

            r.appendChild(t);
            r.appendChild(f);
            table.appendChild(r);
        }
    }
};

export { debug };
