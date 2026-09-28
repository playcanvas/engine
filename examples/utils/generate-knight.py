# Generates the knight of the render-to-image example, examples/assets/models/knight.glb: a
# low-poly knight whose armor parts are built from primitives and hang on the bones of an
# armature, with an Idle loop and an Attack. Each part moves rigidly with its bone, so the model
# has no skin.
#
# The Idle is motion capture from the examples' own Bitmoji assets. The Attack comes from
# Quaternius's Universal Animation Library 2 (CC0): download its free Standard pack from
# https://quaternius.itch.io/universal-animation-library-2, and give the generator the path of its
# Unreal-Godot/UAL2_Standard.glb. Run it with Blender (made with 5.2):
#
#     blender --background --factory-startup --python examples/utils/generate-knight.py -- examples/assets/models/knight.glb <UAL2_Standard.glb>

import json
import math
import os
import struct
import sys

import bmesh
import bpy
from mathutils import Matrix, Quaternion, Vector

FPS = 30

# Blender is Z up, and the knight faces -Y, which the glTF exporter turns into +Z

# The palette, in sRGB, with roughness and metalness. There is no environment map in the example,
# so the metals are only slightly metallic, and read as metal by their facets and highlights
PALETTE = {
    'steel': ((0.82, 0.8, 0.8), 0.45, 0.15),
    'blade': ((0.94, 0.91, 0.88), 0.35, 0.1),
    'cream': ((0.937, 0.867, 0.804), 0.75, 0.0),
    'red': ((0.776, 0.173, 0.18), 0.7, 0.0),
    'gold': ((0.82, 0.6, 0.34), 0.45, 0.05),
    'leather': ((0.318, 0.224, 0.184), 0.75, 0.0),
    'dark': ((0.196, 0.208, 0.251), 0.65, 0.0),
    'slot': ((0.05, 0.05, 0.065), 0.5, 0.0)
}

# The pose the parts are built in, which is also the rest pose of the rig and the first frame of
# both animations. Angles are in degrees: pitch leans forwards, yaw turns to the knight's left and
# roll lifts its left side. Hands, poles and directions are in the knight's space
BASE = {
    'hips': (0, 0, 0),
    'hips_dz': 0.0,
    'spine': (0, 0, 0),
    'head': (0, 0, 0),
    'hand_R': (-0.24, -0.14, 0.53),
    'pole_R': (-1.0, 0.4, -0.3),
    'blade_R': (-0.25, -0.4, 1.0),
    'flat_R': (0.0, -1.0, 0.0),
    'hand_L': (0.19, -0.2, 0.6),
    'pole_L': (1.0, 0.3, -0.5),
    'shield_L': (0.35, -1.0, 0.0),
    'foot_R': (0.0, 0.0, 0.0),
    'foot_L': (0.0, 0.0, 0.0)
}

HIPS = (Vector((0, 0, 0.5)), Vector((0, 0, 0.58)))
SPINE = (Vector((0, 0, 0.58)), Vector((0, 0, 0.84)))
HEAD = (Vector((0, 0, 0.86)), Vector((0, 0, 1.24)))
SHOULDER = {'R': Vector((-0.2, 0, 0.78)), 'L': Vector((0.2, 0, 0.78))}
HIP_JOINT = {'R': Vector((-0.09, 0, 0.47)), 'L': Vector((0.09, 0, 0.47))}
ANKLE = {'R': Vector((-0.13, 0, 0.1)), 'L': Vector((0.13, 0, 0.1))}
UPPER_ARM, FOREARM, THIGH, SHIN = 0.16, 0.16, 0.2, 0.2
KNEE_POLE = Vector((0, -1, 0.2))
FORWARD, UP = Vector((0, -1, 0)), Vector((0, 0, 1))

# A rampant lion facing left, as an outline about a metre tall: the emblem on the tabard and shield
LION = [
    (0.10, 1.00), (0.16, 1.08), (0.26, 1.13), (0.34, 1.10), (0.36, 1.00), (0.44, 0.92), (0.50, 0.78),
    (0.56, 0.62), (0.62, 0.50), (0.70, 0.52), (0.80, 0.66), (0.84, 0.82), (0.92, 0.90), (0.86, 0.78),
    (0.78, 0.60), (0.70, 0.44), (0.68, 0.30), (0.72, 0.14), (0.82, 0.04), (0.62, 0.02), (0.60, 0.16),
    (0.52, 0.34), (0.42, 0.26), (0.30, 0.14), (0.26, 0.20), (0.36, 0.34), (0.40, 0.46), (0.30, 0.52),
    (0.16, 0.50), (0.16, 0.58), (0.32, 0.64), (0.30, 0.76), (0.16, 0.84), (0.18, 0.90), (0.32, 0.86),
    (0.24, 0.92), (0.14, 0.94)
]

