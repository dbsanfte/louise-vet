"""Run in Blender via MCP. Original storybook models for Louise's Vet Office."""
import bpy
import math
import os
from mathutils import Vector

ROOT = globals().get('PROJECT_ROOT', os.environ.get('BLENDER_PROJECT_ROOT', 'C:/Users/david/OneDrive/Desktop/vet-game'))
OUT = os.path.join(ROOT, 'public', 'models')
os.makedirs(OUT, exist_ok=True)
os.makedirs(os.path.join(ROOT,'assets','blender'),exist_ok=True)
previous = bpy.data.scenes.get("Louise's asset studio")
if previous:
    for obj in list(previous.objects): bpy.data.objects.remove(obj, do_unlink=True)
    bpy.data.scenes.remove(previous)
scene = bpy.data.scenes.new("Louise's asset studio")
scene.render.fps = 24
scene.frame_end = 73
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
    'plum': (.46,.30,.56), 'visitor_skin': (.47,.25,.15),
    'visitor_hair': (.07,.045,.033),
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
        if hasattr(o.data,'use_auto_smooth'): o.data.use_auto_smooth=True
        o.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
    return finish(o,name,color,parent)

def ball(name, loc, scale, color, parent=None, detail=False):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32 if detail else 16, ring_count=20 if detail else 10, radius=1, location=loc)
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
    options=dict(filepath=os.path.join(OUT,name+'.glb'), export_format='GLB', use_selection=True, export_extras=True, export_cameras=False, export_lights=False, export_animations=True, export_frame_range=False)
    # Blender 3.4 groups NLA tracks by name; newer versions expose a mode selector.
    if 'export_animation_mode' in bpy.ops.export_scene.gltf.get_rna_type().properties:
        options['export_animation_mode']='NLA_TRACKS'
    else:
        options['export_nla_strips']=True
        options['export_force_sampling']=False
    bpy.ops.export_scene.gltf(**options)
    group.hide_set(True)
    for o in group.children_recursive: o.hide_set(True)

def pivot(name, position, objects, parent):
    """A transform rig joint, preserving each part's authored rest pose."""
    bpy.context.view_layer.update()
    joint=root(name); joint.parent=parent; joint.location=position
    bpy.context.view_layer.update()
    for obj in objects:
        world=obj.matrix_world.copy(); obj.parent=joint; obj.matrix_world=world
    return joint

def animate_part(obj, pose, extra_clips=()):
    """Looping Blender NLA clips, merged by track name on GLB export."""
    rest=(obj.location.copy(),obj.rotation_euler.copy(),obj.scale.copy())
    for clip,length in [('Idle',72),('Walk',24),('Sit',72),('Read',72),('Play',36),*extra_clips]:
        obj.animation_data_create()
        obj.animation_data.action=None
        for frame in range(1,length+2,3):
            obj.location=rest[0]; obj.rotation_euler=rest[1]; obj.scale=rest[2]
            pose(obj,clip,(frame-1)/length*math.tau)
            for path in ['location','rotation_euler','scale']:
                obj.keyframe_insert(data_path=path,frame=frame)
        action=obj.animation_data.action
        action.name=obj.name+' '+clip
        track=obj.animation_data.nla_tracks.new(); track.name=clip
        track.strips.new(clip,1,action)
        obj.animation_data.action=None
        track.mute=True
    obj.location=rest[0]; obj.rotation_euler=rest[1]; obj.scale=rest[2]

