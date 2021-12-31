import { path } from '../../src/core/path.js';

import { expect } from 'chai';

describe('path', function () {

    describe('#extractPath', function () {

        it('removes from filename from paths', function () {
            expect(path.extractPath('path/to/file')).to.equal('./path/to');
            expect(path.extractPath('./path/to/file')).to.equal('./path/to');
            expect(path.extractPath('../path/to/file')).to.equal('../path/to');
            expect(path.extractPath('/path/to/file')).to.equal('/path/to');
            expect(path.extractPath('path/../path/to/file.txt')).to.equal('./path/../path/to');
        });

    });

    describe('#getBasename', function () {

        it('returns basename from filename', function () {

            expect(path.getBasename('path/to/file.txt')).to.equal('file.txt');
            expect(path.getBasename('path/to/directory')).to.equal('directory');

        });

    });

    describe('#getDirectory', function () {

        it('handles various paths', function () {
            expect(path.getDirectory('folder/file.txt')).to.equal('folder');
            expect(path.getDirectory('folder/another')).to.equal('folder');
            expect(path.getDirectory('folder/another/')).to.equal('folder/another');
            expect(path.getDirectory('')).to.equal('');
            expect(path.getDirectory('/')).to.equal('');
        });

    });


    describe('#getExtension', function () {

        it('returns the extension of a file', function () {
            expect(path.getExtension('file.txt')).to.equal('.txt');
        });

        it('returns the extension of a file with a path', function () {
            expect(path.getExtension('path/to/file.txt')).to.equal('.txt');
        });

        it('returns the extension of a file with a path and query string', function () {
            expect(path.getExtension('path/to/file.txt?query=string')).to.equal('.txt');
        });

        it('returns the empty string if the file has no extension', function () {
            expect(path.getExtension('file')).to.equal('');
        });

    });

    describe('#isRelativePath', function () {

        it('returns true for relative paths', function () {
            expect(path.isRelativePath('path/to/file')).to.be.true;
            expect(path.isRelativePath('./path/to/file')).to.be.true;
            expect(path.isRelativePath('../path/to/file')).to.be.true;
            expect(path.isRelativePath('path/../path/to/file.txt')).to.be.true;
        });

        it('returns false for absolute paths', function () {
            expect(path.isRelativePath('/path/to/file')).to.be.false;
            expect(path.isRelativePath('/path/../path/to/file.txt')).to.be.false;
        });

    });

    describe('#join', function () {

        it('handles two path sections', function () {
            expect(path.join('a', 'b')).to.equal('a/b');
            expect(path.join('a', '/b')).to.equal('/b');
            expect(path.join('/a', 'b')).to.equal('/a/b');
            expect(path.join('a', 'b/c')).to.equal('a/b/c');
            expect(path.join('a/b', 'c')).to.equal('a/b/c');
            expect(path.join('a', 'b/')).to.equal('a/b/');
            expect(path.join('a', '/b/')).to.equal('/b/');
            expect(path.join('a', 'b/')).to.equal('a/b/');
            expect(path.join('http://a.com', 'b')).to.equal('http://a.com/b');
            expect(path.join('', 'a/b')).to.equal('a/b');
            expect(path.join('a/b', '')).to.equal('a/b');
        });

        it('handles more than two path sections', function () {
            expect(path.join('a', 'b', 'c')).to.equal('a/b/c');
            expect(path.join('a', '/b', 'c')).to.equal('/b/c');
            expect(path.join('/a', 'b', 'c')).to.equal('/a/b/c');
            expect(path.join('a/b', 'c', 'd')).to.equal('a/b/c/d');
            expect(path.join('a', 'b/c', 'd')).to.equal('a/b/c/d');
            expect(path.join('a', 'b', 'c/d')).to.equal('a/b/c/d');
            expect(path.join('a', 'b', 'c/')).to.equal('a/b/c/');
            expect(path.join('a', '/b', 'c/')).to.equal('/b/c/');
            expect(path.join('http://a.com', 'b', 'c')).to.equal('http://a.com/b/c');
            expect(path.join('', 'b', 'c/')).to.equal('b/c/');
            expect(path.join('b', 'c/', '')).to.equal('b/c/');
            expect(path.join('b', 'c/', '/')).to.equal('/');
            expect(path.join('a', 'b', 'c', 'd')).to.equal('a/b/c/d');
        });

        it('handles invalid values', function () {
            expect(function () {
                path.join('a', undefined);
            }).to.throw();
        });

    });

    describe('#normalize', function () {

        it('normalizes any path', function () {
            expect(path.normalize('a/b/c')).to.equal('a/b/c');
            expect(path.normalize('/a/b/c')).to.equal('/a/b/c');
            expect(path.normalize('a//b/c')).to.equal('a/b/c');
            expect(path.normalize('a/../b/c')).to.equal('b/c');
            expect(path.normalize('a/./b/c')).to.equal('a/b/c');
            expect(path.normalize('a/b/c/..')).to.equal('a/b');
            expect(path.normalize('a/b/c/')).to.equal('a/b/c/');
            expect(path.normalize('../a/b/c/')).to.equal('../a/b/c/');
//            expect(path.normalize('../../a/b/c')).to.equal('../../a/b/c');
            expect(path.normalize('/')).to.equal('/');
            expect(path.normalize('../')).to.equal('../');
//            expect(path.normalize('./')).to.equal('./');
//            expect(path.normalize('././')).to.equal('./');
//            expect(path.normalize('../../')).to.equal('../../');
//            expect(path.normalize('.')).to.equal('.');
            expect(path.normalize('./../.')).to.equal('..');
        });

    });

    describe('#split', function () {

        it('splits a path into path and filename', function () {
            expect(path.split('path/to/file.txt')).to.deep.equal(['path/to', 'file.txt']);
        });

    });

});