# A heater shield, 0.3 wide and 0.39 tall, about its middle
HEATER = [
    (-0.15, 0.17), (-0.075, 0.185), (0, 0.19), (0.075, 0.185), (0.15, 0.17), (0.15, 0.05), (0.14, -0.03),
    (0.115, -0.1), (0.075, -0.15), (0.035, -0.18), (0, -0.2), (-0.035, -0.18), (-0.075, -0.15),
    (-0.115, -0.1), (-0.14, -0.03), (-0.15, 0.05)
]


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
# Geometry: small low-poly bmesh builders, in local space

def bevel_edges(bm, edges, offset, segments):
    if edges:
        verts = list({v for e in edges for v in e.verts})
        bmesh.ops.bevel(bm, geom=edges + verts, offset=offset, segments=segments, affect='EDGES',
                        profile=0.5, clamp_overlap=True)


def finish(bm):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def chamfer_box(sx, sy, sz, c):
    """A box centered on the origin, with every edge cut by a flat chamfer."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=(sx, sy, sz), verts=bm.verts)
    if c > 0:
        bevel_edges(bm, list(bm.edges), c, 1)
    return bm


def cylinder(r0, r1, length, segments=8):
    """A cylinder, or a cone, from z = 0 to z = length."""
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segments, radius1=r0,
                          radius2=r1, depth=length)
    bmesh.ops.translate(bm, vec=(0, 0, length / 2), verts=bm.verts)
    return bm


def sphere(r, scale=(1, 1, 1), u=8, v=4):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=u, v_segments=v, radius=r)
    bmesh.ops.scale(bm, vec=scale, verts=bm.verts)
    return bm


def ring(r_in, r_out, height, segments=8):
    """A band around the Z axis, from z = 0 to height, like a cuff or a rim."""
    bm = bmesh.new()
    rows = []
    for i in range(segments):
        a = 2 * math.pi * (i + 0.5) / segments
        c, s = math.cos(a), math.sin(a)
        rows.append([bm.verts.new((c * r, s * r, z)) for r, z in
                     ((r_in, 0), (r_out, 0), (r_out, height), (r_in, height))])
    for i in range(segments):
        j = (i + 1) % segments
        for k in range(4):
            bm.faces.new((rows[i][k], rows[i][(k + 1) % 4], rows[j][(k + 1) % 4], rows[j][k]))
    return finish(bm)


def dome(rx, ry, rz, segments=8, rings=3):
    """The top half of an ellipsoid, on a flat base at z = 0."""
    bm = bmesh.new()
    rows = []
    for k in range(rings):
        t = (math.pi / 2) * k / rings
        rows.append([bm.verts.new((rx * math.cos(a) * math.cos(t), ry * math.sin(a) * math.cos(t),
                                   rz * math.sin(t)))
                     for a in (2 * math.pi * (i + 0.5) / segments for i in range(segments))])
    for a, b in zip(rows, rows[1:]):
        for i in range(segments):
            j = (i + 1) % segments
            bm.faces.new((a[i], a[j], b[j], b[i]))
    top = bm.verts.new((0, 0, rz))
    for i in range(segments):
        bm.faces.new((rows[-1][i], rows[-1][(i + 1) % segments], top))
    bm.faces.new(list(reversed(rows[0])))
    return finish(bm)


def extrude_xy(points, depth):
    """A flat shape from an outline in the XY plane, from z = 0 to z = depth."""
    bm = bmesh.new()
    back = [bm.verts.new((x, y, 0)) for x, y in points]
    front = [bm.verts.new((x, y, depth)) for x, y in points]
    bm.faces.new(front)
    bm.faces.new(list(reversed(back)))
    for i in range(len(points)):
        j = (i + 1) % len(points)
        bm.faces.new((back[i], back[j], front[j], front[i]))
    return finish(bm)


def ribbon(spine, widths, thicknesses, side=Vector((1, 0, 0))):
    """A faceted strip along the points of spine, with a diamond section as wide as widths across
    side, and as thick as thicknesses."""
    bm = bmesh.new()
    spine = [Vector(p) for p in spine]
    sections = []
    for i, p in enumerate(spine):
        t = (spine[min(i + 1, len(spine) - 1)] - spine[max(i - 1, 0)]).normalized()
        s = (side - t * side.dot(t)).normalized()
        u = t.cross(s)
        w, h = widths[i] / 2, thicknesses[i] / 2
        sections.append([bm.verts.new(p + s * w), bm.verts.new(p + u * h), bm.verts.new(p - s * w),
                         bm.verts.new(p - u * h)])
    for a, b in zip(sections, sections[1:]):
        for k in range(4):
            bm.faces.new((a[k], a[(k + 1) % 4], b[(k + 1) % 4], b[k]))
    bm.faces.new(sections[0])
    bm.faces.new(list(reversed(sections[-1])))
    return finish(bm)


def octagon(w, d, c, z, scale=1.0):
    """A rectangle of w by d with its corners cut by c, at height z: the front edge is the first."""
    points = ((-w / 2 + c, -d / 2), (w / 2 - c, -d / 2), (w / 2, -d / 2 + c), (w / 2, d / 2 - c),
              (w / 2 - c, d / 2), (-w / 2 + c, d / 2), (-w / 2, d / 2 - c), (-w / 2, -d / 2 + c))
    return [(x * scale, y * scale, z) for x, y in points]


def loft(rows, cap_top=True, top=None):
    """Join rows of points, each the same length, into a closed shell."""
    bm = bmesh.new()
    verts = [[bm.verts.new(p) for p in row] for row in rows]
    n = len(rows[0])
    for a, b in zip(verts, verts[1:]):
        for i in range(n):
            j = (i + 1) % n
            bm.faces.new((a[i], a[j], b[j], b[i]))
    bm.faces.new(list(reversed(verts[0])))
    if top is not None:
        apex = bm.verts.new(top)
        for i in range(n):
            bm.faces.new((verts[-1][i], verts[-1][(i + 1) % n], apex))
    elif cap_top:
        bm.faces.new(verts[-1])
    return finish(bm)


def blade(length, tip, width, thickness):
    """A sword blade with a six-sided section, along +Y, flat across X."""
    bm = bmesh.new()

    def section(y, w):
        return [bm.verts.new(p) for p in ((w / 2, y, 0), (w / 4, y, thickness / 2), (-w / 4, y, thickness / 2),
                                          (-w / 2, y, 0), (-w / 4, y, -thickness / 2), (w / 4, y, -thickness / 2))]
    base, top = section(0, width), section(length, width * 0.92)
    point = bm.verts.new((0, length + tip, 0))
    for i in range(6):
        j = (i + 1) % 6
        bm.faces.new((base[i], base[j], top[j], top[i]))
        bm.faces.new((top[i], top[j], point))
    bm.faces.new(list(reversed(base)))
    return finish(bm)


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


def rotated(angle, axis):
    return Matrix.Rotation(math.radians(angle), 4, axis)


# Turns a shape built in the XY plane, facing +Z, into one standing upright and facing forwards, -Y
UPRIGHT = rotated(90, 'X')


def outline(points, scale, offset=(0, 0)):
    return [(x * scale + offset[0], y * scale + offset[1]) for x, y in points]


def lion(height, depth):
    """The lion emblem, centered on the origin in the XY plane."""
    xs, ys = [p[0] for p in LION], [p[1] for p in LION]
    s = height / (max(ys) - min(ys))
    cx, cy = (max(xs) + min(xs)) / 2, (max(ys) + min(ys)) / 2
    return extrude_xy([((x - cx) * s, (y - cy) * s) for x, y in LION], depth)


def hem(width, length, teeth):
    """A cloth panel hanging from y = 0 down to about -length, with a torn hem of teeth: a list of
    (x, depth below length) from the right edge to the left."""
    return [(-width / 2, 0), (width / 2, 0)] + [(x * width / 2, -length - d) for x, d in teeth]


class Parts:
    """Collects the parts of each bone into one mesh, with a material per part, or per face."""

    def __init__(self, materials):
        self.materials = materials
        self.meshes = {}

    def add(self, owner, bm, material, matrix=None):
        names = list(self.materials)
        for f in bm.faces:
            f.material_index = names.index(material(f) if callable(material) else material)
            f.smooth = False
        if matrix is not None:
            bmesh.ops.transform(bm, matrix=matrix, verts=bm.verts)
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


def split_at_x(bm, x=0.0):
    """Cut a shape in two along a plane across X, so each side can have its own material."""
    geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
    bmesh.ops.bisect_plane(bm, geom=geom, plane_co=(x, 0, 0), plane_no=(1, 0, 0))
    return bm


def by_side(left, right, x=0.0):
    """A material for each face by which side of x its middle is on."""
    return lambda f: left if f.calc_center_median().x < x else right


def shell(rows, thickness):
    """A plate curving through a grid of points, rows by columns, as thick as thickness towards
    the vertical axis, with a rim around its edges. Returns the plate, and the faces of its rim."""
    bm = bmesh.new()
    rim = set()

    def inward(p):
        k = max(math.hypot(p[0], p[1]) - thickness, 0) / math.hypot(p[0], p[1])
        return (p[0] * k, p[1] * k, p[2])
    outer = [[bm.verts.new(p) for p in row] for row in rows]
    inner = [[bm.verts.new(inward(p)) for p in row] for row in rows]
    for r in range(len(rows) - 1):
        for c in range(len(rows[0]) - 1):
            bm.faces.new((outer[r][c], outer[r][c + 1], outer[r + 1][c + 1], outer[r + 1][c]))
            bm.faces.new((inner[r][c], inner[r + 1][c], inner[r + 1][c + 1], inner[r][c + 1]))
    for c in range(len(rows[0]) - 1):
        rim.add(bm.faces.new((outer[0][c], inner[0][c], inner[0][c + 1], outer[0][c + 1])))
        rim.add(bm.faces.new((outer[-1][c], outer[-1][c + 1], inner[-1][c + 1], inner[-1][c])))
    for r in range(len(rows) - 1):
        rim.add(bm.faces.new((outer[r][0], outer[r + 1][0], inner[r + 1][0], inner[r][0])))
        rim.add(bm.faces.new((outer[r][-1], inner[r][-1], inner[r + 1][-1], outer[r + 1][-1])))
    return finish(bm), rim


def slit(center, along, out, width, height):
    """A dark slit on a face of the visor: its width runs along the face, and it stands out of it."""
    m = Matrix((along, -out, Vector((0, 0, 1)))).transposed().to_4x4()
    m.translation = center + out * 0.002
    return chamfer_box(width, 0.012, height, 0.003), m


def build_helmet(parts, base):
    """An armet: a round skull, a visor standing proud of it with slits across its face, gold hinges
    where the visor pivots at the sides, and a plume. base is where the middle of the skull's bottom
    edge sits."""
    h = 0.27
    at = translated(*base) @ Matrix.Scale(1.08, 4)

    # The skull: rings of ten sides, rounding over into a dome
    sides = 10
    profile = ((0.0, 0.165, 0.172), (0.08, 0.186, 0.19), (0.18, 0.192, 0.196), (0.26, 0.178, 0.182),
               (0.32, 0.142, 0.146), (0.37, 0.085, 0.088))
    angles = [2 * math.pi * (i + 0.5) / sides for i in range(sides)]
    rows = [[(rx * math.sin(a), -ry * math.cos(a), z) for a in angles] for z, rx, ry in profile]
    parts.add('Head', loft(rows, top=(0, 0.01, 0.395)), 'steel', at)

    # The visor: a plate over the face, from hinge to hinge, with dark edges where it stands off the
    # skull. Its middle band holds the slits under an overhanging brow, and it slopes back in to the
    # skull above the brow and at its chin
    plan = ((-0.208, 0.02), (-0.205, -0.105), (-0.108, -0.235), (0.108, -0.235), (0.205, -0.105), (0.208, 0.02))
    band = (0.1, 0.205)
    rows = ((0.03, 0.84), (band[0], 1.0), (band[1], 1.0), (0.215, 1.025), (0.232, 1.025), (0.265, 0.95))
    visor, rim = shell([[(x * k, y * k, z) for x, y in plan] for z, k in rows], 0.02)
    parts.add('Head', visor, lambda f: 'dark' if f in rim else 'steel', at)
    # the shadow of the visor's top edge on the skull, which shows where the two plates part
    gap = []
    for z in (0.262, 0.29):
        k = (z - 0.26) / 0.06
        rx, ry = 0.178 - 0.036 * k + 0.004, 0.182 - 0.036 * k + 0.004
        gap.append([(rx * math.sin(math.radians(t)), -ry * math.cos(math.radians(t)), z) for t in range(-80, 81, 20)])
    parts.add('Head', shell(gap, 0.006)[0], 'dark', at)
    mid = (band[0] + band[1]) / 2
    for x in (-0.062, 0, 0.062):
        box, m = slit(Vector((x, plan[2][1], mid)), Vector((1, 0, 0)), Vector((0, -1, 0)), 0.032, 0.085)
        parts.add('Head', box, 'slot', at @ m)
    for sx in (-1, 1):
        p1, p2 = Vector((plan[1][0] * sx, plan[1][1], 0)), Vector((plan[2][0] * sx, plan[2][1], 0))
        along = (p2 - p1).normalized()
        out = Vector((-along.y, along.x, 0))
        if out.dot(p1 + p2) < 0:
            out.negate()
        for t in (0.35, 0.65):
            box, m = slit(p1.lerp(p2, t) + Vector((0, 0, mid)), along, out, 0.03, 0.08)
            parts.add('Head', box, 'slot', at @ m)

    # The gold hinges the visor turns on, each with a rivet, and the plume's holder on top
    for sx in (-1, 1):
        parts.add('Head', cylinder(0.042, 0.042, 0.02), 'gold',
                  at @ translated(sx * 0.2, 0.02, mid) @ rotated(sx * 90, 'Y'))
        parts.add('Head', sphere(0.013, (1, 1, 1), 4, 2), 'gold', at @ translated(sx * 0.222, 0.02, mid))
    parts.add('Head', cylinder(0.034, 0.03, 0.05, 6), 'gold', at @ translated(0, 0.04, 0.355))

    # The plume rises from the holder, and sweeps back in two tails
    main = [(0.0, 0.04, h + 0.14), (0.01, 0.02, h + 0.24), (0.04, 0.06, h + 0.34), (0.07, 0.15, h + 0.39),
            (0.085, 0.27, h + 0.36), (0.085, 0.37, h + 0.26), (0.07, 0.42, h + 0.13), (0.05, 0.42, h + 0.01),
            (0.035, 0.38, h - 0.08)]
    parts.add('Head', ribbon(main, [0.07, 0.13, 0.18, 0.2, 0.19, 0.17, 0.14, 0.1, 0.03],
                             [0.05, 0.08, 0.1, 0.11, 0.1, 0.09, 0.08, 0.06, 0.02]), 'red', at)
    tail = [(0.05, 0.12, h + 0.33), (0.02, 0.25, h + 0.31), (-0.02, 0.36, h + 0.22), (-0.045, 0.43, h + 0.09),
            (-0.05, 0.43, h - 0.03)]
    parts.add('Head', ribbon(tail, [0.12, 0.14, 0.12, 0.09, 0.03], [0.07, 0.08, 0.07, 0.05, 0.02]), 'red', at)


def build_parts(parts, j):
    """The knight, in the rest pose. Each part is added to the bone it moves with."""
    # Legs: dark hose, steel knees with gold bands, steel greaves, and pointed steel sabatons
    for side, sx in (('R', -1), ('L', 1)):
        hip, knee, ankle = HIP_JOINT[side], j['knee_' + side], j['ankle_' + side]
        down = (ankle - knee).normalized()
        parts.add('Thigh.' + side, cylinder(0.058, 0.054, (knee - hip).length), 'dark', placed(hip, knee))
        parts.add('Thigh.' + side, sphere(0.068, (1, 0.85, 1)), 'steel', translated(*knee))
        parts.add('Shin.' + side, cylinder(0.064, 0.054, (ankle - knee).length), 'steel', placed(knee, ankle))
        parts.add('Shin.' + side, ring(0.06, 0.074, 0.022), 'gold', placed(knee + down * 0.045, ankle))
        shoe = chamfer_box(0.13, 0.22, 0.085, 0.014)
        for v in shoe.verts:
            f = max(0.0, -v.co.y / 0.11)
            v.co.x *= 1 - 0.45 * f
            if v.co.z > 0:
                v.co.z -= 0.035 * f
        parts.add('Foot.' + side, shoe, 'steel', translated(ankle.x + sx * 0.005, -0.04, 0.05))
        parts.add('Foot.' + side, chamfer_box(0.132, 0.222, 0.014, 0.004), 'leather',
                  translated(ankle.x + sx * 0.005, -0.04, 0.007))
        parts.add('Foot.' + side, ring(0.052, 0.068, 0.024), 'gold', translated(ankle.x, 0, 0.085))

    # Hips: a leather belt with a gold buckle and a pouch, and the skirt of the tabard, red in the
    # middle of the front and cream at its sides, cream in the middle of the back, with torn hems
    parts.add('Hips', loft([octagon(0.37, 0.29, 0.07, 0.49), octagon(0.37, 0.29, 0.07, 0.56)]), 'leather')
    parts.add('Hips', chamfer_box(0.085, 0.02, 0.075, 0.006), 'gold', translated(0, -0.152, 0.525))
    parts.add('Hips', chamfer_box(0.048, 0.014, 0.038, 0.004), 'leather', translated(0, -0.158, 0.525))
    parts.add('Hips', chamfer_box(0.09, 0.06, 0.09, 0.01), 'leather', translated(0.2, -0.03, 0.47))
    parts.add('Hips', chamfer_box(0.096, 0.066, 0.034, 0.008), 'leather', translated(0.2, -0.03, 0.51))
    panels = [
        # (material, width, length, teeth, x, y, turn about Z)
        ('red', 0.15, 0.2, [(1, 0.03), (0.4, -0.02), (-0.1, 0.05), (-0.6, 0.01), (-1, 0.035)], 0, -0.146, 0),
        ('cream', 0.1, 0.17, [(1, 0.02), (0.3, -0.015), (-0.4, 0.03), (-1, 0.0)], -0.125, -0.13, 30),
        ('cream', 0.1, 0.17, [(1, 0.0), (0.4, 0.03), (-0.3, -0.015), (-1, 0.02)], 0.125, -0.13, -30),
        ('red', 0.13, 0.19, [(1, 0.02), (0.2, -0.015), (-0.5, 0.03), (-1, 0.0)], -0.185, 0, 90),
        ('red', 0.13, 0.19, [(1, 0.0), (0.5, 0.03), (-0.2, -0.015), (-1, 0.02)], 0.185, 0, -90),
        ('cream', 0.16, 0.2, [(1, 0.02), (0.35, -0.01), (-0.2, 0.04), (-1, 0.01)], 0, 0.146, 180)
    ]
    for material, width, length, teeth, x, y, turn in panels:
        m = translated(x, y, 0.505) @ rotated(turn, 'Z') @ rotated(-7, 'X') @ UPRIGHT
        parts.add('Hips', extrude_xy(hem(width, length, teeth), 0.014), material, m)

    # Chest: a steel breastplate, a red tabard with the lion, and a red scarf around the neck that
    # hangs in a point at the front and the back
    chest = chamfer_box(0.34, 0.26, 0.3, 0.035)
    for v in chest.verts:
        if v.co.z < 0:
            v.co.x *= 0.93
            v.co.y *= 0.93
    parts.add('Spine', chest, 'steel', translated(0, 0, 0.7))
    parts.add('Spine', chamfer_box(0.21, 0.02, 0.23, 0.004), 'red', translated(0, -0.137, 0.665))
    parts.add('Spine', lion(0.1, 0.006), 'cream', translated(0, -0.147, 0.615) @ UPRIGHT)
    parts.add('Spine', cylinder(0.08, 0.075, 0.1), 'dark', translated(0, 0, 0.8))
    collar = loft([octagon(0.31, 0.29, 0.08, 0.77), octagon(0.27, 0.25, 0.07, 0.875)])
    parts.add('Spine', collar, 'red')
    parts.add('Spine', extrude_xy([(-0.15, 0), (0.15, 0), (0, -0.1)], 0.022), 'red',
              translated(0, -0.14, 0.815) @ rotated(-10, 'X') @ UPRIGHT)
    parts.add('Spine', extrude_xy([(-0.16, 0), (0.16, 0), (0, -0.2)], 0.022), 'red',
              translated(0, 0.14, 0.81) @ rotated(180, 'Z') @ rotated(-8, 'X') @ UPRIGHT)

    build_helmet(parts, HEAD[0])

    # Arms: layered steel pauldrons with gold rims and rivets, dark sleeves, steel elbows and
    # vambraces with gold cuffs, and dark gauntlets
    for side, sx in (('R', -1), ('L', 1)):
        shoulder, elbow, hand = SHOULDER[side], j['elbow_' + side], j['hand_' + side]
        top = translated(shoulder.x + sx * 0.035, 0, shoulder.z + 0.03) @ rotated(-sx * 25, 'Y')
        parts.add('UpperArm.' + side, dome(0.12, 0.12, 0.085), 'steel', top)
        parts.add('UpperArm.' + side, ring(0.108, 0.126, 0.018), 'gold', top)
        lower = translated(shoulder.x + sx * 0.085, 0, shoulder.z - 0.02) @ rotated(-sx * 45, 'Y')
        parts.add('UpperArm.' + side, dome(0.1, 0.105, 0.055), 'steel', lower)
        parts.add('UpperArm.' + side, ring(0.09, 0.106, 0.015), 'gold', lower)
        parts.add('UpperArm.' + side, sphere(0.018, (1, 1, 1), 4, 2), 'gold', top @ translated(0, -0.07, 0.06))
        parts.add('UpperArm.' + side, cylinder(0.042, 0.04, (elbow - shoulder).length), 'dark', placed(shoulder, elbow))
        along = (hand - elbow).normalized()
        parts.add('Forearm.' + side, sphere(0.05), 'steel', translated(*elbow))
        parts.add('Forearm.' + side, cylinder(0.046, 0.055, (hand - elbow).length - 0.03), 'steel', placed(elbow, hand))
        parts.add('Forearm.' + side, ring(0.05, 0.063, 0.022), 'gold', placed(hand - along * 0.05, hand))
        parts.add('Hand.' + side, chamfer_box(0.085, 0.09, 0.09, 0.016), 'dark', translated(*hand))

    # The sword, in the right hand: its blade points along the hand bone, flat across its X axis
    hand = frame_matrix(j['hand_R'], BASE['blade_R'], BASE['flat_R'])
    parts.add('Hand.R', blade(0.46, 0.13, 0.085, 0.024), 'blade', hand @ translated(0, 0.075, 0))
    guard = [(-0.13, 0), (-0.11, 0.022), (-0.035, 0.018), (-0.03, 0.035), (0.03, 0.035), (0.035, 0.018),
             (0.11, 0.022), (0.13, 0), (0.11, -0.022), (0.035, -0.018), (0.03, -0.03), (-0.03, -0.03),
             (-0.035, -0.018), (-0.11, -0.022)]
    parts.add('Hand.R', extrude_xy(guard, 0.034), 'gold', hand @ translated(0, 0.055, -0.017))
    along_blade = rotated(-90, 'X')
    parts.add('Hand.R', cylinder(0.02, 0.02, 0.12, 6), 'leather', hand @ translated(0, -0.07, 0) @ along_blade)
    for y in (-0.045, -0.01, 0.025):
        parts.add('Hand.R', ring(0.018, 0.024, 0.012, 6), 'leather', hand @ translated(0, y, 0) @ along_blade)
    parts.add('Hand.R', sphere(0.032, (1, 1, 1.5), 6, 2), 'gold', hand @ translated(0, -0.1, 0) @ along_blade)

    # The shield, on the left forearm: gold rimmed, red and cream halves, and a lion in the colors
    # of the other half. It stands upright, facing forwards and a little out, in front of the fist
    elbow, hand = j['elbow_L'], j['hand_L']
    normal = Vector(BASE['shield_L']).normalized()
    shield = frame_matrix(hand + (elbow - hand) * 0.35 + normal * 0.07 + UP * -0.08, UP, normal)
    parts.add('Forearm.L', extrude_xy(HEATER, 0.025), 'gold', shield)
    field = split_at_x(extrude_xy(outline(HEATER, 0.88, (0, -0.004)), 0.016))
    parts.add('Forearm.L', field, by_side('red', 'cream'), shield @ translated(0, 0, 0.025))
    parts.add('Forearm.L', split_at_x(lion(0.22, 0.006)), by_side('cream', 'red'), shield @ translated(0, 0, 0.041))
    for x, y in ((-0.125, 0.155), (0.125, 0.155), (-0.13, 0.0), (0.13, 0.0), (-0.06, -0.15), (0.06, -0.15)):
        parts.add('Forearm.L', sphere(0.011, (1, 1, 1), 4, 2), 'gold', shield @ translated(x, y, 0.03))


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


# -------------------------------------------------------------------------------------------------
# Motion capture: the idle is the Bitmoji eager idle from the examples' assets, layered on the
# knight's stance. Each of these bones turns in the world as its joint in the capture turns from
# the capture's first frame, and the legs are solved to keep the feet planted

MOCAP_IDLE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'animations', 'bitmoji',
                          'idle-eager.glb')
MOCAP_JOINTS = {
    'Hips': 'C_spine0001_bind_JNT',
    'Spine': 'C_spine0006_bind_JNT',
    'Head': 'C_head0001_bind_JNT',
    'UpperArm.R': 'R_armUpper0001_bind_JNT',
    'Forearm.R': 'R_armLower0001_bind_JNT',
    'Hand.R': 'R_hand0001_bind_JNT',
    'UpperArm.L': 'L_armUpper0001_bind_JNT',
    'Forearm.L': 'L_armLower0001_bind_JNT',
    'Hand.L': 'L_hand0001_bind_JNT'
}

# glTF is Y up and faces +Z. Blender is Z up and the knight faces -Y
GLTF_TO_BLENDER = Matrix(((1, 0, 0), (0, 0, -1), (0, 1, 0)))


def read_glb(path):
    with open(path, 'rb') as f:
        data = f.read()
    length = struct.unpack_from('<I', data, 12)[0]
    return json.loads(data[20:20 + length]), data[20 + length + 8:]


def read_accessor(gltf, binary, index):
    """The floats of an accessor, as tuples for vectors."""
    a = gltf['accessors'][index]
    view = gltf['bufferViews'][a['bufferView']]
    size = {'SCALAR': 1, 'VEC3': 3, 'VEC4': 4}[a['type']]
    stride = view.get('byteStride', size * 4)
    start = view.get('byteOffset', 0) + a.get('byteOffset', 0)
    values = [struct.unpack_from('<%df' % size, binary, start + i * stride) for i in range(a['count'])]
    return [v[0] for v in values] if size == 1 else values


def sample(times, values, t, rotation):
    """The value of a linear channel at time t."""
    if t <= times[0]:
        return values[0]
    for i in range(1, len(times)):
        if t <= times[i]:
            k = (t - times[i - 1]) / (times[i] - times[i - 1])
            a, b = values[i - 1], values[i]
            if rotation:
                qa, qb = Quaternion((a[3], a[0], a[1], a[2])), Quaternion((b[3], b[0], b[1], b[2]))
                # slerp doesn't take the short way round by itself
                if qa.dot(qb) < 0:
                    qb.negate()
                q = qa.slerp(qb, k)
                return (q.x, q.y, q.z, q.w)
            return tuple(x + (y - x) * k for x, y in zip(a, b))
    return values[-1]


def capture(path, joints, clips=None):
    """For each frame, at FPS, of the clips in path, one after another (or of its first clip): the
    world rotation of each of joints, and the world position of the first, in Blender's axes."""
    gltf, binary = read_glb(path)
    by_name = {a.get('name'): a for a in gltf['animations']}
    frames = []
    for animation in [by_name[c] for c in clips] if clips else gltf['animations'][:1]:
        # a clip after the first starts where the one before it ended, so drop its first frame
        frames += capture_clip(gltf, binary, animation, joints)[1 if frames else 0:]
    return frames


