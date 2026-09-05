"""Run in Blender via MCP. Original low-poly models for Louise's Vet Office."""
import bpy
import math
import os
from mathutils import Vector

ROOT = globals().get('PROJECT_ROOT', 'C:/Users/david/OneDrive/Desktop/vet-game')
OUT = os.path.join(ROOT, 'public', 'models')
os.makedirs(OUT, exist_ok=True)
previous = bpy.data.scenes.get("Louise's asset studio")
if previous:
    for obj in list(previous.objects): bpy.data.objects.remove(obj, do_unlink=True)
    bpy.data.scenes.remove(previous)
scene = bpy.data.scenes.new("Louise's asset studio")
bpy.context.window.scene = scene
materials = {}

def material(name, color):
    if name not in materials:
        m = bpy.data.materials.new(name)
        m.diffuse_color = (*color, 1)
        m.use_nodes = True
        shader = m.node_tree.nodes.get('Principled BSDF')
        shader.inputs['Base Color'].default_value = (*color, 1)
        shader.inputs['Roughness'].default_value = .78
        materials[name] = m
    return materials[name]

colors = {
    'cream': (.93,.86,.70), 'white': (.98,.95,.87), 'mint': (.32,.64,.53),
    'dark': (.07,.20,.17), 'wood': (.59,.34,.17), 'oak': (.76,.52,.29),
    'pink': (.87,.42,.39), 'gold': (.91,.62,.19), 'blue': (.30,.55,.65),
    'leaf': (.28,.48,.22), 'lightleaf': (.48,.66,.28), 'black': (.025,.035,.033),
    'fur': (.74,.43,.20), 'lightfur': (.92,.70,.40), 'gray': (.49,.57,.57),
    'louise_skin': (.82,.57,.44), 'louise_hair': (.32,.23,.14),
    'louise_pink': (.76,.30,.53), 'louise_eyes': (.12,.26,.33),
}
for n,c in colors.items(): material(n,c)

def finish(obj, name, color, parent=None):
    obj.name = name
    obj.data.materials.append(materials[color])
    if parent: obj.parent = parent
    return obj

def cube(name, loc, size, color, parent=None, bevel=.05):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o=bpy.context.object
    o.scale=size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        mod=o.modifiers.new('Soft corners','BEVEL'); mod.width=bevel; mod.segments=3
        o.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
    return finish(o,name,color,parent)

def ball(name, loc, scale, color, parent=None):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=10, radius=1, location=loc)
    o=bpy.context.object; o.scale=scale
    for p in o.data.polygons: p.use_smooth=True
    return finish(o,name,color,parent)

def cyl(name,loc,radius,depth,color,parent=None):
    bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=radius, depth=depth, location=loc)
    return finish(bpy.context.object,name,color,parent)

def root(name):
    o=bpy.data.objects.new(name,None); scene.collection.objects.link(o); return o

def line(name, points, radius, color, parent):
    curve=bpy.data.curves.new(name,'CURVE'); curve.dimensions='3D'
    curve.bevel_depth=radius; curve.bevel_resolution=3
    spline=curve.splines.new('POLY'); spline.points.add(len(points)-1)
    for p,co in zip(spline.points,points): p.co=(*co,1)
    obj=bpy.data.objects.new(name,curve);scene.collection.objects.link(obj)
    obj.parent=parent;obj.data.materials.append(materials[color]);return obj

def export(name, group):
    bpy.ops.object.select_all(action='DESELECT')
    group.select_set(True)
    for o in group.children_recursive: o.select_set(True)
    bpy.context.view_layer.objects.active=group
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,name+'.glb'), export_format='GLB', use_selection=True, export_extras=True, export_cameras=False, export_lights=False)
    group.hide_set(True)
    for o in group.children_recursive: o.hide_set(True)