def animate_character(group, human=False, fish=False):
    parts=list(group.children)
    def named(obj,prefix): return obj.name.split('.')[0]==prefix
    body=next(obj for obj in parts if named(obj,'body'))
    def breathe(o,clip,t):
        o.scale.z*=1+(.012 if clip=='Idle' else .02)*math.sin(t)
    animate_part(body,breathe)
    if fish:
        for obj in parts:
            if named(obj,'tail') or named(obj,'fin'):
                def swish(o,clip,t): o.rotation_euler.z+=.30*math.sin(t*(2 if clip=='Walk' else 1))
                animate_part(obj,swish)
        return
    if human:
        head_parts=[o for o in parts if o.location.z>1.35]
        head=pivot('head_joint',(0,0,1.36),head_parts,group)
        def look(o,clip,t):
            o.rotation_euler.z+=(.10 if clip in ['Idle','Sit'] else .035)*math.sin(t)
            o.rotation_euler.x+=(.12 if clip=='Read' else .025*math.sin(t*2))
        animate_part(head,look)
        for side in [-1,1]:
            leg_parts=[o for o in parts if (named(o,'leg') or named(o,'shin') or named(o,'shoe')) and o.location.x*side>0]
            leg=pivot('leg_joint',(.17*side,0,.66),leg_parts,group)
            def step(o,clip,t,side=side):
                o.rotation_euler.x+=(-math.pi/2 if clip in ['Sit','Read','Play'] else .45*side*math.sin(t) if clip=='Walk' else .012*math.sin(t))
            animate_part(leg,step)
            knee=pivot('knee_joint',(.17*side,0,.38),[o for o in leg_parts if named(o,'shin') or named(o,'shoe')],group)
            matrix=knee.matrix_world.copy();knee.parent=leg;knee.matrix_world=matrix
            def bend(o,clip,t,side=side):
                if clip in ['Sit','Read','Play']:o.rotation_euler.x+=math.pi/2
                elif clip=='Walk':o.rotation_euler.x+=.70*max(0,-side*math.sin(t))
            animate_part(knee,bend)
            ankle=pivot('ankle_joint',(.17*side,0,.17),[o for o in leg_parts if named(o,'shoe')],group)
            matrix=ankle.matrix_world.copy();ankle.parent=knee;ankle.matrix_world=matrix
            def flex(o,clip,t,side=side):
                if clip=='Walk':o.rotation_euler.x+=-.22*max(0,-side*math.sin(t))+.10*side*math.cos(t)
            animate_part(ankle,flex)
            arms=[o for o in parts if any(named(o,n) for n in ['arm','forearm','hand','thumb','finger']) and o.location.x*side>0]
            arm=pivot('arm_joint',(.42*side,0,1.22),arms,group)
            def swing(o,clip,t,side=side):
                o.rotation_euler.x+=(-1.0+(.13*math.sin(t*2+side) if clip=='Play' else .035*math.sin(t)) if clip in ['Read','Play'] else -.35*side*math.sin(t) if clip=='Walk' else .04*math.sin(t))
                o.rotation_euler.y+=.025*side*math.sin(t)
            animate_part(arm,swing)
            forearm=pivot('elbow_joint',(.42*side,0,.97),[o for o in arms if not named(o,'arm')],group)
            matrix=forearm.matrix_world.copy();forearm.parent=arm;forearm.matrix_world=matrix
            def elbow(o,clip,t,side=side):
                o.rotation_euler.x+=(-.32 if clip in ['Read','Play'] else -.13)+(.07*math.sin(t+side) if clip=='Walk' else .025*math.sin(t))
            animate_part(forearm,elbow)
        # Shoulders counter-rotate to the stride; the head follows the same rig.
        torso=pivot('torso_joint',(0,0,0),[o for o in list(group.children) if not o.name.startswith('leg_joint') and not o.name.startswith('dress skirt')],group)
        def settle(o,clip,t):
            o.rotation_euler.z+=(.055 if clip=='Walk' else .025)*math.sin(t)
            o.rotation_euler.y+=(.018 if clip=='Walk' else .012)*math.sin(t)
            o.rotation_euler.x+=.045 if clip in ['Sit','Read','Play'] else .012*math.sin(t*2)
            hip=Vector((0,0,.76))
            o.location+=hip-o.rotation_euler.to_matrix() @ hip
        animate_part(torso,settle)
        for skirt in [o for o in group.children if o.name.startswith('dress skirt')]:
            def drape(o,clip,t):
                if clip in ['Sit','Read','Play']:
                    o.scale.z*=.55;o.scale.y*=1.5
                    o.location.y-=.15;o.location.z+=.10
                elif clip=='Walk':o.rotation_euler.y+=.025*math.sin(t)
            animate_part(skirt,drape)
        def bob(o,clip,t):
            if clip=='Walk':o.location.z+=.012*(1-math.cos(t*2))
        animate_part(group,bob)
    else:
        head_parts=[o for o in parts if any(named(o,n) for n in ['head','muzzle','nose','eye','eye_sparkle','ear','inner_ear','spot_ear'])]
        head=pivot('head_joint',(0,-.32,.81),head_parts,group)
        def look(o,clip,t):
            o.rotation_euler.z+=.075*math.sin(t) if clip=='Idle' else .035*math.sin(t)
            o.rotation_euler.x+=.03*math.sin(t*2)
        animate_part(head,look)
        for obj in parts:
            if named(obj,'paw'):
                phase=1 if obj.location.x*obj.location.y>0 else -1
                def pad(o,clip,t,phase=phase,front=obj.location.y<0):
                    if clip=='Play' and front:
                        o.location.z+=.15+.08*math.sin(t*2+phase)
                        o.location.y-=.12+.05*math.sin(t*2+phase)
                    if clip=='Walk':
                        o.location.y+=.16*phase*math.sin(t)
                        o.location.z+=.11*max(0,phase*math.sin(t))
                        o.rotation_euler.x+=.20*phase*math.sin(t)
                animate_part(obj,pad)
            if named(obj,'tail'):
                def wag(o,clip,t): o.rotation_euler.z+=(.22 if clip=='Idle' else .30)*math.sin(t*2)
                animate_part(obj,wag)
    # Eyelids blink together; their tiny scale change is also in the GLB clips.
    for obj in parts:
        if named(obj,'eye') or named(obj,'eye white') or named(obj,'blue grey iris') or named(obj,'eye sparkle') or named(obj,'iris') or named(obj,'pupil'):
            def blink(o,clip,t):
                if (human and clip in ['Idle','Sit','Read','Play']) or (not human and clip=='Idle'): o.scale.z*=1-(.92 if human else .88)*max(0,1-abs(t-4.71)/.30)
            animate_part(obj,blink)

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
    animate_character(r,fish=species=='goldfish')
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
cube('back wall',(-2.15,3.96,1.70),(6.2,.18,3.4),'cream',clinic)
cube('cutaway room partition',(1.825,3.96,.45),(1.75,.18,.9),'cream',clinic)
cube('room doorway end',(4.775,3.96,.45),(.95,.18,.9),'cream',clinic)
for x in [2.7,4.3]:cube('exam door frame',(x,3.96,1.3),(.16,.22,2.6),'mint',clinic)
cube('exam door lintel',(3.5,3.96,2.68),(1.76,.22,.2),'mint',clinic)
for y in [-2.475,2.475]:cube('left wall',(-5.14,y,.4),(.18,3.05,.8),'cream',clinic)
cube('connecting doorway lintel',(-5.14,0,2.98),(.18,1.9,.84),'cream',clinic)
for y in [-.99,.99]:cube('connecting doorpost',(-5.14,y,1.45),(.18,.16,2.9),'mint',clinic)
for x,w in [(-2.15,6.2),(1.825,1.75),(4.775,.95)]:cube('back dado',(x,3.83,.4),(w,.12,.8),'mint',clinic)
for y in [-2.475,2.475]:cube('left dado',(-5.01,y,.4),(.12,3.05,.8),'mint',clinic)
for x,w in [(-2.15,6.2),(1.825,1.75),(4.775,.95)]:cube('back trim',(x,3.70,.84),(w,.12,.09),'white',clinic)
for y in [-2.475,2.475]:cube('left trim',(-4.94,y,.82),(.12,3.05,.09),'white',clinic)
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
for obj in clinic.children:
    if any(obj.name.startswith(n) for n in ['shop back','shop shelf','treat bag','food tin','toy ball']):obj.location.y-=.65