def capture_clip(gltf, binary, animation, joints):
    nodes = gltf['nodes']
    parent = {c: i for i, n in enumerate(nodes) for c in n.get('children', [])}
    channels = {}
    for ch in animation['channels']:
        if ch['target']['path'] in ('translation', 'rotation'):
            sampler = animation['samplers'][ch['sampler']]
            channels[(ch['target']['node'], ch['target']['path'])] = (
                read_accessor(gltf, binary, sampler['input']), read_accessor(gltf, binary, sampler['output']))
    duration = max(times[-1] for times, _ in channels.values())
    index = {n.get('name'): i for i, n in enumerate(nodes)}

    def world(i, t, cache):
        if i not in cache:
            n = nodes[i]
            tr, ro = channels.get((i, 'translation')), channels.get((i, 'rotation'))
            p = sample(*tr, t, False) if tr else n.get('translation', (0, 0, 0))
            q = sample(*ro, t, True) if ro else n.get('rotation', (0, 0, 0, 1))
            local = Matrix.Translation(p) @ Quaternion((q[3], q[0], q[1], q[2])).to_matrix().to_4x4()
            cache[i] = (world(parent[i], t, cache) if i in parent else Matrix.Identity(4)) @ local
        return cache[i]

    first = next(iter(joints))
    frames = []
    for f in range(int(round(duration * FPS)) + 1):
        cache = {}
        w = {bone: world(index[joint], f / FPS, cache) for bone, joint in joints.items()}
        turns = {bone: GLTF_TO_BLENDER @ m.to_3x3().normalized() @ GLTF_TO_BLENDER.transposed()
                 for bone, m in w.items()}
        frames.append((turns, GLTF_TO_BLENDER @ w[first].translation))
    return frames


