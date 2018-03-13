module("pc.TextElement", {
    setup: function () {
        this.app = new pc.Application(document.createElement("canvas"));

        stop();

        this.buildElement(start);
    },

    buildElement: function(callback) {
        var entity = new pc.Entity("myEntity", this.app);
        var element = this.app.systems.element.addComponent(entity, { type: pc.ELEMENTTYPE_TEXT });
        element.autoWidth = false;
        element.width = 200;

        var fontAsset = new pc.Asset("Arial", "font", {
            url: "../../../../examples/assets/Arial/Arial.json"
        });

        fontAsset.ready(function() {
            element.fontAsset = fontAsset;
            callback(element);
        }.bind(this));

        this.app.assets.add(fontAsset);
        this.app.assets.load(fontAsset);

        this.entity = entity;
        this.element = element;
        this.app.root.addChild(entity);
    },

    teardown: function () {
        this.app.destroy();
    }
});

test("does not break onto multiple lines if the text is short enough", function () {
    this.element.text = "abcde fghij";
    equal(this.element.lines.length, 1);
    equal(this.element.lines[0], "abcde fghij");
});

test("does not break onto multiple lines if the text element is set to autoWidth", function () {
    this.element.autoWidth = true;
    this.element.text = "abcde fghij klmno pqrst uvwxyz";
    equal(this.element.lines.length, 1);
    equal(this.element.lines[0], "abcde fghij klmno pqrst uvwxyz");
});

test("breaks onto multiple lines if individual lines are too long", function () {
    this.element.text = "abcde fghij klmno pqrst uvwxyz";
    equal(this.element.lines.length, 3);
    equal(this.element.lines[0], "abcde fghij ");
    equal(this.element.lines[1], "klmno pqrst ");
    equal(this.element.lines[2], "uvwxyz");
});

test("breaks individual words if they are too long to fit onto a line by themselves (single word case)", function () {
    this.element.text = "abcdefghijklmnopqrstuvwxyz";
    equal(this.element.lines.length, 3);
    equal(this.element.lines[0], "abcdefghijklm");
    equal(this.element.lines[1], "nopqrstuvwxy");
    equal(this.element.lines[2], "z");
});

test("breaks individual words if they are too long to fit onto a line by themselves (multi word case)", function () {
    this.element.text = "abcdefgh ijklmnopqrstuvwxyz";
    equal(this.element.lines.length, 3);
    equal(this.element.lines[0], "abcdefgh ");
    equal(this.element.lines[1], "ijklmnopqrstu");
    equal(this.element.lines[2], "vwxyz");
});

test("breaks individual characters onto separate lines if the width is really constrained", function () {
    this.element.width = 1;
    this.element.text = "abcdef ghijkl";
    equal(this.element.lines.length, 12);
    equal(this.element.lines[0], "a");
    equal(this.element.lines[1], "b");
    equal(this.element.lines[2], "c");
    equal(this.element.lines[3], "d");
    equal(this.element.lines[4], "e");
    equal(this.element.lines[5], "f ");
    equal(this.element.lines[6], "g");
    equal(this.element.lines[7], "h");
    equal(this.element.lines[8], "i");
    equal(this.element.lines[9], "j");
    equal(this.element.lines[10], "k");
    equal(this.element.lines[11], "l");
});

test("splits lines on \\n", function () {
    this.element.text = "abcde\nfghij";
    equal(this.element.lines.length, 2);
    equal(this.element.lines[0], "abcde");
    equal(this.element.lines[1], "fghij");
});

test("splits lines on \\r", function () {
    this.element.text = "abcde\rfghij";
    equal(this.element.lines.length, 2);
    equal(this.element.lines[0], "abcde");
    equal(this.element.lines[1], "fghij");
});

test("splits lines on multiple \\n", function () {
    this.element.text = "abcde\n\n\nfg\nhij";
    equal(this.element.lines.length, 5);
    equal(this.element.lines[0], "abcde");
    equal(this.element.lines[1], "");
    equal(this.element.lines[2], "");
    equal(this.element.lines[3], "fg");
    equal(this.element.lines[4], "hij");
});
