# Generates the knight of the render-to-image example, examples/assets/models/knight.glb: armor
# parts built from primitives and hung on the bones of an armature, with an Idle loop and an
# Attack. Each part moves rigidly with its bone, so the model has no skin. Run it with Blender
# (made with 5.2):
#
#     blender --background --factory-startup --python examples/utils/generate-knight.py -- examples/assets/models/knight.glb

import math
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

FPS = 30

# Blender is Z up, and the knight faces -Y, which the glTF exporter turns into +Z

# Colors are sRGB, with roughness and metalness. There is no environment map in the example, so
# the metals are only slightly metallic, and read as metal by their highlights
PALETTE = {
    'steel': ((0.8, 0.82, 0.86), 0.3, 0.2),
    'dark': ((0.06, 0.065, 0.08), 0.45, 0.0),
    'chain': ((0.34, 0.36, 0.4), 0.55, 0.1),
    'cloth': ((1.0, 0.55, 0.2), 0.75, 0.0),
    'gold': ((1.0, 0.78, 0.32), 0.35, 0.3),
    'leather': ((0.45, 0.28, 0.17), 0.7, 0.0),
    'white': ((0.97, 0.96, 0.92), 0.6, 0.0)
}

# The pose the parts are built in, which is also the rest pose of the rig and the first frame of
# both animations. Angles are in degrees: pitch leans forwards, yaw turns to the knight's left and
# roll lifts its left side. Hands, poles and directions are in the knight's space
BASE = {
    'hips': (0, 0, 0),
    'hips_dz': 0.0,
    'spine': (0, 0, 0),
    'head': (0, 0, 0),
    'hand_R': (-0.25, -0.17, 0.56),
    'pole_R': (-1.0, 0.5, -0.3),
    'blade_R': (0.05, -0.35, 1.0),
    'flat_R': (0.0, -1.0, 0.0),
    'hand_L': (0.27, -0.15, 0.58),
    'pole_L': (1.0, 0.5, -0.3),
    'shield_L': (1.0, -0.8, 0.0),
    'foot_R': (0.0, 0.0, 0.0),
    'foot_L': (0.0, 0.0, 0.0)
}

HIPS = (Vector((0, 0, 0.5)), Vector((0, 0, 0.58)))
SPINE = (Vector((0, 0, 0.58)), Vector((0, 0, 0.86)))
HEAD = (Vector((0, 0, 0.87)), Vector((0, 0, 1.25)))
SHOULDER = {'R': Vector((-0.25, 0, 0.8)), 'L': Vector((0.25, 0, 0.8))}
HIP_JOINT = {'R': Vector((-0.1, 0, 0.47)), 'L': Vector((0.1, 0, 0.47))}
ANKLE = {'R': Vector((-0.12, 0, 0.1)), 'L': Vector((0.12, 0, 0.1))}
UPPER_ARM, FOREARM, THIGH, SHIN = 0.17, 0.17, 0.2, 0.2
KNEE_POLE = Vector((0, -1, 0.2))
FORWARD, UP = Vector((0, -1, 0)), Vector((0, 0, 1))


def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def frame_matrix(head, y, z_hint):
    """A bone matrix: Y along the bone, Z as close to z_hint as it can be, and the head at head."""
    y = Vector(y).normalized()
    z_hint = Vector(z_hint)
    z = (z_hint - y * z_hint.dot(y)).normalized()
    x = y.cross(z)
    m = Matrix((x, y, z)).transposed().to_4x4()
    m.translation = head
    return m


def two_bone(start, target, a, b, pole):
    """Solve a two-bone chain from start towards target, bending towards pole. Returns the middle
    joint and the end, which is the target unless the target is out of reach."""
    to_target = target - start
    d = min(max(to_target.length, abs(a - b) + 1e-4), a + b - 1e-4)
    u = to_target.normalized()
    cos_a = (a * a + d * d - b * b) / (2 * a * d)
    sin_a = math.sqrt(max(0.0, 1 - cos_a * cos_a))
    v = (pole - u * pole.dot(u)).normalized()
    return start + u * (a * cos_a) + v * (a * sin_a), start + u * d


