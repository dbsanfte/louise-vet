"""Original Hookville park, pet activities and pond ducks, sharing the navigation plan."""
import os,json,math
ROOT=globals().get('PROJECT_ROOT') or os.environ.get('BLENDER_PROJECT_ROOT') or os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROJECT_ROOT=ROOT
with open(os.path.join(ROOT,'scripts/create-town-assets.py')) as f:
    exec(f.read().split("r=root('neighbourhood')")[0].replace('Hookville studio','Hookville park studio'))
plan=json.load(open(os.path.join(ROOT,'src/park-layout.json')))
for name,col in {'water':(.22,.63,.72),'stone':(.59,.61,.51),'sand':(.77,.65,.41),'orange':(.96,.52,.13),'duck-green':(.12,.38,.25),'duck-brown':(.49,.31,.18),'flower':(.88,.43,.61)}.items():
    m=bpy.data.materials.new(name);m.diffuse_color=(*col,1);m.use_nodes=True;m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(*col,1);m.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.65;mats[name]=m

def sphere(r,name,x,z,y,scale,mat):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=10,location=(x,-z,y));o=bpy.context.object;o.name=name;o.scale=scale;o.parent=r;o.data.materials.append(mats[mat])
    for p in o.data.polygons:p.use_smooth=True
    return o

def pole(r,name,x,z,y,rad,depth,mat):
    bpy.ops.mesh.primitive_cylinder_add(vertices=16,radius=rad,depth=depth,location=(x,-z,y));o=bpy.context.object;o.name=name;o.parent=r;o.data.materials.append(mats[mat]);return o

def beam(r,name,a,b,rad,mat):
    from mathutils import Vector
    a,b=Vector((a[0],-a[1],a[2])),Vector((b[0],-b[1],b[2]));v=b-a
    bpy.ops.mesh.primitive_cylinder_add(vertices=12,radius=rad,depth=v.length,location=(a+b)/2);o=bpy.context.object;o.name=name;o.rotation_euler=v.to_track_quat('Z','Y').to_euler();o.parent=r;o.data.materials.append(mats[mat]);return o

r=root('park')
# Continuous walking lanes, with short spurs to each bench and activity.
ribbon(r,'park spine',[[22,-6],[22,-14]],.75,.125,'path')
ribbon(r,'left park walk',[[22,-6],[17.45,-6],[17.45,-14],[22,-14]],.65,.125,'path')
ribbon(r,'park entry',[[22,-3],[22,-6]],.8,.126,'path')
for bench in plan['benches']:
    x,z,a=bench['x'],bench['z'],bench['facing'];fx=x+math.sin(a)*.85;fz=z+math.cos(a)*.85
    ribbon(r,'bench approach',[[17.45 if fx<18 else 22,max(-14,min(-6,fz))],[fx,fz]],.65,.125,'path')
    # Separate slats and metal supports, with two reserved sitting places.
    for dx in [-.65,.65]:
        px=x+math.cos(a)*dx;pz=z-math.sin(a)*dx
        pole(r,'bench foot',px,pz,.37,.045,.55,'rubber')
    for dz in [-.18,0,.18]:
        o=box(r,'bench seat',(x+math.sin(a)*dz,-z-math.cos(a)*dz,.68),(1.8,.14,.09),'wood');o.rotation_euler.z=-a
    for y in [.93,1.12]:
        o=box(r,'bench back',(x-math.sin(a)*.25,-z+math.cos(a)*.25,y),(1.8,.09,.14),'mint');o.rotation_euler.z=-a
pond=plan['pond'];x,z=pond['x'],pond['z']
sphere(r,'curved pond bank',x,z,.06,(1.47,1.47,.09),'sand')
pole(r,'pond water',x,z,.15,pond['radius'],.055,'water')
for j in range(22):
    a=j*math.tau/22;sphere(r,'pond stones',x+math.cos(a)*1.36,z+math.sin(a)*1.36,.2,(.16,.12,.12),'stone')
for j in range(5):
    a=j*1.3;px=x+math.cos(a)*1.48;pz=z+math.sin(a)*1.48
    for k in range(3):beam(r,'reeds',(px+k*.07,pz,.15),(px+k*.07+.09,pz,.7+k*.1),.013,'leaf')
