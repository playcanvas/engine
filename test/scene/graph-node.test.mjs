import { GraphNode } from '../../src/scene/graph-node.js';
import { Mat4 } from '../../src/core/math/mat4.js';
import { Quat } from '../../src/core/math/quat.js';
import { Tags } from '../../src/core/tags.js';
import { Vec3 } from '../../src/core/math/vec3.js';

import { expect } from 'chai';

describe('GraphNode', function () {

    describe('#children', function () {

        it('should be an empty array by default', function () {
            const root = new GraphNode();
            expect(root.children).to.be.an('array');
            expect(root.children).to.be.empty;
        });

        it('should be an array of GraphNode', function () {
            const root = new GraphNode();
            const child = new GraphNode();
            root.addChild(child);
            expect(root.children).to.be.an('array').with.lengthOf(1);
            expect(root.children[0]).to.be.an.instanceof(GraphNode);
        });

    });

    describe('#enabled', function () {

        it('should be false by default', function () {
            const root = new GraphNode();
            expect(root.enabled).to.be.false;
        });

    });

    describe('#graphDepth', function () {

        it('should be 0 by default', function () {
            const root = new GraphNode();
            expect(root.graphDepth).to.equal(0);
        });

        it('should be 1 if the node is a child', function () {
            const root = new GraphNode();
            const child = new GraphNode();
            root.addChild(child);
            expect(child.graphDepth).to.equal(1);
        });

        it('should be 2 if the node is a grandchild', function () {
            const root = new GraphNode();
            const child = new GraphNode();
            const grandChild = new GraphNode();
            root.addChild(child);
            child.addChild(grandChild);
            expect(grandChild.graphDepth).to.equal(2);
        });

    });

    describe('#parent', function () {

        it('should be null by default', function () {
            const node = new GraphNode();
            expect(node.parent).to.be.null;
        });

        it('should be set to the parent node', function () {
            const parent = new GraphNode();
            const child = new GraphNode();
            parent.addChild(child);
            expect(child.parent).to.equal(parent);
        });

    });

    describe('#name', function () {

        it('should be an \'Untitled\' by default', function () {
            const node = new GraphNode();
            expect(node.name).to.equal('Untitled');
        });

        it('can be set via the constructor', function () {
            const node = new GraphNode('root');
            expect(node.name).to.equal('root');
        });

        it('can be set to a new name', function () {
            const node = new GraphNode('node');
            node.name = 'root';
            expect(node.name).to.equal('root');
        });

    });

    describe('#path', function () {

        it('returns empty string for root node', function () {
            const root = new GraphNode('root');
            expect(root.path).to.equal('');
        });

        it('returns path to child node', function () {
            const root = new GraphNode('root');
            const child = new GraphNode('child');
            root.addChild(child);
            expect(child.path).to.equal('child');
        });

        it('returns path to grandchild node', function () {
            const root = new GraphNode('root');
            const child = new GraphNode('child');
            const grandchild = new GraphNode('grandchild');
            root.addChild(child);
            child.addChild(grandchild);
            expect(grandchild.path).to.equal('child/grandchild');
        });

    });

    describe('#root', function () {

        it('returns itself for root node', function () {
            const root = new GraphNode('root');
            expect(root.root).to.equal(root);
        });

        it('returns root node for child node', function () {
            const root = new GraphNode('root');
            const child = new GraphNode('child');
            root.addChild(child);
            expect(child.root).to.equal(root);
        });

        it('returns root node for grandchild node', function () {
            const root = new GraphNode('root');
            const child = new GraphNode('child');
            const grandchild = new GraphNode('grandchild');
            root.addChild(child);
            child.addChild(grandchild);
            expect(grandchild.root).to.equal(root);
        });

    });

    describe('#tags', function () {

        it('should be empty by default', function () {
            const node = new GraphNode();
            expect(node.tags).to.be.an.instanceof(Tags);
            expect(node.tags.size).to.equal(0);
        });

    });

    describe('#constructor()', function () {

        it('supports zero arguments', function () {
            const node = new GraphNode();
            expect(node.children).to.be.an('array').with.lengthOf(0);
            expect(node.enabled).to.equal(false);
            expect(node.forward).to.be.an.instanceof(Vec3);
            expect(node.graphDepth).to.equal(0);
            expect(node.name).to.equal('Untitled');
            expect(node.parent).to.equal(null);
            expect(node.path).to.equal('');
            expect(node.right).to.be.an.instanceof(Vec3);
            expect(node.up).to.be.an.instanceof(Vec3);
        });

        it('supports one argument', function () {
            const node = new GraphNode('root');
            expect(node.children).to.be.an('array').with.lengthOf(0);
            expect(node.enabled).to.equal(false);
            expect(node.forward).to.be.an.instanceof(Vec3);
            expect(node.graphDepth).to.equal(0);
            expect(node.name).to.equal('root');
            expect(node.parent).to.equal(null);
            expect(node.path).to.equal('');
            expect(node.right).to.be.an.instanceof(Vec3);
            expect(node.up).to.be.an.instanceof(Vec3);
        });
    });

    describe('#addChild()', function () {

        it('adds a child node', function () {
            const root = new GraphNode();
            const child = new GraphNode();
            root.addChild(child);
            expect(root.children).to.be.an('array').with.lengthOf(1);
            expect(root.children[0]).to.equal(child);
            expect(child.parent).to.equal(root);
        });

    });

    describe('#clone', function () {
        it('ensures that an instance of a subclass keeps its class prototype', function () {
            class UserGraphNode extends GraphNode {}
            const a = new UserGraphNode();
            const b = a.clone();
            expect(b).to.be.an.instanceof(UserGraphNode);
        });
    });

    describe('#find()', function () {

        it('finds a node by property', function () {
            const root = new GraphNode();
            const child = new GraphNode('Child');
            root.addChild(child);

            let res;
            res = root.find('name', 'Untitled');
            expect(res).to.be.an('array').with.lengthOf(1);
            expect(res[0]).to.equal(root);

            res = root.find('name', 'Child');
            expect(res).to.be.an('array').with.lengthOf(1);
            expect(res[0]).to.equal(child);

            res = root.find('name', 'Not Found');
            expect(res).to.be.an('array').with.lengthOf(0);
        });

        it('finds a node by filter function', function () {
            const root = new GraphNode();
            const child = new GraphNode('Child');
            root.addChild(child);

            let res;
            res = root.find(function (node) {
                return node.name === 'Untitled';
            });
            expect(res).to.be.an('array').with.lengthOf(1);
            expect(res[0]).to.equal(root);

            res = root.find(function (node) {
                return node.name === 'Child';
            });
            expect(res).to.be.an('array').with.lengthOf(1);
            expect(res[0]).to.equal(child);

            res = root.find(function (node) {
                return node.name === 'Not Found';
            });
            expect(res).to.be.an('array').with.lengthOf(0);
        });

    });

    describe('#findByName()', function () {

        it('finds root by name', function () {
            const root = new GraphNode('root');
            const child = new GraphNode('child');
            root.addChild(child);
            expect(root.findByName('root')).to.equal(root);
        });

        it('finds child by name', function () {
            const root = new GraphNode('root');
            const child = new GraphNode('child');
            root.addChild(child);
            expect(root.findByName('child')).to.equal(child);
        });

        it('returns null if no node is found', function () {
            const root = new GraphNode('root');
            const child = new GraphNode('child');
            root.addChild(child);
            expect(root.findByName('not-found')).to.equal(null);
        });

    });

    describe('#findByPath()', function () {

        it('finds a child by path', function () {
            const root = new GraphNode('root');
            const child = new GraphNode('child');
            root.addChild(child);
            expect(root.findByPath('child')).to.equal(child);
        });

        it('finds a grandchild by path (string argument)', function () {
            const root = new GraphNode('root');
            const child = new GraphNode('child');
            const grandchild = new GraphNode('grandchild');
            root.addChild(child);
            child.addChild(grandchild);
            expect(root.findByPath('child/grandchild')).to.equal(grandchild);
        });

        it('finds a grandchild by path (array argument)', function () {
            const root = new GraphNode('root');
            const child = new GraphNode('child');
            const grandchild = new GraphNode('grandchild');
            root.addChild(child);
            child.addChild(grandchild);
            expect(root.findByPath(['child', 'grandchild'])).to.equal(grandchild);
        });

        it('returns null if no node is found', function () {
            const root = new GraphNode('root');
            const child = new GraphNode('child');
            root.addChild(child);
            expect(root.findByPath('not-found')).to.equal(null);
        });

    });

    describe('#findByTag()', function () {

        it('does not search the root node', function () {
            const root = new GraphNode('root');
            root.tags.add('tag');
            const result = root.findByTag('tag');
            expect(result).to.be.an('array').with.lengthOf(0);
        });

        it('returns an array of nodes that have the query tag', function () {
            const root = new GraphNode('root');
            const child = new GraphNode('child');
            root.addChild(child);
            child.tags.add('tag');
            const result = root.findByTag('tag');
            expect(result).to.be.an('array').with.lengthOf(1);
            expect(result[0]).to.equal(child);
        });

        it('returns an array of nodes that have at least one of the query tags', function () {
            const root = new GraphNode('root');
            const child = new GraphNode('child');
            const grandchild = new GraphNode('grandchild');
            root.addChild(child);
            child.addChild(grandchild);
            root.tags.add('tag1');
            child.tags.add('tag2');
            grandchild.tags.add('tag3');
            const result = root.findByTag('tag1', 'tag3');
            expect(result).to.be.an('array').with.lengthOf(1);
            expect(result[0]).to.equal(grandchild);
        });

        it('returns an array of nodes that have all of the supplied tags', function () {
            const root = new GraphNode('root');
            const child = new GraphNode('child');
            const grandchild = new GraphNode('grandchild');
            root.addChild(child);
            child.addChild(grandchild);
            root.tags.add('tag1');
            child.tags.add('tag2');
            grandchild.tags.add(['tag1', 'tag2']);
            const result = root.findByTag(['tag2', 'tag1']);
            expect(result).to.be.an('array').with.lengthOf(1);
            expect(result[0]).to.equal(grandchild);
        });

        it('returns an empty array if the search fails', function () {
            const root = new GraphNode('root');
            const child = new GraphNode('child');
            root.addChild(child);
            const result = root.findByTag('not-found');
            expect(result).to.be.an('array').with.lengthOf(0);
        });

    });

    describe('#findOne()', function () {

        it('finds a node by property', function () {
            const root = new GraphNode();
            const child = new GraphNode('Child');
            root.addChild(child);

            let res;
            res = root.findOne('name', 'Untitled');
            expect(res).to.equal(root);

            res = root.findOne('name', 'Child');
            expect(res).to.equal(child);

            res = root.findOne('name', 'Not Found');
            expect(res).to.be.null;
        });

        it('finds a node by filter function', function () {
            const root = new GraphNode();
            const child = new GraphNode('Child');
            root.addChild(child);

            let res;
            res = root.findOne(function (node) {
                return node.name === 'Untitled';
            });
            expect(res).to.equal(root);

            res = root.findOne(function (node) {
                return node.name === 'Child';
            });
            expect(res).to.equal(child);

            res = root.findOne(function (node) {
                return node.name === 'Not Found';
            });
            expect(res).to.be.null;
        });

    });

    describe('#forEach()', function () {

        it('iterates over all nodes', function () {
            const root = new GraphNode();
            const child1 = new GraphNode();
            const child2 = new GraphNode();
            root.addChild(child1);
            root.addChild(child2);
            const visited = [];
            root.forEach((node) => {
                visited.push(node);
            });
            expect(visited).to.be.an('array').with.lengthOf(3);
            expect(visited[0]).to.equal(root);
            expect(visited[1]).to.equal(child1);
            expect(visited[2]).to.equal(child2);
        });

    });

    describe('#getEulerAngles()', function () {

        it('returns the euler angles', function () {
            const node = new GraphNode();
            const angles = node.getEulerAngles();
            expect(angles).to.be.an.instanceof(Vec3);
            expect(angles.x).to.equal(0);
            expect(angles.y).to.equal(0);
            expect(angles.z).to.equal(0);
        });

    });

    describe('#getLocalScale()', function () {

        it('returns the default local scale of a node', function () {
            const node = new GraphNode();
            const scale = node.getLocalScale();
            expect(scale).to.be.an.instanceof(Vec3);
            expect(scale.x).to.equal(1);
            expect(scale.y).to.equal(1);
            expect(scale.z).to.equal(1);
        });

        it('returns the local scale last set on a node', function () {
            const node = new GraphNode();
            node.setLocalScale(2, 3, 4);
            const scale = node.getLocalScale();
            expect(scale).to.be.an.instanceof(Vec3);
            expect(scale.x).to.equal(2);
            expect(scale.y).to.equal(3);
            expect(scale.z).to.equal(4);
        });

    });

    describe('#getLocalTransform()', function () {

        it('returns an identity matrix for a newly created node', function () {
            const node = new GraphNode();
            const transform = node.getLocalTransform();
            expect(transform).to.be.an.instanceof(Mat4);
            expect(transform.equals(Mat4.IDENTITY)).to.be.true;
        });

        it('returns the local transform matrix of a transformed node', function () {
            const node = new GraphNode();
            node.setLocalPosition(1, 2, 3);
            node.setLocalScale(4, 5, 6);
            const transform = node.getLocalTransform();
            const expected = new Float32Array([4, 0, 0, 0, 0, 5, 0, 0, 0, 0, 6, 0, 1, 2, 3, 1]);
            expect(transform.data).to.deep.equal(expected);
        });

    });

    describe('#getWorldTransform()', function () {

        it('returns an identity matrix for a newly created node', function () {
            const node = new GraphNode();
            const transform = node.getWorldTransform();
            expect(transform).to.be.an.instanceof(Mat4);
            expect(transform.equals(Mat4.IDENTITY)).to.be.true;
        });

        it('returns the world transform matrix of a transformed node', function () {
            const node = new GraphNode();
            node.setLocalPosition(1, 2, 3);
            node.setLocalScale(4, 5, 6);
            const transform = node.getWorldTransform();
            const expected = new Float32Array([4, 0, 0, 0, 0, 5, 0, 0, 0, 0, 6, 0, 1, 2, 3, 1]);
            expect(transform.data).to.deep.equal(expected);
        });

        it('returns the world transform matrix of a transformed child node', function () {
            const root = new GraphNode();
            const child = new GraphNode();
            root.addChild(child);
            root.setLocalPosition(1, 2, 3);
            root.setLocalEulerAngles(4, 5, 6);
            root.setLocalScale(7, 8, 9);
            child.setLocalPosition(1, 2, 3);
            child.setLocalEulerAngles(4, 5, 6);
            child.setLocalScale(7, 8, 9);
            const transform = child.getWorldTransform();

            const t = new Vec3(1, 2, 3);
            const r = new Quat().setFromEulerAngles(4, 5, 6);
            const s = new Vec3(7, 8, 9);
            const m1 = new Mat4();
            m1.setTRS(t, r, s);
            const m2 = new Mat4();
            m2.copy(m1);
            m1.mul(m2);

            expect(transform.data).to.deep.equal(m1.data);
        });

    });

    describe('#insertChild()', function () {

        it('inserts a single child node', function () {
            const root = new GraphNode();
            const child = new GraphNode();
            root.insertChild(child, 0);
            expect(root.children).to.be.an('array').with.lengthOf(1);
            expect(root.children[0]).to.equal(child);
            expect(child.parent).to.equal(root);
        });

        it('inserts a child node at the beginning', function () {
            const root = new GraphNode();
            const child1 = new GraphNode();
            const child2 = new GraphNode();
            root.insertChild(child1, 0);
            root.insertChild(child2, 0);
            expect(root.children).to.be.an('array').with.lengthOf(2);
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
            expect(root.children).to.be.an('array').with.lengthOf(2);
            expect(root.children[0]).to.equal(child1);
            expect(root.children[1]).to.equal(child2);
            expect(child1.parent).to.equal(root);
            expect(child2.parent).to.equal(root);
        });

    });

    describe('#isAncestorOf()', function () {

        it('returns true if a parent node is an ancestor of a child node', function () {
            const root = new GraphNode();
            const child = new GraphNode();
            root.addChild(child);
            expect(root.isAncestorOf(child)).to.be.true;
        });

        it('returns true if a grandparent node is an ancestor of a grandchild node', function () {
            const root = new GraphNode();
            const child = new GraphNode();
            const grandchild = new GraphNode();
            root.addChild(child);
            child.addChild(grandchild);
            expect(root.isAncestorOf(grandchild)).to.be.true;
        });

        it('returns false if a node is not an ancestor of another node', function () {
            const root = new GraphNode();
            const child = new GraphNode();
            expect(root.isAncestorOf(child)).to.be.false;
        });

        it('asserts that nodes are not ancestors of themselves', function () {
            const node = new GraphNode();
            expect(node.isAncestorOf(node)).to.be.false;
        });

    });

    describe('#isDescendantOf()', function () {

        it('returns true if a child node is a descendant of a parent node', function () {
            const root = new GraphNode();
            const child = new GraphNode();
            root.addChild(child);
            expect(child.isDescendantOf(root)).to.be.true;
        });

        it('returns true if a grandchild node is an descendant of a grandparent node', function () {
            const root = new GraphNode();
            const child = new GraphNode();
            const grandchild = new GraphNode();
            root.addChild(child);
            child.addChild(grandchild);
            expect(grandchild.isDescendantOf(root)).to.be.true;
        });

        it('returns false if a node is not a descendant of another node', function () {
            const root = new GraphNode();
            const child = new GraphNode();
            expect(child.isDescendantOf(root)).to.be.false;
        });

        it('asserts that nodes are not descendants of themselves', function () {
            const node = new GraphNode();
            expect(node.isDescendantOf(node)).to.be.false;
        });

    });

    describe('#remove', function () {

        it('removes the node from its parent, unparenting it', function () {
            const node = new GraphNode();
            const child = new GraphNode();
            node.addChild(child);
            child.remove();
            expect(node.children).to.be.an('array').with.lengthOf(0);
            expect(child.parent).to.equal(null);
        });

    });

    describe('#removeChild()', function () {

        it('removes a child node', function () {
            const node = new GraphNode();
            const child = new GraphNode();
            node.addChild(child);
            node.removeChild(child);
            expect(node.children).to.be.an('array').with.lengthOf(0);
            expect(child.parent).to.equal(null);
        });

    });

    describe('#reparent()', function () {

        it('reparents a child node', function () {
            const node = new GraphNode();
            const child = new GraphNode();
            node.addChild(child);
            const newParent = new GraphNode();
            child.reparent(newParent);
            expect(node.children).to.be.an('array').with.lengthOf(0);
            expect(newParent.children).to.be.an('array').with.lengthOf(1);
            expect(newParent.children[0]).to.equal(child);
            expect(child.parent).to.equal(newParent);
        });

    });

    describe('#rotate()', function () {

        it('leaves rotation unchanged for a zero rotation (number inputs)', function () {
            const node = new GraphNode();
            const anglesPre = node.getEulerAngles().clone();
            node.rotate(0, 0, 0);
            const anglesPost = node.getEulerAngles();
            expect(anglesPre.equals(anglesPost)).to.be.true;
        });

        it('leaves rotation unchanged for a zero rotation (vector input)', function () {
            const node = new GraphNode();
            const anglesPre = node.getEulerAngles().clone();
            node.rotate(Vec3.ZERO);
            const anglesPost = node.getEulerAngles();
            expect(anglesPre.equals(anglesPost)).to.be.true;
        });

        it('accumulates rotations in a node', function () {
            const node = new GraphNode();
            node.rotate(1, 0, 0);
            node.rotate(2, 0, 0);
            node.rotate(3, 0, 0);

            const angles = node.getEulerAngles();
            expect(angles.x).to.be.closeTo(6, 0.00001);
            expect(angles.y).to.be.closeTo(0, 0.00001);
            expect(angles.z).to.be.closeTo(0, 0.00001);
        });

        it('accumulates rotations in a hierarchy', function () {
            const root = new GraphNode();
            const child = new GraphNode();
            root.addChild(child);

            root.rotate(10, 0, 0);
            child.rotate(20, 0, 0);

            const rootAngles = root.getEulerAngles();
            expect(rootAngles.x).to.be.closeTo(10, 0.00001);
            expect(rootAngles.y).to.be.closeTo(0, 0.00001);
            expect(rootAngles.z).to.be.closeTo(0, 0.00001);

            const childAngles = child.getEulerAngles();
            expect(childAngles.x).to.be.closeTo(30, 0.00001);
            expect(childAngles.y).to.be.closeTo(0, 0.00001);
            expect(childAngles.z).to.be.closeTo(0, 0.00001);
        });

    });

    describe('#rotateLocal()', function () {

        it('leaves rotation unchanged for a zero rotation (number inputs)', function () {
            const node = new GraphNode();
            const anglesPre = node.getEulerAngles().clone();
            node.rotateLocal(0, 0, 0);
            const anglesPost = node.getEulerAngles();
            expect(anglesPre.equals(anglesPost)).to.be.true;
        });

        it('leaves rotation unchanged for a zero rotation (vector input)', function () {
            const node = new GraphNode();
            const anglesPre = node.getEulerAngles().clone();
            node.rotateLocal(Vec3.ZERO);
            const anglesPost = node.getEulerAngles();
            expect(anglesPre.equals(anglesPost)).to.be.true;
        });

        it('accumulates rotations in a node', function () {
            const node = new GraphNode();
            node.rotateLocal(1, 0, 0);
            node.rotateLocal(2, 0, 0);
            node.rotateLocal(3, 0, 0);

            const angles = node.getEulerAngles();
            expect(angles.x).to.be.closeTo(6, 0.00001);
            expect(angles.y).to.be.closeTo(0, 0.00001);
            expect(angles.z).to.be.closeTo(0, 0.00001);
        });

        it('accumulates rotations in a hierarchy', function () {
            const root = new GraphNode();
            const child = new GraphNode();
            root.addChild(child);

            root.rotateLocal(1, 2, 3);
            child.rotateLocal(4, 5, 6);

            const rootAngles = root.getEulerAngles();
            expect(rootAngles.x).to.be.closeTo(1, 0.00001);
            expect(rootAngles.y).to.be.closeTo(2, 0.00001);
            expect(rootAngles.z).to.be.closeTo(3, 0.00001);

            const childAngles = child.getEulerAngles();
            expect(childAngles.x).to.be.closeTo(5.211704001298277, 0.00001);
            expect(childAngles.y).to.be.closeTo(6.883411088035306, 0.00001);
            expect(childAngles.z).to.be.closeTo(9.107997263232027, 0.00001);
        });

    });

    describe('#translate()', function () {

        it('translates hierarchical nodes with number arguments', function () {
            const root = new GraphNode();
            const child = new GraphNode();
            root.addChild(child);

            root.translate(1, 2, 3);
            child.translate(4, 5, 6);

            let pos;
            pos = root.getPosition();
            expect(pos).to.be.an.instanceof(Vec3);
            expect(pos.x).to.equal(1);
            expect(pos.y).to.equal(2);
            expect(pos.z).to.equal(3);

            pos = child.getPosition();
            expect(pos).to.be.an.instanceof(Vec3);
            expect(pos.x).to.equal(5);
            expect(pos.y).to.equal(7);
            expect(pos.z).to.equal(9);
        });

        it('translates hierarchical nodes with a vector argument', function () {
            const root = new GraphNode();
            const child = new GraphNode();
            root.addChild(child);

            root.translate(new Vec3(1, 2, 3));
            child.translate(new Vec3(4, 5, 6));

            let pos;
            pos = root.getPosition();
            expect(pos).to.be.an.instanceof(Vec3);
            expect(pos.x).to.equal(1);
            expect(pos.y).to.equal(2);
            expect(pos.z).to.equal(3);

            pos = child.getPosition();
            expect(pos).to.be.an.instanceof(Vec3);
            expect(pos.x).to.equal(5);
            expect(pos.y).to.equal(7);
            expect(pos.z).to.equal(9);
        });

    });

    describe('#translateLocal()', function () {

        it('GraphNode: translateLocal in hierarchy', function () {
            const root = new GraphNode('root');
            const child = new GraphNode('child');
            root.addChild(child);
            root.setPosition(10, 20, 30);

            child.rotateLocal(0, 180, 0);
            child.translateLocal(10, 20, 30);

            let pos;
            pos = child.getPosition();
            expect(pos.x).to.be.closeTo(0, 0.00001);
            expect(pos.y).to.be.closeTo(40, 0.00001);
            expect(pos.z).to.be.closeTo(0, 0.00001);

            pos = child.getLocalPosition();
            expect(pos.x).to.be.closeTo(-10, 0.00001);
            expect(pos.y).to.be.closeTo(20, 0.00001);
            expect(pos.z).to.be.closeTo(-30, 0.00001);
        });

    });

    describe('#setPositionAndRotation()', function () {
        it('setPositionAndRotation is the same as setPosition and setRotation', function () {
            const root = new GraphNode('root');
            const child = new GraphNode('child');
            root.addChild(child);
            root.setPosition(10, 20, 30);

            root.setLocalScale(0.5, 0.5, 0.5);

            const pos = new Vec3(1, 2, 3);
            const rot = new Quat().setFromEulerAngles(10, 20, 30);
            child.setPosition(pos);
            child.setRotation(rot);

            const pos1 = child.getPosition().clone();
            const rot1 = child.getRotation().clone();
            const localPos1 = child.getLocalPosition().clone();
            const localRot1 = child.getLocalRotation().clone();

            child.setPositionAndRotation(pos, rot);

            const pos2 = child.getPosition();
            expect(pos2.x).to.be.closeTo(pos1.x, 0.00001);
            expect(pos2.y).to.be.closeTo(pos1.y, 0.00001);
            expect(pos2.z).to.be.closeTo(pos1.z, 0.00001);

            const rot2 = child.getRotation();
            expect(rot2.x).to.be.closeTo(rot1.x, 0.00001);
            expect(rot2.y).to.be.closeTo(rot1.y, 0.00001);
            expect(rot2.z).to.be.closeTo(rot1.z, 0.00001);
            expect(rot2.w).to.be.closeTo(rot1.w, 0.00001);

            const localPos2 = child.getLocalPosition();
            expect(localPos2.x).to.be.closeTo(localPos1.x, 0.00001);
            expect(localPos2.y).to.be.closeTo(localPos1.y, 0.00001);
            expect(localPos2.z).to.be.closeTo(localPos1.z, 0.00001);

            const localRot2 = child.getLocalRotation();
            expect(localRot2.x).to.be.closeTo(localRot1.x, 0.00001);
            expect(localRot2.y).to.be.closeTo(localRot1.y, 0.00001);
            expect(localRot2.z).to.be.closeTo(localRot1.z, 0.00001);
            expect(localRot2.w).to.be.closeTo(localRot1.w, 0.00001);
        });
    });
});