def rest_joints():
    """The joints of the rest pose, solved from BASE."""
    j = {}
    for side in 'RL':
        elbow, hand = two_bone(SHOULDER[side], Vector(BASE['hand_' + side]), UPPER_ARM, FOREARM,
                               Vector(BASE['pole_' + side]))
        knee, ankle = two_bone(HIP_JOINT[side], ANKLE[side], THIGH, SHIN, KNEE_POLE)
        j['elbow_' + side], j['hand_' + side] = elbow, hand
        j['knee_' + side], j['ankle_' + side] = knee, ankle
    return j


# -------------------------------------------------------------------------------------------------
# Geometry: small bmesh builders, in local space

def bevel_edges(bm, edges, offset, segments):
    if edges:
        verts = list({v for e in edges for v in e.verts})
        bmesh.ops.bevel(bm, geom=edges + verts, offset=offset, segments=segments, affect='EDGES',
                        profile=0.5, clamp_overlap=True)


def sharp_edges(bm, angle):
    return [e for e in bm.edges if e.is_manifold and e.calc_face_angle(0) > math.radians(angle)]


def rounded_box(sx, sy, sz, r_side, r_top, segments=4):
    """A box whose vertical edges are rounded by r_side, and then its top and bottom by r_top."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=(sx, sy, sz), verts=bm.verts)
    vertical = [e for e in bm.edges if abs((e.verts[0].co - e.verts[1].co).normalized().z) > 0.99]
    bevel_edges(bm, vertical, r_side, segments)
    bevel_edges(bm, sharp_edges(bm, 50), r_top, segments)
    return bm


def cylinder(r0, r1, length, segments=16, bevel=0.0):
    """A cylinder, or a cone, from z = 0 to z = length."""
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segments, radius1=r0,
                          radius2=r1, depth=length)
    bmesh.ops.translate(bm, vec=(0, 0, length / 2), verts=bm.verts)
    if bevel:
        bevel_edges(bm, sharp_edges(bm, 50), bevel, 2)
    return bm


def sphere(r, scale=(1, 1, 1), u=20, v=10):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=u, v_segments=v, radius=r)
    bmesh.ops.scale(bm, vec=scale, verts=bm.verts)
    return bm


def arc_band(r_in, r_out, z0, z1, a0, a1, segments=16):
    """A curved strip on a vertical cylinder, from angle a0 to a1, where 0 is the front, -Y, and
    positive angles go towards +X."""
    bm = bmesh.new()
    rings = []
    for i in range(segments + 1):
        a = a0 + (a1 - a0) * i / segments
        d = Vector((math.sin(a), -math.cos(a), 0))
        rings.append([bm.verts.new(d * r + Vector((0, 0, z))) for r, z in
                      ((r_in, z0), (r_out, z0), (r_out, z1), (r_in, z1))])
    for i in range(segments):
        for k in range(4):
            q = (rings[i][k], rings[i][(k + 1) % 4], rings[i + 1][(k + 1) % 4], rings[i + 1][k])
            bm.faces.new(q)
    bm.faces.new(rings[0])
    bm.faces.new(list(reversed(rings[-1])))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def blade(length, tip, width, thickness):
    """A sword blade with a diamond section, along +Y, flat across X."""
    bm = bmesh.new()

    def section(y, w):
        return [bm.verts.new(p) for p in ((w / 2, y, 0), (0, y, thickness / 2), (-w / 2, y, 0),
                                          (0, y, -thickness / 2))]
    base, top = section(0, width), section(length, width * 0.85)
    point = bm.verts.new((0, length + tip, 0))
    for i in range(4):
        j = (i + 1) % 4
        bm.faces.new((base[i], base[j], top[j], top[i]))
        bm.faces.new((top[i], top[j], point))
    bm.faces.new(list(reversed(base)))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def star(points, r_out, r_in, depth):
    """A flat star facing -Y, from y = 0 to y = -depth."""
    bm = bmesh.new()
    outline = []
    for i in range(points * 2):
        a = math.pi * i / points
        r = r_out if i % 2 == 0 else r_in
        outline.append((r * math.sin(a), r * math.cos(a)))
    back = [bm.verts.new((x, 0, z)) for x, z in outline]
    front = [bm.verts.new((x, -depth, z)) for x, z in outline]
    bm.faces.new(front)
    bm.faces.new(list(reversed(back)))
    for i in range(len(outline)):
        j = (i + 1) % len(outline)
        bm.faces.new((back[i], back[j], front[j], front[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def placed(p0, p1):
    """A matrix that puts a part built along +Z at p0, pointing towards p1."""
    z = (p1 - p0).normalized()
    x = z.cross(Vector((0, 1, 0)) if abs(z.y) < 0.9 else Vector((1, 0, 0))).normalized()
    y = z.cross(x)
    m = Matrix((x, y, z)).transposed().to_4x4()
    m.translation = p0
    return m


def translated(x, y, z):
    return Matrix.Translation((x, y, z))


class Parts:
    """Collects the parts of each bone into one mesh, with a material per part."""

    def __init__(self, materials):
        self.materials = materials
        self.meshes = {}

    def add(self, owner, bm, material, matrix=None, smooth=True):
        if matrix is not None:
            bmesh.ops.transform(bm, matrix=matrix, verts=bm.verts)
        index = list(self.materials).index(material)
        for f in bm.faces:
            f.material_index = index
            f.smooth = smooth
        # keep creases crisp where the faces of a part meet at a sharp angle
        for e in sharp_edges(bm, 55):
            e.smooth = False
        mesh = bpy.data.meshes.new('part')
        bm.to_mesh(mesh)
        bm.free()
        self.meshes.setdefault(owner, bmesh.new()).from_mesh(mesh)
        bpy.data.meshes.remove(mesh)

    def objects(self, names):
        """Make an object of each bone's parts, with only the materials it uses."""
        materials = list(self.materials.values())
        result = {}
        for owner, bm in self.meshes.items():
            used = sorted({f.material_index for f in bm.faces})
            for f in bm.faces:
                f.material_index = used.index(f.material_index)
            mesh = bpy.data.meshes.new(names[owner])
            bm.to_mesh(mesh)
            bm.free()
            for i in used:
                mesh.materials.append(materials[i])
            obj = bpy.data.objects.new(names[owner], mesh)
            bpy.context.scene.collection.objects.link(obj)
            result[owner] = obj
        return result


