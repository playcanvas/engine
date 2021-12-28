import { GraphNode } from '../../src/scene/graph-node.js';
import { Mat4 } from '../../src/math/mat4.js';
import { Vec3 } from '../../src/math/vec3.js';

import { expect } from 'chai';

describe("GraphNode", function () {

    describe("#constructor", function () {

        it('supports zero arguments', function () {
            const node = new GraphNode();
            expect(node.children).to.be.instanceof(Array);
            expect(node.children.length).to.equal(0);
            expect(node.enabled).to.equal(false);
            expect(node.forward).to.be.instanceof(Vec3);
            expect(node.graphDepth).to.equal(0);
            expect(node.name).to.equal('Untitled');
            expect(node.parent).to.equal(null);
            expect(node.path).to.equal('');
            expect(node.right).to.be.instanceof(Vec3);
            expect(node.up).to.be.instanceof(Vec3);
        });

        it('supports one argument', function () {
            const node = new GraphNode('Root');
            expect(node.children).to.be.instanceof(Array);
            expect(node.children.length).to.equal(0);
            expect(node.enabled).to.equal(false);
            expect(node.forward).to.be.instanceof(Vec3);
            expect(node.graphDepth).to.equal(0);
            expect(node.name).to.equal('Root');
            expect(node.parent).to.equal(null);
            expect(node.path).to.equal('');
            expect(node.right).to.be.instanceof(Vec3);
            expect(node.up).to.be.instanceof(Vec3);
        });
    });

    describe("#addChild", function () {

        it('adds a child node', function () {
            const root = new GraphNode();
            const child = new GraphNode();
            root.addChild(child);
            expect(root.children).to.be.instanceof(Array);
            expect(root.children.length).to.equal(1);
            expect(root.children[0]).to.equal(child);
            expect(child.parent).to.equal(root);
        });

    });

    describe('#find', function () {

        it('finds a node by property', function () {
            const root = new GraphNode();
            const child = new GraphNode('Child');
            root.addChild(child);

            let res;
            res = root.find('name', 'Untitled');
            expect(res).to.be.instanceof(Array);
            expect(res.length).to.equal(1);
            expect(res[0]).to.equal(root);

            res = root.find('name', 'Child');
            expect(res).to.be.instanceof(Array);
            expect(res.length).to.equal(1);
            expect(res[0]).to.equal(child);

            res = root.find('name', 'Not Found');
            expect(res).to.be.instanceof(Array);
            expect(res.length).to.equal(0);
        });

        it('finds a node by filter function', function () {
            const root = new GraphNode();
            const child = new GraphNode('Child');
            root.addChild(child);

            let res;
            res = root.find(function (node) {
                return node.name === 'Untitled';
            });
            expect(res).to.be.instanceof(Array);
            expect(res.length).to.equal(1);
            expect(res[0]).to.equal(root);

            res = root.find(function (node) {
                return node.name === 'Child';
            });
            expect(res).to.be.instanceof(Array);
            expect(res.length).to.equal(1);
            expect(res[0]).to.equal(child);

            res = root.find(function (node) {
                return node.name === 'Not Found';
            });
            expect(res).to.be.instanceof(Array);
            expect(res.length).to.equal(0);
        });

    });

    describe('#findByName', function () {
        
        it('finds a node by name', function () {
            const node = new GraphNode();
            const child = new GraphNode();
            child.name = 'child';
            node.addChild(child);
            expect(node.findByName('child')).to.equal(child);
        });

        it('returns null if no node is found', function () {
            const node = new GraphNode();
            const child = new GraphNode();
            child.name = 'child';
            node.addChild(child);
            expect(node.findByName('not-found')).to.equal(null);
        });

    });

    describe('#findByPath', function () {

        it('finds a child by path', function () {
            const root = new GraphNode();
            const child = new GraphNode('Child');
            root.addChild(child);
            expect(root.findByPath('Child')).to.equal(child);
        });

        it('finds a grandchild by path', function () {
            const root = new GraphNode();
            const child = new GraphNode('Child');
            const grandchild = new GraphNode('Grandchild');
            root.addChild(child);
            child.addChild(grandchild);
            expect(root.findByPath('Child/Grandchild')).to.equal(grandchild);
        });

        it('returns null if no node is found', function () {
            const root = new GraphNode();
            const child = new GraphNode('Child');
            root.addChild(child);
            expect(root.findByPath('not-found')).to.equal(null);
        });

    });

    describe('#getEulerAngles', function () {

        it('returns the euler angles', function () {
            const node = new GraphNode();
            const angles = node.getEulerAngles();
            expect(angles).to.be.instanceof(Vec3);
            expect(angles.x).to.equal(0);
            expect(angles.y).to.equal(0);
            expect(angles.z).to.equal(0);
        });

    });

    describe('#getLocalScale', function () {

        it('returns the local scale', function () {
            const node = new GraphNode();
            const scale = node.getLocalScale();
            expect(scale).to.be.instanceof(Vec3);
            expect(scale.x).to.equal(1);
            expect(scale.y).to.equal(1);
            expect(scale.z).to.equal(1);
        });

    });

    describe('#getLocalTransform', function () {

        it('returns an identity matrix for a newly created node', function () {
            const node = new GraphNode();
            const transform = node.getLocalTransform();
            expect(transform).to.be.instanceof(Mat4);
            expect(transform.equals(Mat4.IDENTITY)).to.be.true;
        });

    });

    describe('#getWorldTransform', function () {

        it('returns an identity matrix for a newly created node', function () {
            const node = new GraphNode();
            const transform = node.getWorldTransform();
            expect(transform).to.be.instanceof(Mat4);
            expect(transform.equals(Mat4.IDENTITY)).to.be.true;
        });

    });

    describe('#insertChild', function () {

        it('inserts a single child node', function () {
            const root = new GraphNode();
            const child = new GraphNode();
            root.insertChild(child, 0);
            expect(root.children).to.be.instanceof(Array);
            expect(root.children.length).to.equal(1);
            expect(root.children[0]).to.equal(child);
            expect(child.parent).to.equal(root);
        });

        it('inserts a child node at the beginning', function () {
            const root = new GraphNode();
            const child1 = new GraphNode();
            const child2 = new GraphNode();
            root.insertChild(child1, 0);
            root.insertChild(child2, 0);
            expect(root.children).to.be.instanceof(Array);
            expect(root.children.length).to.equal(2);
            expect(root.children[0]).to.equal(child2);
            expect(root.children[1]).to.equal(child1);
            expect(child1.parent).to.equal(root);
            expect(child2.parent).to.equal(root);
        });

        it('inserts a child node at the end', function () {
            const root = new GraphNode();
            const child1 = new GraphNode();
            const child2 = new GraphNode();
            root.insertChild(child1, 0);
            root.insertChild(child2, 1);
            expect(root.children).to.be.instanceof(Array);
            expect(root.children.length).to.equal(2);
            expect(root.children[0]).to.equal(child1);
            expect(root.children[1]).to.equal(child2);
            expect(child1.parent).to.equal(root);
            expect(child2.parent).to.equal(root);
        });

    });

    describe('#isAncestorOf', function () {

        it('returns true if the node is an ancestor of the given node', function () {
            const root = new GraphNode();
            const child = new GraphNode();
            root.addChild(child);
            expect(root.isAncestorOf(child)).to.be.true;
        });

        it('returns false if the node is not an ancestor of the given node', function () {
            const root = new GraphNode();
            const child = new GraphNode();
            expect(root.isAncestorOf(child)).to.be.false;
        });

    });

    describe('#isDescendantOf', function () {

        it('returns true if the node is a descendant of the given node', function () {
            const root = new GraphNode();
            const child = new GraphNode();
            root.addChild(child);
            expect(child.isDescendantOf(root)).to.be.true;
        });

        it('returns false if the node is not a descendant of the given node', function () {
            const root = new GraphNode();
            const child = new GraphNode();
            expect(child.isDescendantOf(root)).to.be.false;
        });

    });

    describe("#removeChild", function () {

        it('removes a child node', function () {
            const node = new GraphNode();
            const child = new GraphNode();
            node.addChild(child);
            node.removeChild(child);
            expect(node.children).to.be.instanceof(Array);
            expect(node.children.length).to.equal(0);
            expect(child.parent).to.equal(null);
        });

    });

    describe('#reparent', function () {
        
        it('reparents a child node', function () {
            const node = new GraphNode();
            const child = new GraphNode();
            node.addChild(child);
            const newParent = new GraphNode();
            child.reparent(newParent);
            expect(node.children).to.be.instanceof(Array);
            expect(node.children.length).to.equal(0);
            expect(newParent.children).to.be.instanceof(Array);
            expect(newParent.children.length).to.equal(1);
            expect(newParent.children[0]).to.equal(child);
            expect(child.parent).to.equal(newParent);
        });

    });

    describe('#translate', function () {
        
        it('translates hierarchical nodes with number arguments', function () {
            const root = new GraphNode();
            const child = new GraphNode();
            root.addChild(child);

            root.translate(1, 2, 3);
            child.translate(1, 2, 3);

            let pos;
            pos = root.getPosition();
            expect(pos).to.be.instanceof(Vec3);
            expect(pos.x).to.equal(1);
            expect(pos.y).to.equal(2);
            expect(pos.z).to.equal(3);

            pos = child.getPosition();
            expect(pos).to.be.instanceof(Vec3);
            expect(pos.x).to.equal(2);
            expect(pos.y).to.equal(4);
            expect(pos.z).to.equal(6);
        });

        it('translates hierarchical nodes with a vector argument', function () {
            const root = new GraphNode();
            const child = new GraphNode();
            root.addChild(child);

            root.translate(new Vec3(1, 2, 3));
            child.translate(new Vec3(1, 2, 3));

            let pos;
            pos = root.getPosition();
            expect(pos).to.be.instanceof(Vec3);
            expect(pos.x).to.equal(1);
            expect(pos.y).to.equal(2);
            expect(pos.z).to.equal(3);

            pos = child.getPosition();
            expect(pos).to.be.instanceof(Vec3);
            expect(pos.x).to.equal(2);
            expect(pos.y).to.equal(4);
            expect(pos.z).to.equal(6);
        });

    });

});    