# A low bubbler leaves the ducks a broad, quiet swimming ring.
pole(r,'fountain base',x,z,.22,.2,.15,'stone')
for j in range(4):
    a=j*math.tau/4
    pts=[(x+math.cos(a)*(.5*t),z+math.sin(a)*(.5*t),.25+1.2*t*(1-t)) for t in [k/12 for k in range(13)]]
    for p,q in zip(pts,pts[1:]):beam(r,'bubbling water',p,q,.018,'water')
for s in plan['stations']:
    x,z=s['x'],s['z'];kind=s['id'];pole(r,'activity lawn',x,z,.11,1.03,.035,'grass')
    ribbon(r,'activity path',[[22,max(-14,min(-6,z))],[x,z]],.45,.124,'path')
    if kind=='fetch':
        for xx in [x-1,x+1]:pole(r,'fetch marker',xx,z,.21,.075,.18,'orange')
        sphere(r,'spare tennis ball',x,z+.58,.21,(.11,.11,.11),'cream')
    elif kind=='agility':
        for zz in [z-.3,z+.3]:
            beam(r,'hoop support',(x,zz,.15),(x,zz,.85),.04,'mint')
        for j in range(24):
            a=j*math.tau/24;b=(j+1)*math.tau/24
            beam(r,'agility hoop',(x,z+math.cos(a)*.37,.61+math.sin(a)*.37),(x,z+math.cos(b)*.37,.61+math.sin(b)*.37),.035,'orange')
    elif kind=='scratch':
        pole(r,'scratch log',x,z+.32,.56,.16,.85,'wood')
        for y in [.3,.42,.54,.66,.78]:pole(r,'rope wrap',x,z+.32,y,.177,.035,'cream')
        box(r,'cat lookout',(x,-z-.32,1),(1,.65,.1),'wood')
    elif kind=='tunnel':
        # Open hoop tunnel and low visible enclosure for supervised small pets.
        for xx in [x-.65,x,x+.65]:
            for j in range(12):
                a=j*math.pi/12;b=(j+1)*math.pi/12
                beam(r,'tunnel arch',(xx,z+math.cos(a)*.28,.17+math.sin(a)*.9),(xx,z+math.cos(b)*.28,.17+math.sin(b)*.9),.025,'mint')
        for zz in [z-.6,z+.6]:beam(r,'run railing',(x-1,zz,.33),(x+1,zz,.33),.025,'white')
    elif kind=='perch':
        pole(r,'bird perch trunk',x,z,.45,.045,.7,'wood')
        beam(r,'bird swing bar',(x-.4,z,.82),(x+.4,z,.82),.035,'wood')
        for dx in [-.32,.32]:sphere(r,'perch toy',x+dx,z,.69,(.075,.075,.075),'orange')
    else:
        for j in range(7):
            a=j*math.tau/7;px=x+math.cos(a)*.7;pz=z+math.sin(a)*.7
            pole(r,'flower stem',px,pz,.25,.018,.25,'leaf');sphere(r,'flower',px,pz,.39,(.09,.09,.04),'flower')
for x,z in [(17,-16)]:tree(r,x,-z)
# Welcome arch stays outside the entry lane.
for x in [21.3,22.7]:pole(r,'welcome post',x,-4,.75,.055,1.4,'wood')
box(r,'park sign',(22,4,1.55),(1.6,.1,.38),'mint')
export(r)
# Original duck silhouette, with separately named wings/head for live bobbing.
r=root('duck')
sphere(r,'duck body',0,0,.22,(.23,.36,.20),'duck-brown')
sphere(r,'duck neck',0,-.23,.4,(.11,.11,.22),'duck-green')
sphere(r,'duck head',0,-.29,.55,(.15,.16,.15),'duck-green')
sphere(r,'duck bill',0,-.455,.52,(.115,.15,.045),'orange')
for s in [-1,1]:
    sphere(r,'duck eye',s*.11,-.4,.59,(.027,.027,.027),'rubber')
    sphere(r,'duck wing',s*.19,.025,.29,(.065,.26,.115),'cream')
sphere(r,'duck tail',0,.34,.29,(.12,.19,.07),'duck-brown')
# Export duck parts intact so wings can flutter independently.
bpy.ops.object.select_all(action='DESELECT');r.select_set(True)
for o in r.children_recursive:o.select_set(True)
bpy.context.view_layer.objects.active=r
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,'duck.glb'),export_format='GLB',use_selection=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'assets/blender/hookville-park.blend'),compress=True)
print('Exported original park and pond duck.')