def build_parts(parts, j):
    """The knight, in the rest pose. Each part is added to the bone it moves with."""
    # Legs: mail thighs, steel knees and greaves, and leather boots
    for side, sx in (('R', -1), ('L', 1)):
        hip, knee, ankle = HIP_JOINT[side], j['knee_' + side], j['ankle_' + side]
        parts.add('Thigh.' + side, cylinder(0.062, 0.058, (knee - hip).length), 'chain', placed(hip, knee))
        parts.add('Thigh.' + side, sphere(0.068, (1, 1, 1), 16, 8), 'steel', translated(*knee))
        parts.add('Shin.' + side, cylinder(0.066, 0.058, (ankle - knee).length + 0.02, bevel=0.01), 'steel',
                  placed(knee, ankle))
        parts.add('Foot.' + side, rounded_box(0.13, 0.21, 0.1, 0.05, 0.03), 'leather',
                  translated(ankle.x + sx * 0.005, -0.035, 0.05))

    # Hips: a leather belt with a gold buckle, and the tabard's front and back flaps
    belt = rounded_box(0.43, 0.33, 0.06, 0.11, 0.015)
    parts.add('Hips', belt, 'leather', translated(0, 0, 0.53))
    parts.add('Hips', rounded_box(0.08, 0.03, 0.055, 0.012, 0.01), 'gold', translated(0, -0.165, 0.53))
    for y, tilt in ((-0.13, 8), (0.13, -8)):
        flap = rounded_box(0.22, 0.025, 0.18, 0.01, 0.01)
        bmesh.ops.translate(flap, vec=(0, 0, -0.09), verts=flap.verts)
        m = translated(0, y, 0.52) @ Matrix.Rotation(math.radians(tilt), 4, 'X')
        parts.add('Hips', flap, 'cloth', m)

    # Chest: the tabard over the body, a white star on it, and a mail collar
    chest = rounded_box(0.42, 0.31, 0.32, 0.12, 0.06)
    for v in chest.verts:
        if v.co.z < 0:
            taper = 1 - 0.08 * (-v.co.z / 0.16)
            v.co.x *= taper
            v.co.y *= taper
    parts.add('Spine', chest, 'cloth', translated(0, 0, 0.71))
    parts.add('Spine', star(4, 0.075, 0.025, 0.012), 'white', translated(0, -0.152, 0.74))
    parts.add('Spine', cylinder(0.1, 0.09, 0.08), 'chain', translated(0, 0, 0.84))

    # Head: a round helmet with an eye slit, a gold brow and an orange plume
    center = Vector((0, 0, 1.07))
    parts.add('Head', sphere(0.21, (1, 1, 0.97), 32, 16), 'steel', translated(*center))
    parts.add('Head', arc_band(0.2, 0.214, -0.012, 0.03, -1.0, 1.0, 20), 'dark', translated(*center))
    parts.add('Head', arc_band(0.2, 0.216, 0.05, 0.075, -1.25, 1.25, 24), 'gold', translated(*center))
    parts.add('Head', cylinder(0.215, 0.2, 0.05, 32, 0.01), 'steel', translated(0, 0, 0.87))
    for i in range(11):
        t = i / 10
        a = math.radians(55 + 115 * t)
        r = 0.05 + 0.035 * math.sin(math.pi * min(1, t * 1.25))
        p = center + Vector((0, -math.cos(a) * 0.215, math.sin(a) * 0.215))
        parts.add('Head', sphere(r, (0.5, 1, 1), 12, 6), 'cloth', translated(*p))

    # Arms: steel pauldrons, mail upper arms, steel elbows and gauntlets, and leather fists
    for side, sx in (('R', -1), ('L', 1)):
        shoulder, elbow, hand = SHOULDER[side], j['elbow_' + side], j['hand_' + side]
        pauldron = sphere(0.1, (1.15, 1.05, 0.85), 20, 10)
        parts.add('UpperArm.' + side, pauldron, 'steel', translated(shoulder.x + sx * 0.02, 0, shoulder.z + 0.03))
        parts.add('UpperArm.' + side, cylinder(0.05, 0.047, (elbow - shoulder).length), 'chain',
                  placed(shoulder, elbow))
        parts.add('Forearm.' + side, sphere(0.056, (1, 1, 1), 16, 8), 'steel', translated(*elbow))
        parts.add('Forearm.' + side, cylinder(0.052, 0.06, (hand - elbow).length - 0.03, bevel=0.008), 'steel',
                  placed(elbow, hand))
        parts.add('Hand.' + side, sphere(0.055, (1, 1, 1), 16, 8), 'leather', translated(*hand))

    # The sword, in the right hand: its blade points along the hand bone
    hand = frame_matrix(j['hand_R'], BASE['blade_R'], BASE['flat_R'])
    parts.add('Hand.R', blade(0.5, 0.08, 0.075, 0.018), 'steel', hand @ translated(0, 0.075, 0), smooth=False)
    parts.add('Hand.R', rounded_box(0.2, 0.035, 0.035, 0.012, 0.012), 'gold', hand @ translated(0, 0.06, 0))
    grip = cylinder(0.018, 0.018, 0.13, 12)
    parts.add('Hand.R', grip, 'leather', hand @ translated(0, -0.07, 0) @ Matrix.Rotation(-math.pi / 2, 4, 'X'))
    parts.add('Hand.R', sphere(0.03, (1, 1, 1), 12, 6), 'gold', hand @ translated(0, -0.085, 0))

    # The shield, on the left forearm, facing out and forwards
    elbow, hand = j['elbow_L'], j['hand_L']
    normal = Vector(BASE['shield_L']).normalized()
    shield = frame_matrix((elbow + hand) / 2 + normal * 0.075, (hand - elbow), normal)
    # frame_matrix puts Z along the normal: build the shield's discs along Z
    parts.add('Forearm.L', cylinder(0.18, 0.18, 0.025, 32, 0.008), 'steel', shield)
    parts.add('Forearm.L', cylinder(0.155, 0.155, 0.04, 32, 0.01), 'cloth', shield)
    parts.add('Forearm.L', sphere(0.05, (1, 1, 0.7), 16, 8), 'gold', shield @ translated(0, 0, 0.04))


