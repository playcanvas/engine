Object.assign(pc, function () {

    // markup scanner
    var Scanner = function (symbols) {
        this._symbols = symbols;
        this._index = 0;
        this._cur = (this._symbols.length > 0) ? this._symbols[0] : null;
        this._buf = [];
        this._mode = "text";
    };

    Object.assign(Scanner.prototype, {
        // list of scanner tokens
        EOF_TOKEN: 0,
        ERROR_TOKEN: 1,
        TEXT_TOKEN: 2,
        OPEN_BRACKET_TOKEN: 3,
        CLOSE_BRACKET_TOKEN: 4,
        EQUALS_TOKEN: 5,
        STRING_TOKEN: 6,
        IDENTIFIER_TOKEN: 7,
        WHITESPACE_TOKEN: 8,

        // read the next token, ignore whitespace
        read: function () {
            var token = this._read();
            while (token === this.WHITESPACE_TOKEN) {
                token = this._read();
            }
            return token;
        },


        // returns the buffer for the last returned token
        buf: function () {
            return this._buf;
        },

        // returns a string describing the current context (useful when providing error messages)
        getContext: function () {
            if (this._index < this._symbols.length) {
                return "#" + this._index.toString();
            }
        },

        // read the next token from the input stream and return the token
        _read: function () {
            this._buf = [];
            if (this._eof()) {
                return this.EOF_TOKEN;
            }
            return (this._mode === "text") ? this._text() : this._tag();
        },

        // read text block until eof or start of tag
        _text: function () {
            while (true) {
                switch (this._cur) {
                    case null:
                        // reached end of input
                        return (this._buf.length > 0) ? this.TEXT_TOKEN : this.EOF_TOKEN;
                    case "[":
                        // start of tag mode
                        this._mode = "tag";
                        return (this._buf.length > 0) ? this.TEXT_TOKEN : this._tag();
                    case "\\":
                        // handle escape sequence
                        this._next();           // skip \
                        switch (this._cur) {
                            case "[":
                                this._store();
                                break;
                            default:
                                // if we don't recognize the escape sequence, output
                                // the slash without interpretation and continue
                                this._output("\\");
                                break;
                        }
                        break;
                    default:
                        this._store();
                        break;
                }
            }
        },

        // read tag block
        _tag: function () {
            while (true) {
                switch (this._cur) {
                    case null:
                        return this.ERROR_TOKEN;     // tag block wasn't closed
                    case "[":
                        this._store();
                        return this.OPEN_BRACKET_TOKEN;
                    case "]":
                        this._store();
                        this._mode = "text";
                        return this.CLOSE_BRACKET_TOKEN;
                    case "=":
                        this._store();
                        return this.EQUALS_TOKEN;
                    case " ":
                    case "\t":
                    case "\n":
                    case "\r":
                    case "\v":
                    case "\f":
                        return this._whitespace();
                    case "\"":
                        return this._string();
                    default:
                        return this._isIdentifierSymbol(this._cur) ? this._identifier() : this.ERROR_TOKEN;
                }
            }
        },

        _whitespace: function () {
            this._store();
            while (" \t\n\r\v\f".indexOf(this._cur) !== -1) {
                this._store();
            }
            return this.WHITESPACE_TOKEN;
        },

        _string: function () {
            this._next();       // skip "
            while (true) {
                switch (this._cur) {
                    case null:
                        return this.ERROR_TOKEN;
                    case "\"":
                        this._next();           // skip "
                        return this.STRING_TOKEN;
                    default:
                        this._store();
                        break;
                }
            }
        },

        _identifier: function () {
            this._store();
            while (this._cur !== null &&
                    this._isIdentifierSymbol(this._cur)) {
                this._store();
            }
            return this.IDENTIFIER_TOKEN;
        },

        _isIdentifierSymbol: function (s) {
            return s.length === 1 && (s.match(/[A-Z|a-z|0-9|_|-|/]/) !== null);
        },

        _eof: function () {
            return this._cur === null;
        },

        _next: function () {
            if (!this._eof()) {
                this._index++;
                this._cur = (this._index < this._symbols.length) ? this._symbols[this._index] : null;
            }
            return this._cur;
        },

        _store: function () {
            this._buf.push(this._cur);
            return this._next();
        },

        _output: function (c) {
            this._buf.push(c);
        }
    });

    // markup parser
    var Parser = function () {
    };

    Object.assign(Parser.prototype, {
        parse: function (scanner, symbols, tags) {
            while (true) {
                var token = scanner.read();
                switch (token) {
                    case scanner.EOF_TOKEN:
                        return true;
                    case scanner.ERROR_TOKEN:
                        return false;
                    case scanner.TEXT_TOKEN:
                        Array.prototype.push.apply(symbols, scanner.buf());
                        break;
                    case scanner.OPEN_BRACKET_TOKEN:
                        if (!Parser.prototype._parseTag(scanner, symbols, tags)) {
                            return false;
                        }
                        break;
                    default:
                        // any other tag at this point is an error
                        return false;
                }
            }
        },

        _parseTag: function (scanner, symbols, tags) {
            // first token after [ must be an identifier
            var token = scanner.read();
            if (token !== scanner.IDENTIFIER_TOKEN) {
                return false;
            }

            var name = scanner.buf().join("");

            // handle close tags
            if (name[0] === "/") {
                for (var index = tags.length - 1; index >= 0; --index) {
                    if (name === "/" + tags[index].name && tags[index].end === null) {
                        tags[index].end = symbols.length;
                        token = scanner.read();
                        return token === scanner.CLOSE_BRACKET_TOKEN;
                    }
                }
                // matching open tag not found
                return false;
            }

            // else handle open tag
            var tag = {
                name: name,
                value: null,
                attributes: { },
                start: symbols.length,
                end: null
            };

            // read optional tag value
            token = scanner.read();
            if (token === scanner.EQUALS_TOKEN) {
                token = scanner.read();
                if (token !== scanner.STRING_TOKEN) {
                    return false;
                }
                tag.value = scanner.buf().join("");
                token = scanner.read();
            }

            // read optional tag attributes
            while (true) {
                switch (token) {
                    case scanner.CLOSE_BRACKET_TOKEN:
                        tags.push(tag);
                        return true;
                    case scanner.IDENTIFIER_TOKEN:
                        var identifier = scanner.buf().join("");
                        token = scanner.read();
                        if (token !== scanner.EQUALS_TOKEN) {
                            return false;
                        }
                        token = scanner.read();
                        if (token !== scanner.STRING_TOKEN) {
                            return false;
                        }
                        var value = scanner.buf().join("");
                        tag.attributes[identifier] = value;
                        break;
                    default:
                        return false;
                }
                token = scanner.read();
            }
        }
    });

    function debugPrintScanner(scanner) {
        var tokenStrings = ["EOF", "ERROR", "TEXT", "OPEN_BRACKET", "CLOSE_BRACKET", "EQUALS", "STRING", "IDENTIFIER", "WHITESPACE"];
        var token = scanner.read();
        var result = "";
        while (true) {
            result += (result.length > 0 ? "\n" : "") +
                        tokenStrings[token] +
                        " '" + scanner.buf().join("") + "'";
            if (token === scanner.EOF_TOKEN || token === scanner.ERROR_TOKEN) {
                break;
            }
            token = scanner.read();
        }
        console.info(result);
    }

    // copy the contents of source into target and map the values with the
    // provided mapping table.
    function MapAndMerge(target, source, mappings) {
        for (var key in source) {
            if (!source.hasOwnProperty(key)) {
                continue;
            }
            var value = source[key];
            if (value instanceof Object) {
                if (!target.hasOwnProperty(key)) {
                    target[key] = { };
                }
                MapAndMerge(target[key], source[key], mappings);
            } else {
                target[key] = mappings.hasOwnProperty(value) ? mappings[value] : value;
            }
        }
    }

    // get the markup tags which apply to the given symbol. all tags overlapping the
    // symbol must be composed into a single structure.
    function ResolveMarkupTags(tags, mappings, symbolIndex) {
        var result = { };
        for (var index = 0; index < tags.length; ++index) {
            var tag = tags[index];
            if (tag.start <= symbolIndex &&
                (tag.end === null || tag.end > symbolIndex)) {
                var tmp = { };
                tmp[tag.name] = { value: tag.value, attributes: tag.attributes };
                MapAndMerge(result, tmp, mappings);
            }
        }
        return result;
    }

    // evaluate the list of symbols, extract the markup tags and return a
    // structure containing an array of symbol and tags
    function EvaluateMarkup(symbols, mappings) {
        // log scanner output
        // debugPrintScanner(new Scanner(symbols));

        var scanner = new Scanner(symbols);
        var symbols_out = [];
        var tags = [];

        if (!Parser.prototype.parse(scanner, symbols_out, tags)) {
            console.warn("Markup error at " + scanner.getContext());
        }

        // debug print result
        /*
        console.info(symbols_out);
        console.info(tags);
        for (var index = 0; index < symbols_out.length; ++index) {
            console.info({
                symbol: symbols_out[index],
                tags: GetMarkupTag(tags, index)
            });
        }
        //*/

        var result = [];
        for (var index = 0; index < symbols_out.length; ++index) {
            result.push( {
                char: symbols_out[index],
                tags: ResolveMarkupTags(tags, mappings, index)
            });
        }
        return result;
    }

    return {
        EvaluateMarkup: EvaluateMarkup
    };
}());