for species in ['dog','cat','rabbit','hamster','gerbil','goldfish']:
    r=root(species)
    if species=='goldfish':
        ball('body',(0,0,.65),(.37,.62,.40),'gold',r)
        ball('tail',(0,.61,.67),(.07,.32,.34),'pink',r)
        for x in [-.27,.27]:
            ball('eye',(x,-.36,.79),(.12,.12,.12),'white',r)
            ball('pupil',(x,-.45,.80),(.055,.05,.065),'black',r)
        ball('fin',(0,.08,1.02),(.06,.25,.17),'pink',r)
        cyl('bowl_base',(0,0,.07),.76,.12,'blue',r)
        bpy.ops.mesh.primitive_torus_add(major_radius=.70,minor_radius=.045,major_segments=32,minor_segments=8,location=(0,0,1.28))
        finish(bpy.context.object,'bowl_rim','blue',r)
    else:
        small=species in ['hamster','gerbil']
        fur='fur' if species in ['dog','gerbil'] else 'gray' if species=='cat' else 'white' if species=='rabbit' else 'lightfur'
        ball('body',(0,.18,.65),(.42,.67,.42),fur,r)
        ball('chest',(0,-.30,.73),(.34,.31,.38),'cream',r)
        ball('head',(0,-.55,.98),(.39,.35,.38),fur,r)
        ball('muzzle',(0,-.83,.84),(.24,.18,.17),'cream',r)
        ball('nose',(0,-.988,.89),(.075,.045,.052),'black' if species=='dog' else 'pink',r)
        for x in [-.18,.18]:
            ball('eye',(x,-.851,1.055),(.058,.043,.075),'black',r)
            ball('eye_sparkle',(x-.014,-.883,1.083),(.018,.012,.022),'white',r)
        for x in [-.28,.28]:
            for y in [-.28,.60]: ball('paw',(x,y,.21),(.17,.23,.19),fur,r)
        if species=='dog':
            for x in [-.37,.37]: ball('ear',(x,-.47,.97),(.14,.18,.35),'wood',r)
            ball('tail',(.08,.90,.89),(.13,.36,.14),'fur',r).rotation_euler[0]=.6
            cyl('collar',(0,-.39,.74),.34,.08,'mint',r).rotation_euler[0]=math.pi/2
        elif species=='rabbit':
            for x in [-.20,.20]:
                ball('ear',(x,-.47,1.47),(.115,.12,.44),'white',r)
                ball('inner_ear',(x,-.565,1.48),(.059,.035,.30),'pink',r)
            ball('tail',(0,.90,.65),(.23,.23,.23),'white',r)
        elif species=='cat':
            for x in [-.27,.27]:
                bpy.ops.mesh.primitive_cone_add(vertices=3,radius1=.20,depth=.36,location=(x,-.44,1.32))
                finish(bpy.context.object,'ear','gray',r)
            ball('tail',(.24,.85,.86),(.13,.40,.13),'gray',r).rotation_euler[0]=.8
        else:
            for x in [-.30,.30]:
                ball('ear',(x,-.48,1.30),(.18,.10,.19),fur,r)
                ball('inner_ear',(x,-.57,1.30),(.105,.035,.12),'pink',r)
            if species=='gerbil': ball('tail',(.12,1.02,.30),(.08,.43,.07),'pink',r)
        for name,pos in [('ear',(.36,-.48,1.16)),('chest',(0,-.65,.66)),('paw',(.28,-.28,.29)),('coat',(.38,.28,.80))]:
            marker=root('spot_'+name); marker.parent=r; marker.location=pos
    export(species,r)

def plant(x,y,z=0,parent=None):
    cyl('terracotta pot',(x,y,z+.23),.24,.44,'pink',parent)
    for dx,dy,h in [(-.16,0,.70),(.17,.06,.82),(0,-.10,1.0)]:
        ball('leaf',(x+dx,y+dy,z+h),(.18,.12,.35),'leaf' if dx else 'lightleaf',parent)

clinic=root('clinic')
cube('foundation',(0,0,-.18),(10.8,8.5,.36),'cream',clinic,.12)
for x in range(10):
    for y in range(8):
        cube('floor tile',(x-4.5,y-3.5,.025),(.985,.985,.055),'white' if (x+y)%2==0 else 'cream',clinic,.008)
