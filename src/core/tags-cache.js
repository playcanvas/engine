class TagsCache {
    _index = {};

    _key;

    constructor(key = null) {
        this._key = key;
    }

    addItem(item) {
        const tags = item.tags._list;

        for (const tag of tags)
            this.add(tag, item);
    }

    removeItem(item) {
        const tags = item.tags._list;

        for (const tag of tags)
            this.remove(tag, item);
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
        const ind = this._index[tag].list.indexOf(item);
        if (ind === -1)
            return;

        // remove item from index list
        this._index[tag].list.splice(ind, 1);

        // remove item from index keys
        if (this._key)
            delete this._index[tag].keys[item[this._key]];

        // if index empty, remove it
        if (this._index[tag].list.length === 0)
            delete this._index[tag];
    }

    find(args) {
        const index = { };
        const items = [];
        let item, tag, tags, tagsRest, missingIndex;

        const sort = (a, b) => {
            return this._index[a].list.length - this._index[b].list.length;
        };

        for (let i = 0; i < args.length; i++) {
            tag = args[i];

            if (tag instanceof Array) {
                if (tag.length === 0)
                    continue;

                if (tag.length === 1) {
                    tag = tag[0];
                } else {
                    // check if all indexes are in present
                    missingIndex = false;
                    for (let t = 0; t < tag.length; t++) {
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

                    for (let n = 0; n < this._index[tags[0]].list.length; n++) {
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
                for (let n = 0; n < this._index[tag].list.length; n++) {
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