# -------------------------------------------------------------------------------------------------
# The rig

BONE_NAMES = ['Hips', 'Spine', 'Head']
for _side in 'RL':
    BONE_NAMES += [f'UpperArm.{_side}', f'Forearm.{_side}', f'Hand.{_side}', f'Thigh.{_side}',
                   f'Shin.{_side}', f'Foot.{_side}']

PART_NAMES = {name: name.replace('.', '') + 'Mesh' for name in BONE_NAMES}


def bone_frames(j):
    """Head, tail, the direction for the bone's Z axis, and the parent of each bone, at rest."""
    frames = {
        'Hips': (*HIPS, FORWARD, None),
        'Spine': (*SPINE, FORWARD, 'Hips'),
        'Head': (*HEAD, FORWARD, 'Spine')
    }
    for side in 'RL':
        shoulder, elbow, hand = SHOULDER[side], j['elbow_' + side], j['hand_' + side]
        pole = Vector(BASE['pole_' + side])
        fore_z = pole if side == 'R' else Vector(BASE['shield_L'])
        frames[f'UpperArm.{side}'] = (shoulder, elbow, pole, 'Spine')
        frames[f'Forearm.{side}'] = (elbow, hand, fore_z, f'UpperArm.{side}')
        if side == 'R':
            tip = hand + Vector(BASE['blade_R']).normalized() * 0.1
            frames['Hand.R'] = (hand, tip, Vector(BASE['flat_R']), 'Forearm.R')
        else:
            frames['Hand.L'] = (hand, hand + (hand - elbow).normalized() * 0.08, fore_z, 'Forearm.L')
        knee, ankle = j['knee_' + side], j['ankle_' + side]
        frames[f'Thigh.{side}'] = (HIP_JOINT[side], knee, FORWARD, 'Hips')
        frames[f'Shin.{side}'] = (knee, ankle, FORWARD, f'Thigh.{side}')
        frames[f'Foot.{side}'] = (ankle, ankle + FORWARD * 0.1, UP, f'Shin.{side}')
    return frames