cube('back wall',(0,3.96,1.70),(10.5,.18,3.4),'cream',clinic)
cube('left wall',(-5.14,0,1.70),(.18,8,3.4),'cream',clinic)
cube('back dado',(0,3.83,.55),(10.4,.12,1.10),'mint',clinic)
cube('left dado',(-5.01,0,.55),(.12,8,1.10),'mint',clinic)
cube('back trim',(0,3.70,1.12),(10.4,.12,.09),'white',clinic)
cube('left trim',(-4.94,0,1.12),(.12,8,.09),'white',clinic)
# A broad window and framed wall art on the back wall.
cube('window frame',(-2.55,3.69,2.27),(2.9,.17,1.65),'white',clinic)
cube('window sky',(-2.55,3.57,2.27),(2.62,.04,1.4),'blue',clinic)
cube('window bar',(-2.55,3.49,2.27),(.08,.08,1.4),'white',clinic)
cube('window crossbar',(-2.55,3.49,2.27),(2.65,.08,.08),'white',clinic)
# Open side entrance: customers come in from the right, then approach the desk.
for y in [-2.60,-.70]:
    cube('side entrance post',(5.02,y,1.24),(.20,.18,2.48),'mint',clinic)
cube('side entrance lintel',(5.02,-1.65,2.48),(.20,2.08,.20),'mint',clinic)
cube('side wall cutaway',(5.02,-3.25,.48),(.16,1.10,.96),'mint',clinic)
cube('welcome mat',(4.45,-1.65,.08),(1.15,1.70,.08),'pink',clinic)
cube('picture frame',(.31,3.61,2.38),(1.25,.18,1.05),'oak',clinic)
cube('picture paper',(.31,3.49,2.38),(1.03,.04,.83),'white',clinic)
for x,z,s in [(.31,2.29,.18),(.02,2.53,.085),(.24,2.66,.085),(.48,2.64,.085),(.64,2.48,.08)]:
    ball('paw print',(x,3.43,z),(s,.025,s),'mint',clinic)
# Counter at the back, with Louise behind it facing the waiting area.
before_counter=set(clinic.children)
cube('reception counter',(-.65,-1.42,.64),(4.1,1.03,1.28),'mint',clinic,.13)
cube('countertop',(-.65,-1.42,1.32),(4.32,1.2,.16),'oak',clinic,.09)
cube('counter front panel',(-.65,-1.957,.70),(3.68,.045,.84),'cream',clinic,.04)
cube('cross vertical',(-.65,-1.995,.71),(.14,.055,.47),'mint',clinic,.015)
cube('cross horizontal',(-.65,-1.998,.71),(.47,.055,.14),'mint',clinic,.015)
cube('monitor base',(-1.75,-1.36,1.44),(.48,.34,.07),'dark',clinic)
cube('monitor',(-1.75,-1.30,1.73),(.68,.14,.48),'dark',clinic)
cube('monitor screen',(-1.75,-1.391,1.73),(.57,.02,.36),'blue',clinic)
cube('appointment book',(.26,-1.50,1.43),(.53,.37,.065),'white',clinic,.025)
cyl('bell',(.79,-1.52,1.47),.13,.11,'gold',clinic)
for obj in set(clinic.children)-before_counter:
    obj.location.x-=.65
    obj.location.y+=3.10
    if obj.name.startswith('monitor screen'): obj.location.y+=.182
# Bench, retail shelving and small touches.
before_bench=set(clinic.children)
for x in [-3.6,-2.85]:
    cube('bench foot',(x,2.10,.26),(.12,.60,.52),'wood',clinic)
cube('waiting bench',(-3.22,2.10,.60),(2.15,.73,.20),'oak',clinic)
cube('bench back',(-3.22,2.41,1.08),(2.15,.14,.88),'mint',clinic)
for x in [-3.84,-3.13,-2.44]: cube('cushion',(x,2.08,.77),(.62,.58,.16),'pink',clinic,.10)
for obj in set(clinic.children)-before_bench:
    obj.location.x+=.62
    obj.location.y-=4.75
    if obj.name.startswith('bench back'): obj.location.y-=.62
