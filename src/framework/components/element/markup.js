// markup scanner

// list of scanner tokens
const EOF_TOKEN = 0;
const ERROR_TOKEN = 1;
const TEXT_TOKEN = 2;
const OPEN_BRACKET_TOKEN = 3;
const CLOSE_BRACKET_TOKEN = 4;
const EQUALS_TOKEN = 5;
const STRING_TOKEN = 6;
const IDENTIFIER_TOKEN = 7;
const WHITESPACE_TOKEN = 8;
const WHITESPACE_CHARS = " \t\n\r\v\f";
const IDENTIFIER_REGEX = /[A-Z|a-z|0-9|_|-|/]/;

class Scanner {
    constructor(symbols) {
        this._symbols = symbols;
        this._index = 0;
        this._last = 0;
        this._cur = (this._symbols.length > 0) ? this._symbols[0] : null;
        this._buf = [];
        this._mode = "text";
        this._error = null;
    }

    // read the next token, ignore whitespace
    read() {
        var token = this._read();
        while (token === WHITESPACE_TOKEN) {
            token = this._read();
        }
        if (token !== EOF_TOKEN && token !== ERROR_TOKEN) {
            this._last = this._index;
        }
        return token;
    }

    // returns the buffer for the last returned token
    buf() {
        return this._buf;
    }

    // returns the index of end of the last successful token extraction
    last() {
        return this._last;
    }

    // return the error message
    error() {
        return this._error;
    }

    // print the scanner output
    debugPrint() {
        var tokenStrings = ["EOF", "ERROR", "TEXT", "OPEN_BRACKET", "CLOSE_BRACKET", "EQUALS", "STRING", "IDENTIFIER", "WHITESPACE"];
        var token = this.read();
        var result = "";
        while (true) {
            result += (result.length > 0 ? "\n" : "") +
                        tokenStrings[token] +
                        " '" + this.buf().join("") + "'";
            if (token === EOF_TOKEN || token === ERROR_TOKEN) {
                break;
            }
            token = this.read();
        }
        return result;
    }

    // read the next token from the input stream and return the token
    _read() {
        this._buf = [];
        if (this._eof()) {
            return EOF_TOKEN;
        }
        return (this._mode === "text") ? this._text() : this._tag();
    }

