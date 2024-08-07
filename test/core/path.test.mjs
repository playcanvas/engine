import { path } from '../../src/core/path.js';

import { expect } from 'chai';

describe('path', () => {

    describe('#extractPath', () => {

        it('removes from filename from paths', () => {
            expect(path.extractPath('path/to/file')).to.equal('./path/to');
            expect(path.extractPath('./path/to/file')).to.equal('./path/to');
            expect(path.extractPath('../path/to/file')).to.equal('../path/to');
            expect(path.extractPath('/path/to/file')).to.equal('/path/to');
            expect(path.extractPath('path/../path/to/file.txt')).to.equal('./path/../path/to');
        });

    });

    describe('#getBasename', () => {

        it('returns basename from filename', () => {

            expect(path.getBasename('path/to/file.txt')).to.equal('file.txt');
            expect(path.getBasename('path/to/directory')).to.equal('directory');

        });

    });

    describe('#getDirectory', () => {

        it('handles various paths', () => {
            expect(path.getDirectory('folder/file.txt')).to.equal('folder');
            expect(path.getDirectory('folder/another')).to.equal('folder');
            expect(path.getDirectory('folder/another/')).to.equal('folder/another');
            expect(path.getDirectory('')).to.equal('');
            expect(path.getDirectory('/')).to.equal('');
        });

    });


    describe('#getExtension', () => {

        it('returns the extension of a file', () => {
            expect(path.getExtension('file.txt')).to.equal('.txt');
        });

        it('returns the extension of a file with a path', () => {
            expect(path.getExtension('path/to/file.txt')).to.equal('.txt');
        });

        it('returns the extension of a file with a path and query string', () => {
            expect(path.getExtension('path/to/file.txt?query=string')).to.equal('.txt');
        });

        it('returns the empty string if the file has no extension', () => {
            expect(path.getExtension('file')).to.equal('');
        });

    });

    describe('#isRelativePath', () => {

        it('returns true for relative paths', () => {
            expect(path.isRelativePath('path/to/file')).to.be.true;
            expect(path.isRelativePath('./path/to/file')).to.be.true;
            expect(path.isRelativePath('../path/to/file')).to.be.true;
            expect(path.isRelativePath('path/../path/to/file.txt')).to.be.true;
        });

        it('returns false for absolute paths', () => {
            expect(path.isRelativePath('/path/to/file')).to.be.false;
            expect(path.isRelativePath('/path/../path/to/file.txt')).to.be.false;
        });

    });

    describe('#join', () => {

        it('handles two path sections', () => {
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

        it('handles more than two path sections', () => {
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

        it('handles invalid values', () => {
            expect(() => {
                path.join('a', undefined);
            }).to.throw();
        });

    });

    describe('#normalize', () => {

        it('normalizes any path', () => {
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

    describe('#split', () => {

        it('splits a path into path and filename', () => {
            expect(path.split('path/to/file.txt')).to.deep.equal(['path/to', 'file.txt']);
        });

    });

});
