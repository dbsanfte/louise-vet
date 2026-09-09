"""Original small-town traffic, authored separately from Hookville's scenery."""
import os, math, bpy
ROOT = globals().get('PROJECT_ROOT') or os.environ.get('BLENDER_PROJECT_ROOT') or os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROJECT_ROOT = ROOT
with open(os.path.join(ROOT, 'scripts/create-blender-assets.py')) as f:
    helpers = f.read().split("for species in ['dog','cat','rabbit','hamster','gerbil','goldfish']:")[0]
exec(helpers.replace("Louise's asset studio", "Hookville vehicle studio"))
OUT = os.path.join(ROOT, 'public/models/town')
os.makedirs(OUT, exist_ok=True)
for name, colour in {'coral paint':(.83,.23,.19), 'blue paint':(.17,.40,.69), 'mint paint':(.22,.63,.48), 'plum paint':(.52,.29,.59), 'glass':(.12,.27,.34), 'tail lamp':(.75,.035,.04)}.items():
    material(name, colour)
materials['glass'].node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value = .28

def batch(group):
    # Retain the wheel pivots; merge only parts sharing a material and parent.
    groups = {}
    for o in list(group.children_recursive):
        if o.type in ['MESH','CURVE'] and not o.children:
            groups.setdefault((o.parent, o.data.materials[0]), []).append(o)
    for (_, _), parts in groups.items():
        bpy.ops.object.select_all(action='DESELECT')
        for o in parts: o.select_set(True)
        bpy.context.view_layer.objects.active = parts[0]
        bpy.ops.object.convert(target='MESH')
        bpy.ops.object.join()

def cabin(r, paint, front, rear, roof, width=1.08):
    bottom=.73
    vertices=[(-width/2,front,bottom),(width/2,front,bottom),(width/2,rear,bottom),(-width/2,rear,bottom),(-width*.44,front+.19,roof),(width*.44,front+.19,roof),(width*.44,rear-.09,roof),(-width*.44,rear-.09,roof)]
    mesh=bpy.data.meshes.new('shaped cabin glazing')
    mesh.from_pydata(vertices,[],[(0,3,2,1),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7),(4,5,6,7)])
    obj=bpy.data.objects.new('cabin glazing',mesh);scene.collection.objects.link(obj);finish(obj,'cabin glazing','glass',r)
    cube('painted roof',(0,(front+rear+.10)/2,roof+.035),(width*.91,rear-front-.19,.09),paint,r,.05)
    for i in range(4): line('window pillar',[vertices[i],vertices[i+4]],.027,paint,r)
    for side in [-1,1]:
        line('window divider',[(side*width/2,(front+rear)/2,bottom),(side*width*.44,(front+rear)/2,roof)],.025,paint,r)
        cube('door handle',(side*.585,(front+rear)/2+.1,.69),(.027,.15,.035),'cream',r,.01)
        cube('wing mirror',(side*.63,front+.18,.89),(.15,.15,.09),paint,r,.03)

for kind, paint, length in [('compact','coral paint',2.1),('estate','blue paint',2.45),('pickup','mint paint',2.4),('van','plum paint',2.4)]:
    r=root('car-'+kind);r['vehicleKind']=kind
    cube('lower body',(0,0,.53),(1.16,length,.49),paint,r,.12)
    cube('underbody',(0,0,.31),(1.02,length-.18,.16),'dark',r,.05)
    if kind=='compact':
        cabin(r,paint,-.60,.78,1.18)
        cube('bonnet',(0,-.84,.74),(1.02,.40,.08),paint,r,.045)
    elif kind=='estate':
        cabin(r,paint,-.79,.97,1.22)
        for x in [-.36,.36]:cube('roof rail',(x,.20,1.34),(.045,1.18,.045),'dark',r,.02)
        cube('bonnet',(0,-1.0,.74),(1.05,.37,.08),paint,r,.04)
    elif kind=='pickup':
        cabin(r,paint,-.93,.02,1.27)
        cube('open cargo bed',(0,.66,.75),(.94,.94,.08),'dark',r,.025)
        for x in [-.54,.54]:cube('bed side',(x,.68,.89),(.09,1.02,.31),paint,r,.025)
        cube('tailgate',(0,1.15,.89),(1.10,.10,.31),paint,r,.025)
        cube('tailgate handle',(0,1.209,.96),(.24,.023,.035),'cream',r,.008)
    else:
        cabin(r,paint,-1.01,-.08,1.39)
        cube('tall delivery body',(0,.55,1.11),(1.14,1.25,.98),paint,r,.09)
        cube('cream cargo roof',(0,.55,1.62),(1.11,1.19,.09),'cream',r,.045)
        for x in [-.577,.577]:
            cube('delivery panel',(x,.52,1.17),(.025,.75,.37),'cream',r,.035)
            # A friendly parcel mark, intentionally not a commercial logo.
            cube('parcel',(x*1.03,.52,1.17),(.018,.24,.22),'gold',r,.025)
        cube('rear door seam',(0,1.184,1.1),(.025,.019,.82),'dark',r,.004)
        for x in [-.13,.13]:cube('rear door handle',(x,1.20,1.02),(.045,.03,.14),'cream',r,.01)
    for front in [-1,1]:
        y=front*(length/2+.015)
        cube('bumper',(0,y,.40),(1.08,.075,.12),'cream',r,.04)
        cube('number plate',(0,y+front*.046,.48),(.30,.018,.10),'white',r,.01)
        for x in [-.40,.40]:cube('headlight' if front<0 else 'tail light',(x,y,.65),(.23,.045,.16),'white' if front<0 else 'tail lamp',r,.04)
    cube('front grille',(0,-length/2-.026,.61),(.40,.02,.09),'dark',r,.02)
    for side in [-1,1]:
        for front in [-1,1]:
            wheel=root('Wheel_'+('front' if front<0 else 'rear')+('_left' if side<0 else '_right'))
            wheel.parent=r;wheel.location=(side*.59,front*(length/2-.39),.27);wheel['wheelRadius']=.26
            cyl('rubber tyre',(0,0,0),.26,.16,'black',wheel).rotation_euler.y=math.pi/2
            cyl('wheel rim',(side*.085,0,0),.16,.022,'cream',wheel).rotation_euler.y=math.pi/2
            cyl('hub',(side*.103,0,0),.058,.025,'dark',wheel).rotation_euler.y=math.pi/2
            for angle in [0,math.pi/2]:
                spoke=cube('rim spoke',(side*.10,0,0),(.025,.26,.034),'gray',wheel,.009);spoke.rotation_euler.x=angle
    batch(r);export('car-'+kind,r)
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'assets/blender/hookville-vehicles.blend'),compress=True)
print('Exported four original traffic vehicles with independent wheel pivots.')