def build_rig(j):
    data = bpy.data.armatures.new('KnightRig')
    rig = bpy.data.objects.new('Knight', data)
    bpy.context.scene.collection.objects.link(rig)
    bpy.context.view_layer.objects.active = rig
    rig.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    for name, (head, tail, z_hint, parent) in bone_frames(j).items():
        bone = data.edit_bones.new(name)
        bone.head, bone.tail = head, tail
        bone.align_roll(z_hint)
        if parent:
            bone.parent = data.edit_bones[parent]
    bpy.ops.object.mode_set(mode='OBJECT')
    for pose_bone in rig.pose.bones:
        pose_bone.rotation_mode = 'QUATERNION'
    return rig


def attach(rig, objects):
    """Parent each part to its bone, keeping it where it was built."""
    for owner, obj in objects.items():
        obj.parent = rig
        obj.parent_type = 'BONE'
        obj.parent_bone = owner
    bpy.context.view_layer.update()
    for obj in objects.values():
        obj.matrix_world = Matrix.Identity(4)


def reset_scene():
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for blocks in (bpy.data.meshes, bpy.data.materials, bpy.data.armatures, bpy.data.actions,
                   bpy.data.cameras, bpy.data.lights):
        for block in list(blocks):
            blocks.remove(block)
    scene = bpy.context.scene
    scene.render.fps = FPS
    scene.frame_start = 0


def make_materials():
    materials = {}
    for name, (srgb, roughness, metallic) in PALETTE.items():
        mat = bpy.data.materials.new(name.capitalize())
        if hasattr(mat, 'use_nodes') and not mat.use_nodes:
            mat.use_nodes = True
        linear = [srgb_to_linear(c) for c in srgb]
        bsdf = mat.node_tree.nodes['Principled BSDF']
        bsdf.inputs['Base Color'].default_value = (*linear, 1)
        bsdf.inputs['Roughness'].default_value = roughness
        bsdf.inputs['Metallic'].default_value = metallic
        mat.diffuse_color = (*linear, 1)
        materials[name] = mat
    return materials