    // read text block until eof or start of tag
    _text() {
        while (true) {
            switch (this._cur) {
                case null:
                    // reached end of input
                    return (this._buf.length > 0) ? TEXT_TOKEN : EOF_TOKEN;
                case "[":
                    // start of tag mode
                    this._mode = "tag";
                    return (this._buf.length > 0) ? TEXT_TOKEN : this._tag();
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
    }

    // read tag block
    _tag() {
        while (true) {
            switch (this._cur) {
                case null:
                    this._error = "unexpected end of input reading tag";
                    return ERROR_TOKEN;
                case "[":
                    this._store();
                    return OPEN_BRACKET_TOKEN;
                case "]":
                    this._store();
                    this._mode = "text";
                    return CLOSE_BRACKET_TOKEN;
                case "=":
                    this._store();
                    return EQUALS_TOKEN;
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
                    if (!this._isIdentifierSymbol(this._cur)) {
                        this._error = "unrecognized character";
                        return ERROR_TOKEN;
                    }
                    return this._identifier();
            }
        }
    }

    _whitespace() {
        this._store();
        while (WHITESPACE_CHARS.indexOf(this._cur) !== -1) {
            this._store();
        }
        return WHITESPACE_TOKEN;
    }

    _string() {
        this._next();       // skip "
        while (true) {
            switch (this._cur) {
                case null:
                    this._error = "unexpected end of input reading string";
                    return ERROR_TOKEN;
                case "\"":
                    this._next();           // skip "
                    return STRING_TOKEN;
                default:
                    this._store();
                    break;
            }
        }
    }

    _identifier() {
        this._store();
        while (this._cur !== null &&
                this._isIdentifierSymbol(this._cur)) {
            this._store();
        }
        return IDENTIFIER_TOKEN;
    }

    _isIdentifierSymbol(s) {
        return s.length === 1 && (s.match(IDENTIFIER_REGEX) !== null);
    }

    _eof() {
        return this._cur === null;
    }

    _next() {
        if (!this._eof()) {
            this._index++;
            this._cur = (this._index < this._symbols.length) ? this._symbols[this._index] : null;
        }
        return this._cur;
    }

    _store() {
        this._buf.push(this._cur);
        return this._next();
    }

    _output(c) {
        this._buf.push(c);
    }
}

// markup parser
class Parser {
    constructor(symbols) {
        this._scanner = new Scanner(symbols);
        this._error = null;
    }

    // parse the incoming symbols placing resulting symbols in symbols
    // and tags in tags
    // tags is an array of the following structure:
    // {
    //     name: string;                    // tag name, for example 'color'
    //     value: string;                   // optional tag value, for example '#ff0000'
    //     attributes: {                    // list of attributes
    //         key: value;                  // optional key/value pairs
    //     }
    //     start: int;                      // first symbol to which this tag applies
    //     end: int;                        // last symbol to which this tag applies
    // }
    parse(symbols, tags) {
        while (true) {
            var token = this._scanner.read();
            switch (token) {
                case EOF_TOKEN:
                    return true;
                case ERROR_TOKEN:
                    return false;
                case TEXT_TOKEN:
                    Array.prototype.push.apply(symbols, this._scanner.buf());
                    break;
                case OPEN_BRACKET_TOKEN:
                    if (!this._parseTag(symbols, tags)) {
                        return false;
                    }
                    break;
                default:
                    // any other tag at this point is an error
                    return false;
            }
        }
    }

    // access an error message if the parser failed
    error() {
        return "Error evaluating markup at #" + this._scanner.last().toString() +
                " (" + (this._scanner.error() || this._error) + ")";
    }

    _parseTag(symbols, tags) {
        // first token after [ must be an identifier
        var token = this._scanner.read();
        if (token !== IDENTIFIER_TOKEN) {
            this._error = "expected identifier";
            return false;
        }

        var name = this._scanner.buf().join("");

        // handle close tags
        if (name[0] === "/") {
            for (var index = tags.length - 1; index >= 0; --index) {
                if (name === "/" + tags[index].name && tags[index].end === null) {
                    tags[index].end = symbols.length;
                    token = this._scanner.read();
                    if (token !== CLOSE_BRACKET_TOKEN) {
                        this._error = "expected close bracket";
                        return false;
                    }
                    return true;
                }
            }
            this._error = "failed to find matching tag";
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
        token = this._scanner.read();
        if (token === EQUALS_TOKEN) {
            token = this._scanner.read();
            if (token !== STRING_TOKEN) {
                this._error = "expected string";
                return false;
            }
            tag.value = this._scanner.buf().join("");
            token = this._scanner.read();
        }

        // read optional tag attributes
        while (true) {
            switch (token) {
                case CLOSE_BRACKET_TOKEN:
                    tags.push(tag);
                    return true;
                case IDENTIFIER_TOKEN:
                    var identifier = this._scanner.buf().join("");
                    token = this._scanner.read();
                    if (token !== EQUALS_TOKEN) {
                        this._error = "expected equals";
                        return false;
                    }
                    token = this._scanner.read();
                    if (token !== STRING_TOKEN) {
                        this._error = "expected string";
                        return false;
                    }
                    var value = this._scanner.buf().join("");
                    tag.attributes[identifier] = value;
                    break;
                default:
                    this._error = "expected close bracket or identifier";
                    return false;
            }
            token = this._scanner.read();
        }
    }
}

// copy the contents of source object into target object (like a deep version
// of assign)
function merge(target, source) {
    for (var key in source) {
        if (!source.hasOwnProperty(key)) {
            continue;
        }
        var value = source[key];
        if (value instanceof Object) {
            if (!target.hasOwnProperty(key)) {
                target[key] = { };
            }
            merge(target[key], source[key]);
        } else {
            target[key] = value;
        }
    }
}

function combineTags(tags) {
    if (tags.length === 0) {
        return null;
    }
    var result = { };
    for (var index = 0; index < tags.length; ++index) {
        var tag = tags[index];
        var tmp = { };
        tmp[tag.name] = { value: tag.value, attributes: tag.attributes };
        merge(result, tmp);
    }
    return result;
}

// this function performs a simple task, but tries to do so in a relatively
// efficient manner. given the list of tags extracted from the text and
// ordered by start position, it calculates for each output symbol, the
// resulting effective tags.
// to do this we must determine which tags overlap each character and merge the
// tags together (since tags found later in the text can override the values of
// tags found earlier).
// returns an array containing the tag structure (or null) for each symbol
function resolveMarkupTags(tags, numSymbols) {
    var index;

    if (tags.length === 0) {
        return null;
    }

    // make list of tag start/end edges
    var edges = { };
    for (index = 0; index < tags.length; ++index) {
        var tag = tags[index];
        if (!edges.hasOwnProperty(tag.start)) {
            edges[tag.start] = { open: [tag], close: null };
        } else {
            if (edges[tag.start].open === null) {
                edges[tag.start].open = [tag];
            } else {
                edges[tag.start].open.push(tag);
            }
        }

        if (!edges.hasOwnProperty(tag.end)) {
            edges[tag.end] = { open: null, close: [tag] };
        } else {
            if (edges[tag.end].close === null) {
                edges[tag.end].close = [tag];
            } else {
                edges[tag.end].close.push(tag);
            }
        }
    }

    // build tag instances from open/close edges
    var tagStack = [];

    function removeTags(tags) {
        tagStack = tagStack.filter( function (tag) {
            return tags.find(function (t) {
                return t === tag;
            }) === undefined;
        });
    }

    function addTags(tags) {
        for (var index = 0; index < tags.length; ++index) {
            tagStack.push(tags[index]);
        }
    }

    var edgeKeys = Object.keys(edges).sort( function (a, b) {
        return a - b;
    });

    var resolvedTags = [];
    for (index = 0; index < edgeKeys.length; ++index) {
        var edge = edges[edgeKeys[index]];

        // remove close tags
        if (edge.close !== null) {
            removeTags(edge.close);
        }

        // add open tags
        if (edge.open !== null) {
            addTags(edge.open);
        }

        // store the resolved tags
        resolvedTags.push( {
            start: edgeKeys[index],
            tags: combineTags(tagStack)
        } );
    }

    // assign the resolved tags per-character
    var result = [];
    var prevTag = null;
    for (index = 0; index < resolvedTags.length; ++index) {
        var resolvedTag = resolvedTags[index];
        while (result.length < resolvedTag.start) {
            result.push(prevTag ? prevTag.tags : null);
        }
        prevTag = resolvedTag;
    }
    while (result.length < numSymbols) {
        result.push(null);
    }

    return result;
}

// evaluate the list of symbols, extract the markup tags and return an
// array of symbols and an array of symbol tags
function evaluateMarkup(symbols) {
    // log scanner output
    // console.info((new Scanner(symbols)).debugPrint());

    var parser = new Parser(symbols);
    var stripped_symbols = [];
    var tags = [];

    if (!parser.parse(stripped_symbols, tags)) {
        console.warn(parser.error());
        return {
            symbols: symbols,
            tags: null
        };
    }

    // if any tags were not correctly closed, return failure
    var invalidTag = tags.find(function (t) {
        return t.end === null;
    });

    if (invalidTag) {
        console.warn("Markup error: found unclosed tag='" + invalidTag.name + "'");
        return {
            symbols: symbols,
            tags: null
        };
    }

    // revolve tags per-character
    var resolved_tags = resolveMarkupTags(tags, stripped_symbols.length);

    return {
        symbols: stripped_symbols,
        tags: resolved_tags
    };
}

class Markup {
    constructor() {}

    static evaluate(symbols) {
        return evaluateMarkup(symbols);
    }
}

export { Markup };