export('clinic',clinic)

def sculpt_human_face(group):
    # Blend cheeks, chin and nose into one continuous, softly sculpted surface.
    pieces=[o for o in group.children if o.name.split('.')[0] in ['head','cheek','chin','nose','little nose','nose bridge']]
    bpy.ops.object.select_all(action='DESELECT')
    for o in pieces:o.select_set(True)
    bpy.context.view_layer.objects.active=next(o for o in pieces if o.name.split('.')[0]=='head')
    bpy.ops.object.join()
    head=bpy.context.object
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    remesh=head.modifiers.new('Continuous soft face','REMESH');remesh.mode='VOXEL';remesh.voxel_size=.016
    bpy.ops.object.modifier_apply(modifier=remesh.name)
    smooth=head.modifiers.new('Soft cheeks','SMOOTH');smooth.factor=1;smooth.iterations=5
    bpy.ops.object.modifier_apply(modifier=smooth.name)
    for poly in head.data.polygons:poly.use_smooth=True

def batch_human_details(group):
    buckets={}
    for o in list(group.children_recursive):
        if o.type not in ['MESH','CURVE'] or o.animation_data or o.children:continue
        if o.name.split('.')[0] in ['head','hand']:continue
        buckets.setdefault((o.parent,o.data.materials[0].name),[]).append(o)
    for (parent,mat), objects in buckets.items():
        bpy.ops.object.select_all(action='DESELECT')
        for o in objects:o.select_set(True)
        bpy.context.view_layer.objects.active=objects[0]
        bpy.ops.object.convert(target='MESH')
        bpy.ops.object.join()
        bpy.context.object.name='details_'+mat