def build():
    reset_scene()
    j = rest_joints()
    materials = make_materials()
    parts = Parts(materials)
    build_parts(parts, j)
    rig = build_rig(j)
    attach(rig, parts.objects(PART_NAMES))
    return rig, j


# -------------------------------------------------------------------------------------------------
# Posing and animation

def rotation(pitch, yaw, roll):
    """A rotation in a torso bone's own axes, in degrees: X across the knight, Y up along the bone
    and Z forwards. So pitch leans forwards, yaw turns to the knight's left and roll lifts its left
    side."""
    return (Matrix.Rotation(math.radians(yaw), 4, 'Y') @ Matrix.Rotation(math.radians(pitch), 4, 'X') @
            Matrix.Rotation(math.radians(roll), 4, 'Z'))


def update():
    bpy.context.view_layer.update()


def apply_pose(rig, p):
    """Pose the rig: the torso by its angles, and the arms and legs by solving them to reach the
    hands and feet, with the sword and shield turned as the pose says."""
    bones = rig.pose.bones
    for bone in bones:
        bone.matrix_basis = Matrix.Identity(4)
    bones['Hips'].matrix_basis = Matrix.Translation((0, p['hips_dz'], 0)) @ rotation(*p['hips'])
    bones['Spine'].matrix_basis = rotation(*p['spine'])
    bones['Head'].matrix_basis = rotation(*p['head'])
    update()
    for side in 'RL':
        upper, fore = bones['UpperArm.' + side], bones['Forearm.' + side]
        shoulder, pole = upper.head.copy(), Vector(p['pole_' + side])
        elbow, hand = two_bone(shoulder, Vector(p['hand_' + side]), UPPER_ARM, FOREARM, pole)
        upper.matrix = frame_matrix(shoulder, elbow - shoulder, pole)
        update()
        fore.matrix = frame_matrix(elbow, hand - elbow, pole if side == 'R' else Vector(p['shield_L']))
        update()
        if side == 'R':
            bones['Hand.R'].matrix = frame_matrix(hand, p['blade_R'], p['flat_R'])
            update()
    for side in 'RL':
        thigh, shin, foot = bones['Thigh.' + side], bones['Shin.' + side], bones['Foot.' + side]
        hip = thigh.head.copy()
        knee, ankle = two_bone(hip, ANKLE[side] + Vector(p['foot_' + side]), THIGH, SHIN, KNEE_POLE)
        thigh.matrix = frame_matrix(hip, knee - hip, FORWARD)
        update()
        shin.matrix = frame_matrix(knee, ankle - knee, FORWARD)
        update()
        foot.matrix = frame_matrix(ankle, FORWARD, UP)
        update()


def record(rig, name, keys):
    """Key each (frame, pose) of keys into an action, and push it onto an NLA track of the same
    name, which the glTF exporter makes an animation of."""
    data = rig.animation_data or rig.animation_data_create()
    action = bpy.data.actions.new(name)
    data.action = action
    previous = {}
    for frame, p in keys:
        apply_pose(rig, p)
        for bone in rig.pose.bones:
            # keep each rotation in the same hemisphere as the last, so keys turn the short way
            q = bone.rotation_quaternion.copy()
            if bone.name in previous and previous[bone.name].dot(q) < 0:
                q.negate()
                bone.rotation_quaternion = q
            previous[bone.name] = q
            bone.keyframe_insert('location', frame=frame)
            bone.keyframe_insert('rotation_quaternion', frame=frame)
    track = data.nla_tracks.new()
    track.name = name
    track.strips.new(name, int(keys[0][0]), action)
    data.action = None
    return action


def pose(**changes):
    return dict(BASE, **changes)


def idle_keys():
    """Two seconds of breathing and looking around, which loop."""
    keys = []
    for frame in range(0, 61, 5):
        t = 2 * math.pi * frame / 60
        s = math.sin(t)
        keys.append((frame, pose(
            hips_dz=-0.006 * (1 - math.cos(t)) / 2,
            spine=(-1.5 * s, 0, 0),
            head=(1.5 * math.sin(2 * t), 5 * s, 0),
            hand_R=(-0.25, -0.17, 0.56 + 0.008 * s),
            blade_R=(0.05 + 0.03 * s, -0.35, 1.0),
            hand_L=(0.27, -0.15, 0.58 + 0.008 * s)
        )))
    return keys