def solve_legs(rig, p):
    """Solve the legs from where the hips are to the feet of pose p."""
    bones = rig.pose.bones
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


def apply_layered(rig, p, turns, hips_offset):
    """Pose the rig as p, then turn each bone of turns in the world by its rotation, and move the
    hips by hips_offset. Legs that turns doesn't move are solved to keep the feet planted."""
    apply_pose(rig, p)
    bones = rig.pose.bones
    base = {name: bones[name].matrix.copy() for name in turns}
    for name in BONE_NAMES:
        if name not in turns:
            continue
        bone = bones[name]
        m = (turns[name] @ base[name].to_3x3()).to_4x4()
        m.translation = base[name].translation + hips_offset if name == 'Hips' else bone.head
        bone.matrix = m
        update()
    if 'Thigh.R' not in turns:
        solve_legs(rig, p)


def key_rig(rig, frame, previous):
    for bone in rig.pose.bones:
        # keep each rotation in the same hemisphere as the last, so keys turn the short way
        q = bone.rotation_quaternion.copy()
        if bone.name in previous and previous[bone.name].dot(q) < 0:
            q.negate()
            bone.rotation_quaternion = q
        previous[bone.name] = q
        bone.keyframe_insert('location', frame=frame)
        bone.keyframe_insert('rotation_quaternion', frame=frame)