for name,coat in [('louise','mint'),('visitor','pink'),('visitor-ponytail','blue'),('visitor-bob','plum')]:
    r=root(name)
    r['strideLength']=.85
    skin='louise_skin' if name=='louise' else 'visitor_skin' if name=='visitor-bob' else 'lightfur'
    hair='louise_hair' if name=='louise' else 'visitor_hair' if name=='visitor-bob' else 'wood'
    for x in [-.17,.17]:
        cube('shoe',(x,-.06,.12),(.26,.40,.20),'dark',r,.08)
        ball('leg',(x,0,.52),(.115,.125,.19),'blue',r)
        ball('shin',(x,0,.27),(.103,.115,.17),'blue',r)
    ball('body',(0,0,.97),(.36,.24,.43),coat,r,detail=True)
    ball('neck',(0,0,1.32),(.105,.10,.16),skin,r)
    for side in [-1,1]:
        collar=cube('collar',(side*.095,-.205,1.29),(.085,.035,.13),'white' if name=='louise' else coat,r,.018)
        collar.rotation_euler.y=side*.35
        ball('ear',(side*.27,-.008,1.56),(.067,.06,.096),skin,r,detail=True)
        ball('ear fold',(side*.294,-.052,1.56),(.025,.014,.050),skin,r)
        ball('cheek',(side*.14,-.175,1.49),(.105,.051,.075),skin,r,detail=True)
    ball('chin',(0,-.108,1.365),(.13,.10,.065),skin,r,detail=True)
    if name=='louise':
        # Her long light-brown hair, pink headband and blue-grey eyes.
        ball('long hair back',(0,.15,1.44),(.32,.21,.53),'louise_hair',r)
        ball('head',(0,-.025,1.59),(.275,.25,.32),'louise_skin',r,detail=True)
        ball('hair crown',(0,.055,1.79),(.30,.255,.20),'louise_hair',r)
        for x in [-.28,.28]: ball('long side hair',(x,.035,1.42),(.093,.145,.43),'louise_hair',r)
        line('pink headband',[(.303*math.cos(t),-.075,1.60+.355*math.sin(t)) for t in [i*math.pi/24 for i in range(25)]],.023,'louise_pink',r)
        for x in [-.095,.095]:
            ball('eye white',(x,-.263,1.61),(.049,.024,.053),'white',r)
            ball('blue grey iris',(x,-.286,1.61),(.028,.012,.035),'louise_eyes',r)
            ball('pupil',(x,-.298,1.61),(.015,.005,.024),'black',r)
            ball('eye sparkle',(x-.009,-.304,1.623),(.009,.004,.011),'white',r)
            ball('eyebrow',(x,-.249,1.696),(.055,.015,.012),'louise_hair',r)
        ball('little nose',(0,-.282,1.54),(.029,.034,.030),'louise_skin',r)
        line('smile',[(-.055,-.255,1.467),(0,-.274,1.454),(.055,-.255,1.467)],.009,'pink',r)
        cube('pink top',(0,-.248,1.095),(.24,.025,.34),'louise_pink',r,.03)
        line('stethoscope',[(-.15,-.266,1.30),(-.17,-.286,1.08),(-.10,-.29,.99),(0,-.3,.97),(.10,-.29,.99),(.17,-.286,1.08),(.15,-.266,1.30)],.015,'dark',r)
        ball('stethoscope chestpiece',(.14,-.285,.93),(.045,.02,.045),'gold',r)
    else:
        skin='visitor_skin' if name=='visitor-bob' else 'lightfur'
        hair='visitor_hair' if name=='visitor-bob' else 'wood'
        ball('head',(0,0,1.57),(.27,.25,.31),skin,r,detail=True)
        ball('hair',(0,.035,1.76),(.29,.25,.20),hair,r)
        if name=='visitor-ponytail':
            # The ponytail silhouette stays clear from the reception camera.
            ball('ponytail',(0,.35,1.48),(.17,.20,.37),hair,r)
            ball('hair tie',(0,.30,1.72),(.13,.10,.08),'gold',r)
            for x in [-.24,.24]: ball('side hair',(x,.04,1.60),(.065,.19,.22),hair,r)
            cube('cardigan front',(0,-.238,1.04),(.17,.035,.43),'white',r,.02)
        elif name=='visitor-bob':
            ball('bob back',(0,.15,1.55),(.31,.20,.35),hair,r)
            for x in [-.265,.265]: ball('bob side',(x,.005,1.55),(.075,.20,.30),hair,r)
            bpy.ops.mesh.primitive_cone_add(vertices=32,radius1=.43,radius2=.30,depth=.48,location=(0,0,.70))
            skirt=finish(bpy.context.object,'dress skirt',coat,r)
            skirt.scale.y=.73
            for face in skirt.data.polygons: face.use_smooth=True
            cube('dress belt',(0,-.245,.94),(.55,.04,.055),'gold',r,.015)
        for x in [-.095,.095]:
            ball('eye white',(x,-.235,1.60),(.051,.025,.054),'white',r,detail=True)
            ball('iris',(x,-.258,1.60),(.029,.013,.035),'louise_eyes' if name=='visitor-ponytail' else 'wood',r)
            ball('pupil',(x,-.269,1.60),(.016,.006,.025),'black',r)
            ball('eye sparkle',(x-.009,-.275,1.615),(.009,.004,.011),'white',r)
            line('eyebrow',[(x-.046,-.236,1.683),(x,-.253,1.697),(x+.046,-.236,1.687)],.012,hair,r)
            line('upper eyelid',[(x-.047,-.244,1.611),(x,-.257,1.649),(x+.047,-.244,1.611)],.009,skin,r)
        ball('nose bridge',(0,-.241,1.555),(.025,.031,.067),skin,r,detail=True)
        ball('nose',(0,-.25,1.51),(.032,.035,.035),skin,r)
        line('friendly smile',[(-.055,-.239,1.455),(0,-.255,1.44),(.055,-.239,1.455)],.008,'pink',r)
    for side in [-1,1]:
        x=side*.42
        ball('arm',(x,0,1.105),(.115,.125,.205),coat,r)
        ball('forearm',(x,-.006,.87),(.087,.095,.165),coat if name=='louise' else skin,r)
        ball('hand',(x,-.022,.705),(.084,.07,.098),skin,r,detail=True)
        ball('thumb',(x-side*.072,-.056,.724),(.035,.037,.055),skin,r)
        for finger in range(3):
            ball('finger',(x+(finger-1)*.034,-.032,.646),(.021,.045,.04),skin,r)
    # Gentle hair locks and clothing seams give silhouettes definition at town scale.
    for side in [-1,1]:
        ball('swept hair lock',(side*.12,-.09,1.805),(.14,.15,.10),hair,r)
    for z in [.87,1.00,1.13]:ball('coat button',(.035,-.243,z),(.017,.012,.017),'gold',r)
    if name=='louise':
        for x in [-.22,.22]:cube('coat pocket',(x,-.226,.89),(.13,.035,.12),'mint',r,.018)
    if name=='louise': cube('badge',(.16,-.245,1.12),(.14,.025,.10),'white',r,.01)
    sculpt_human_face(r)
    animate_character(r,human=True)
    batch_human_details(r)
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
print('Exported original clinic, six pets, Louise, three customer models and examination table.')