# The blade turns about this axis during the swing, so its edge leads the way
SWING_FLAT = (-0.11, -0.78, 0.62)


def attack_keys():
    """A wind-up over the right shoulder, a diagonal slash across the body with a step forward,
    and a recovery to the first frame of the idle."""
    wind_up = pose(
        hips=(-4, -16, 0), hips_dz=-0.02, spine=(-8, -32, 0), head=(5, 32, 0),
        hand_R=(-0.32, 0.12, 1.06), pole_R=(-0.8, -0.2, -0.6), blade_R=(0.3, 0.65, 0.7),
        flat_R=SWING_FLAT, hand_L=(0.2, -0.22, 0.68), shield_L=(0.5, -1.0, 0.1), pole_L=(1, 0.4, -0.4)
    )
    strike = pose(
        hips=(5, 12, 0), hips_dz=-0.05, spine=(10, 35, 0), head=(6, -30, 0),
        hand_R=(0.06, -0.36, 0.52), pole_R=(-0.5, 0.3, -0.8), blade_R=(0.7, -0.5, -0.5), flat_R=SWING_FLAT,
        hand_L=(0.34, 0.05, 0.62), shield_L=(1.0, -0.1, 0.0), foot_L=(0.02, -0.07, 0)
    )
    return [
        (0, pose()),
        (7, wind_up),
        (10, dict(wind_up, hand_R=(-0.33, 0.12, 1.05), spine=(-6, -34, 0))),
        (13, pose(
            hips=(2, 0, 0), hips_dz=-0.03, spine=(4, 5, 0), head=(2, 5, 0),
            hand_R=(-0.12, -0.36, 0.86), pole_R=(-0.8, 0.1, -0.6), blade_R=(0.8, -0.3, 0.5),
            flat_R=SWING_FLAT, hand_L=(0.3, -0.05, 0.64), shield_L=(0.8, -0.6, 0.0), foot_L=(0.01, -0.04, 0)
        )),
        (16, strike),
        (20, dict(strike, spine=(12, 40, 0), hand_R=(0.1, -0.33, 0.47), blade_R=(0.75, -0.45, -0.5))),
        (28, pose(
            hips=(2, 6, 0), hips_dz=-0.02, spine=(4, 15, 0), head=(2, -8, 0),
            hand_R=(-0.15, -0.28, 0.55), blade_R=(0.25, -0.5, 0.8), flat_R=(0.05, -0.95, 0.3),
            foot_L=(0.01, -0.03, 0)
        )),
        (40, pose())
    ]


def animate(rig):
    record(rig, 'Idle', idle_keys())
    record(rig, 'Attack', attack_keys())
    apply_pose(rig, BASE)


def export(path):
    options = {
        'filepath': path,
        'export_format': 'GLB',
        'use_selection': False,
        'export_apply': True,
        'export_texcoords': False,
        'export_normals': True,
        'export_tangents': False,
        'export_vertex_color': 'NONE',
        'export_cameras': False,
        'export_lights': False,
        'export_extras': False,
        'export_yup': True,
        'export_animations': True,
        'export_animation_mode': 'NLA_TRACKS',
        'export_force_sampling': True,
        'export_frame_step': 1,
        'export_optimize_animation_size': True,
        'export_reset_pose_bones': True,
        'export_def_bones': False,
        'export_morph': False,
        # the parts hang on the bones rather than being skinned, so there is no skin to export
        'export_skins': False
    }
    known = bpy.ops.export_scene.gltf.get_rna_type().properties.keys()
    bpy.ops.export_scene.gltf(**{k: v for k, v in options.items() if k in known})


def main(out=None):
    rig, _ = build()
    animate(rig)
    if out:
        export(out)
    return rig


if __name__ == '__main__':
    main(sys.argv[sys.argv.index('--') + 1] if '--' in sys.argv else None)
