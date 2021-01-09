class TagsCache {
    constructor(key = null) {
        this._index = {};
        this._key = key;
    }

    addItem(item) {
        var tags = item.tags._list;

        for (var i = 0; i < tags.length; i++)
            this.add(tags[i], item);
    }

    removeItem(item) {
        var tags = item.tags._list;

        for (var i = 0; i < tags.length; i++)
            this.remove(tags[i], item);
    }

    add(tag, item) {
        // already in cache
        if (this._index[tag] && this._index[tag].list.indexOf(item) !== -1)
            return;

        // create index for tag
        if (!this._index[tag]) {
            this._index[tag] = {
                list: []
            };
            // key indexing is available
            if (this._key)
                this._index[tag].keys = { };
        }

        // add to index list
        this._index[tag].list.push(item);

        // add to index keys
        if (this._key)
            this._index[tag].keys[item[this._key]] = item;
    }

    remove(tag, item) {
        // no index created for that tag
        if (!this._index[tag])
            return;

        // check if item not in cache
        if (this._key) {
            // by key
            if (!this._index[tag].keys[item[this._key]])
                return;
        }

        // by position in list
        var ind = this._index[tag].list.indexOf(item);
        if (ind === -1)
            return;

        // remove item from index list
        this._index[tag].list.splice(ind, 1);

        // rmeove item from index keys
        if (this._key)
            delete this._index[tag].keys[item[this._key]];

        // if index empty, remove it
        if (this._index[tag].list.length === 0)
            delete this._index[tag];
    }

    find(args) {
        var self = this;
        var index = { };
        var items = [];
        var i, n, t;
        var item, tag, tags, tagsRest, missingIndex;

        var sort = (a, b) => {
            return self._index[a].list.length - self._index[b].list.length;
        };

        for (i = 0; i < args.length; i++) {
            tag = args[i];

            if (tag instanceof Array) {
                if (tag.length === 0)
                    continue;

                if (tag.length === 1) {
                    tag = tag[0];
                } else {
                    // check if all indexes are in present
                    missingIndex = false;
                    for (t = 0; t < tag.length; t++) {
                        if (!this._index[tag[t]]) {
                            missingIndex = true;
                            break;
                        }
                    }
                    if (missingIndex)
                        continue;

                    // sort tags by least number of matches first
                    tags = tag.slice(0).sort(sort);

                    // remainder of tags for `has` checks
                    tagsRest = tags.slice(1);
                    if (tagsRest.length === 1)
                        tagsRest = tagsRest[0];

                    for (n = 0; n < this._index[tags[0]].list.length; n++) {
                        item = this._index[tags[0]].list[n];
                        if ((this._key ? !index[item[this._key]] : (items.indexOf(item) === -1)) && item.tags.has(tagsRest)) {
                            if (this._key)
                                index[item[this._key]] = true;
                            items.push(item);
                        }
                    }

                    continue;
                }
            }

            if (tag && typeof tag === 'string' && this._index[tag]) {
                for (n = 0; n < this._index[tag].list.length; n++) {
                    item = this._index[tag].list[n];

                    if (this._key) {
                        if (!index[item[this._key]]) {
                            index[item[this._key]] = true;
                            items.push(item);
                        }
                    } else if (items.indexOf(item) === -1) {
                        items.push(item);
                    }
                }
            }
        }

        return items;
    }
}

export { TagsCache };