def facing(turn):
    """How far a rotation turns the knight about the vertical, in radians."""
    ahead = turn @ FORWARD
    return math.atan2(ahead.x, -ahead.y)


def record_mocap(rig, name, p, path, joints, hips_scale, clips=None, keep_turn=1.0):
    """Key the capture of clips in path, layered on the pose p, into an action on an NLA track of
    name. keep_turn is how much of the capture's turning about the vertical the knight follows: the
    whole pose turns back by the rest, so the motion of its parts against each other stays."""
    frames = capture(path, joints, clips)
    first_turns, first_hips = frames[0]
    data = rig.animation_data or rig.animation_data_create()
    action = bpy.data.actions.new(name)
    data.action = action
    previous = {}
    for frame, (turns, hips) in enumerate(frames):
        relative = {bone: turns[bone] @ first_turns[bone].transposed() for bone in joints}
        back = Matrix.Rotation(-(1 - keep_turn) * facing(relative['Hips']), 3, 'Z')
        relative = {bone: back @ turn for bone, turn in relative.items()}
        apply_layered(rig, p, relative, back @ ((hips - first_hips) * hips_scale))
        key_rig(rig, frame, previous)
    track = data.nla_tracks.new()
    track.name = name
    track.strips.new(name, 0, action)
    data.action = None
    return action