cube('shop back',(-4.83,-1.20,1.12),(.15,2.25,2.24),'oak',clinic)
for z in [.20,.92,1.64,2.3]: cube('shop shelf',(-4.42,-1.20,z),(.98,2.27,.12),'oak',clinic)
for y in [-1.98,-1.43,-.86,-.34]:
    cube('treat bag',(-4.39,y,1.23),(.34,.34,.49),'pink' if y < -1 else 'mint',clinic,.07)
    cyl('food tin',(-4.37,y,.44),.16,.33,'blue',clinic)
    ball('toy ball',(-4.40,y,1.9),(.17,.17,.17),'gold',clinic)
plant(-4.37,3.04,0,clinic); plant(4.35,3.1,0,clinic)
cube('round rug',(1.70,.40,.075),(2.50,2.00,.06),'mint',clinic,.35)
export('clinic',clinic)

for name,coat in [('louise','mint'),('visitor','pink')]:
    r=root(name)
    for x in [-.17,.17]:
        cube('shoe',(x,-.06,.12),(.26,.40,.20),'dark',r,.08)
        cube('leg',(x,0,.40),(.19,.24,.53),'blue',r,.07)
    ball('body',(0,0,.97),(.40,.25,.49),coat,r)
    if name=='louise':
        # Her long light-brown hair, pink headband and blue-grey eyes.
        ball('long hair back',(0,.15,1.44),(.32,.21,.53),'louise_hair',r)
        ball('head',(0,-.025,1.59),(.275,.25,.32),'louise_skin',r)
        ball('hair crown',(0,.055,1.79),(.30,.255,.20),'louise_hair',r)
        for x in [-.28,.28]: ball('long side hair',(x,.035,1.42),(.093,.145,.43),'louise_hair',r)
        line('pink headband',[(.303*math.cos(t),-.075,1.60+.355*math.sin(t)) for t in [i*math.pi/24 for i in range(25)]],.023,'louise_pink',r)
        for x in [-.095,.095]:
            ball('eye white',(x,-.263,1.61),(.049,.024,.053),'white',r)
            ball('blue grey iris',(x,-.286,1.61),(.028,.012,.035),'louise_eyes',r)
            ball('eye sparkle',(x-.009,-.298,1.623),(.009,.006,.011),'white',r)
            ball('eyebrow',(x,-.249,1.696),(.055,.015,.012),'louise_hair',r)
        ball('little nose',(0,-.282,1.54),(.029,.034,.030),'louise_skin',r)
        line('smile',[(-.055,-.255,1.467),(0,-.274,1.454),(.055,-.255,1.467)],.009,'pink',r)
        cube('pink top',(0,-.248,1.095),(.24,.025,.34),'louise_pink',r,.03)
        line('stethoscope',[(-.15,-.266,1.30),(-.17,-.286,1.08),(-.10,-.29,.99),(0,-.3,.97),(.10,-.29,.99),(.17,-.286,1.08),(.15,-.266,1.30)],.015,'dark',r)
        ball('stethoscope chestpiece',(.14,-.285,.93),(.045,.02,.045),'gold',r)
    else:
        ball('head',(0,0,1.57),(.27,.25,.31),'lightfur',r)
        ball('hair',(0,.035,1.76),(.29,.25,.20),'wood',r)
        for x in [-.09,.09]: ball('eye',(x,-.24,1.59),(.025,.018,.035),'black',r)
    for x in [-.42,.42]: ball('arm',(x,0,.96),(.12,.13,.34),coat,r)
    cube('badge',(.16,-.245,1.12),(.14,.025,.10),'white',r,.01)
    export(name,r)

table=root('table')
cube('table base',(0,0,.09),(1.15,.90,.18),'mint',table,.12)
cyl('table pedestal',(0,0,.57),.20,1.0,'white',table)
cube('exam table',(0,0,1.10),(2.45,2.60,.18),'white',table,.24)
cube('soft exam mat',(0,0,1.22),(2.13,2.29,.09),'mint',table,.20)
export('table',table)

# Leave the authored clinic visible when opening the source file.
for o in [clinic,*clinic.children_recursive]: o.hide_set(False)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'assets','blender','louises-vet-office.blend'))
print('Exported original clinic, six pets, two people and examination table.')