# The attack is a sword slash and its recovery from Quaternius's Universal Animation Library 2
# (CC0, https://quaternius.itch.io/universal-animation-library-2), whose UAL2_Standard.glb the
# generator is given. Its legs move too, so the knight steps into the slash
ATTACK_CLIPS = ['Sword_Regular_A', 'Sword_Regular_A_Rec']
UAL2_JOINTS = {
    'Hips': 'pelvis',
    'Spine': 'spine_03',
    'Head': 'Head',
    'UpperArm.R': 'upperarm_r',
    'Forearm.R': 'lowerarm_r',
    'Hand.R': 'hand_r',
    'UpperArm.L': 'upperarm_l',
    'Forearm.L': 'lowerarm_l',
    'Hand.L': 'hand_l',
    'Thigh.R': 'thigh_r',
    'Shin.R': 'calf_r',
    'Foot.R': 'foot_r',
    'Thigh.L': 'thigh_l',
    'Shin.L': 'calf_l',
    'Foot.L': 'foot_l'
}
UAL2_HIPS_HEIGHT = 0.917


def animate(rig, ual2):
    record_mocap(rig, 'Idle', BASE, MOCAP_IDLE, MOCAP_JOINTS, HIPS[0].z / 0.58)
    # the slash turns the body far round, so the knight follows a third of that, and stays facing
    # the portrait camera
    record_mocap(rig, 'Attack', BASE, ual2, UAL2_JOINTS, HIPS[0].z / UAL2_HIPS_HEIGHT, ATTACK_CLIPS, 0.35)
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


def main(ual2, out=None):
    rig, _ = build()
    animate(rig, ual2)
    if out:
        export(out)
    return rig


if __name__ == '__main__':
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    if len(args) != 2:
        sys.exit('usage: blender --background --factory-startup --python generate-knight.py -- <out.glb> <UAL2_Standard.glb>')
    main(args[1], args[0])
