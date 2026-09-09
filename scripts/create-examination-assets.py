"""Original anatomical teaching models and instruments for the 3D examination room."""
import bpy, math, os
from mathutils import Vector
ROOT=globals().get('PROJECT_ROOT') or os.environ.get('BLENDER_PROJECT_ROOT') or os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT=os.path.join(ROOT,'public','models','examination'); os.makedirs(OUT,exist_ok=True)
os.makedirs(os.path.join(ROOT,'assets','blender'),exist_ok=True)
old=bpy.data.scenes.get("Louise's examination studio")
if old:
    for obj in list(old.objects): bpy.data.objects.remove(obj,do_unlink=True)
    bpy.data.scenes.remove(old)
scene=bpy.data.scenes.new("Louise's examination studio"); bpy.context.window.scene=scene
mats={}
for name,color,metal,rough in [('bone',(.82,.91,.96),.05,.45),('ivory',(.96,.92,.78),0,.23),('gum',(.70,.22,.26),0,.43),('canal',(.78,.43,.40),0,.42),('inflamed',(.73,.055,.085),0,.34),('wax',(.66,.40,.07),0,.75),('tartar',(.64,.44,.10),0,.8),('cavity',(.09,.025,.012),0,.72),('silver',(.61,.70,.74),.85,.2),('mint',(.22,.56,.48),.2,.35),('white',(.88,.92,.89),.05,.32),('black',(.022,.035,.04),.15,.4),('glass',(.12,.24,.27),.5,.1),('amber',(.92,.50,.09),.1,.35),('rubber',(.055,.13,.15),0,.85)]:
    m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
    n=m.node_tree.nodes.get('Principled BSDF');n.inputs['Base Color'].default_value=(*color,1);n.inputs['Metallic'].default_value=metal;n.inputs['Roughness'].default_value=rough;mats[name]=m

def root(name):
    o=bpy.data.objects.new(name,None);scene.collection.objects.link(o);return o

def finish(o,name,mat,parent):
    o.name=name;o.data.materials.append(mats[mat]);o.parent=parent
    if o.type=='MESH':
        for p in o.data.polygons:p.use_smooth=True
    return o

def ball(name,p,s,mat,r):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12 if mat=='bone' else 24,ring_count=8 if mat=='bone' else 16,location=p);o=bpy.context.object;o.scale=s
    return finish(o,name,mat,r)

def box(name,p,s,mat,r,bevel=.025):
    bpy.ops.mesh.primitive_cube_add(size=1,location=p);o=bpy.context.object;o.scale=s
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel:
        b=o.modifiers.new('Machined rounded edge','BEVEL');b.width=bevel;b.segments=3
    return finish(o,name,mat,r)

def rod(name,a,b,radius,mat,parent):
    a,b=Vector(a),Vector(b);v=b-a
    bpy.ops.mesh.primitive_cylinder_add(vertices=16,radius=radius,depth=v.length,location=(a+b)/2)
    o=bpy.context.object;o.rotation_euler=v.to_track_quat('Z','Y').to_euler();return finish(o,name,mat,parent)

def curve(name,points,radius,mat,parent):
    c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.bevel_depth=radius;c.bevel_resolution=3
    s=c.splines.new('POLY');s.points.add(len(points)-1)
    for p,co in zip(s.points,points):p.co=(*co,1)
    o=bpy.data.objects.new(name,c);scene.collection.objects.link(o);o.parent=parent;c.materials.append(mats[mat]);return o

def ring(name,p,radius,tube,mat,parent):
    points=[(p[0]+radius*math.cos(i*math.tau/64),p[1],p[2]+radius*math.sin(i*math.tau/64)) for i in range(65)]
    return curve(name,points,tube,mat,parent)

def export(name,r):
    bpy.ops.object.select_all(action='DESELECT');r.select_set(True)
    for o in r.children_recursive:o.select_set(True)
    bpy.context.view_layer.objects.active=r
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,name+'.glb'),export_format='GLB',use_selection=True,export_animations=False,export_extras=True)
    for o in [r,*r.children_recursive]:o.hide_set(True)

def bone(name,a,b,radius,parent):
    rod(name,a,b,radius,'bone',parent)
    for p in [a,b]:ball(name+' epiphysis',p,(radius*1.35,)*3,'bone',parent)

def skeleton(species,broken=False):
    r=root('skeleton-'+species+('-fracture' if broken else ''))
    if species=='goldfish':
        for i in range(18):
            y=-.38+i*.058;ball('vertebra',(0,y,.66),(.035,.025,.04),'bone',r)
            if i<13:
                for side in [-1,1]:bone('fish rib',(0,y,.66),(side*.24,y+.10,.46),.012,r)
        ball('fish cranium',(0,-.39,.73),(.23,.20,.22),'bone',r)
        for i in range(9):bone('tail fin ray',(0,.63,.66),(0,.92,.39+i*.07),.009,r)
        for i in range(7):bone('dorsal fin ray',(0,-.04+i*.04,.76),(0,.02+i*.04,1.08),.008,r)
        export(r.name,r);return
    # Skeleton follows the body proportions and paws of the authored animal model.
    skull=ball('cranium',(0,-.55,1.015),(.29,.26,.27),'bone',r)
    for side in [-1,1]:
        # Anatomical eye sockets are actual openings in the cranium.
        cutter=ball('socket cutter',(side*.18,-.75,1.08),(.10,.14,.105),'bone',r)
        bpy.context.view_layer.objects.active=skull
        mod=skull.modifiers.new('Orbital cavity','BOOLEAN');mod.operation='DIFFERENCE';mod.object=cutter
        bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(cutter,do_unlink=True)
        curve('mandible',[(side*.20,-.47,.91),(side*.20,-.69,.79),(side*.12,-.89,.79),(0,-.91,.79)],.028,'bone',r)
        bone('maxilla',(side*.17,-.66,.93),(side*.09,-.88,.89),.045,r)
        for j in range(5):bone('tooth',(side*.13,-.68-j*.04,.88),(side*.13,-.68-j*.04,.84),.012,r)
    for i in range(22):
        y=-.30+i*.045;z=.89-.13*max(0,y-.35)
        ball('spinal vertebra', (0,y,z),(.055,.037,.048),'bone',r)
        bone('spinous process',(0,y,z),(0,y,z+.085),.012,r)
    for i in range(10):
        y=-.19+i*.062;w=.22+.055*math.sin(i/9*math.pi)
        for side in [-1,1]:
            curve('rib',[(side*w*math.sin(t),y+.025*math.sin(t),.87-.33*(1-math.cos(t))/2) for t in [k*math.pi/16 for k in range(17)]],.012,'bone',r)
    bone('sternum',(0,-.12,.54),(0,.32,.54),.024,r)
    for side in [-1,1]:
        bone('scapula',(side*.12,-.17,.91),(side*.25,-.20,.73),.055,r)
        bone('humerus',(side*.25,-.20,.73),(side*.29,-.16,.51),.028,r)
        a=(side*.29,-.16,.51);b=(side*.28,-.28,.28)
        if broken and side==1:
            # Separated and displaced jagged cortical ends, never a painted line.
            mid=Vector(a).lerp(Vector(b),.50)
            bone('fracture proximal',a,tuple(mid+Vector((0,0,.065))),.026,r)
            bone('fracture distal',tuple(mid+Vector((.09,-.025,-.065))),b,.026,r)
            for j in range(3):
                tip=mid+Vector((.014*(j-1),-.007*j,.04))
                bone('fracture shard',tuple(tip+Vector((0,0,.04))),tuple(tip),.009,r)
        else:bone('radius',a,b,.026,r)
        if broken and side==1:
            bone('fracture ulna proximal',(.32,-.14,.52),(.315,-.205,.465),.014,r)
            bone('fracture ulna distal',(.405,-.230,.335),(.31,-.27,.28),.014,r)
        else:bone('ulna',(side*.32,-.14,.52),(side*.31,-.27,.28),.014,r)
        bone('pelvis',(side*.09,.57,.82),(side*.29,.53,.70),.060,r)
        bone('femur',(side*.29,.53,.70),(side*.31,.39,.47),.037,r)
        bone('tibia',(side*.31,.39,.47),(side*.28,.64,.26),.026,r)
        bone('fibula',(side*.34,.40,.47),(side*.31,.65,.26),.012,r)
        for y in [-.28,.60]:
            ball('carpal joint',(side*.28,y,.25),(.054,.056,.03),'bone',r)
            for toe in range(4):
                x=side*.28+(toe-1.5)*.045
                bone('metacarpal',(x,y,.24),(x,y-.11,.17),.011,r)
                bone('phalange',(x,y-.11,.17),(x,y-.21,.16),.014,r)
    tail_length=.47 if species in ['cat','gerbil'] else .28 if species=='dog' else .08
    for i in range(12):
        y=.74+i*tail_length/12
        bone('tail vertebra',(0,y,.73+i*.012),(0,y+tail_length/12,.742+i*.012),.019*(1-i/15),r)
    export(r.name,r)

for species in ['dog','cat','rabbit','hamster','gerbil','goldfish']:skeleton(species)
for species in ['rabbit','dog','cat']:skeleton(species,True)

for infected in [False,True]:
    r=root('ear-'+('inflamed' if infected else 'healthy'))
    vertices=[];faces=[];rings=28;segments=64
    for j in range(rings):
        d=j/(rings-1);radius=(.65-.40*d)*(1+.035*math.sin(d*32))
        for k in range(segments):
            t=k*math.tau/segments;vertices.append((radius*math.cos(t)+.14*math.sin(d*2),d*1.25,radius*math.sin(t)-d*.10))
    for j in range(rings-1):
        for k in range(segments):
            a=j*segments+k;b=j*segments+(k+1)%segments;faces.append((a,b,b+segments,a+segments))
    mesh=bpy.data.meshes.new('ear canal wall');mesh.from_pydata(vertices,[],faces);mesh.update();o=bpy.data.objects.new('ear canal wall',mesh);scene.collection.objects.link(o);finish(o,'ear canal wall','inflamed' if infected else 'canal',r)
    for j in range(4):ring('canal fold',(0,j*.045,0),.65-j*.018,.035,'inflamed' if infected else 'canal',r)
    ball('tympanic membrane',(.13,1.27,-.10),(.24,.025,.24),'ivory',r)
    for i in range(13):
        theta=i*2.399
        pts=[]
        for j in range(12):
            d=.08+j*.07;rad=.65-.40*d;t=theta+.1*math.sin(j)
            pts.append((rad*math.cos(t)+.14*math.sin(d*2),d*1.25,rad*math.sin(t)-d*.10))
        curve('capillary',pts,.004,'gum',r)
    if infected:
        for i in range(9):
            t=i*2.399;d=.16+(i%3)*.13;rad=.59-.4*d
            ball('clinical wax',(rad*math.cos(t),d,rad*math.sin(t)),(.10,.065,.12),'wax',r)
        ball('clinical swelling',(.38,.30,.1),(.14,.28,.22),'inflamed',r)
    export(r.name,r)

for family in ['carnivore','rodent']:
    for condition in ['healthy','tartar','cavity']:
        r=root('mouth-'+family+'-'+condition)
        ball('oral cavity',(0,.44,0),(.65,.36,.49),'cavity',r)
        ball('tongue',(0,.13,-.22),(.32,.31,.085),'gum',r)
        for upper in [-1,1]:
            points=[(.51*math.cos(t),.45+.43*math.sin(t),upper*.26) for t in [math.pi+i*math.pi/32 for i in range(33)]]
            curve('gingiva',points,.082,'gum',r)
            for i in range(12):
                t=math.pi+(i+.5)*math.pi/12;x=.5*math.cos(t);y=.45+.41*math.sin(t)
                front=4<=i<=7;canine=family=='carnivore' and i in [3,8]
                h=.16 if canine else .12 if family=='rodent' and front else .078
                tooth=ball('tooth',(x,y-.025,upper*(.25-h/2)),(.065,.085,h),'ivory',r)
                if condition=='tartar' and i in [3,4,5,6,7,8]:
                    for j in range(4):ball('clinical tartar',(x+(j-1.5)*.024,y-.095,upper*.25),(.022,.015,.035),'tartar',r)
                if condition=='cavity' and upper==1 and i==5:
                    center=(x,y-.101,upper*(.25-h/2))
                    cutter=ball('cavity cutter',center,(.044,.05,.05),'cavity',r)
                    bpy.context.view_layer.objects.active=tooth
                    mod=tooth.modifiers.new('Caries crater','BOOLEAN');mod.operation='DIFFERENCE';mod.object=cutter
                    bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(cutter,do_unlink=True)
                    ball('clinical cavity dentine',(x,y-.075,upper*(.25-h/2)),(.035,.018,.041),'cavity',r)
                    ring('clinical cavity rim',(x,y-.10,upper*(.25-h/2)),.038,.006,'tartar',r)
        export(r.name,r)

# Every selectable tool is a complete three-dimensional model, including its grip.
for tool in ['inspect','xray','ear','mouth','listen','water-test','cream','drops','bandage','comb','vaccine','brush','water-care','forceps','thermometer','cooling']:
    r=root('tool-'+tool)
    if tool in ['inspect','mouth']:
        radius=.45 if tool=='inspect' else .30
        ring('optical metal rim',(0,0,0),radius,.035,'silver',r)
        ring('protective rim',(0,.018,0),radius+.035,.022,'mint',r)
        rod('neck',(.15,0,-radius*.8),(.34,0,-.68),.045,'silver',r)
        rod('grip',(.34,0,-.68),(.60,0,-1.06),.074,'mint',r)
    elif tool in ['xray','ear']:
        box('viewer chassis',(0,.055,0),(1.18,.14,.98),'mint',r,.08)
        for x in [-.54,.54]:box('screen vertical bezel',(x,-.035,0),(.10,.08,.89),'black',r)
        for z in [-.43,.43]:box('screen horizontal bezel',(0,-.035,z),(1.08,.08,.10),'black',r)
        if tool=='ear':
            rod('otoscope handle',(.57,.05,-.24),(.83,.05,-.93),.09,'silver',r)
            rod('otoscope cone',(.53,.05,.05),(.75,-.07,.05),.08,'black',r)
            ball('otoscope lamp',(.76,-.07,.05),(.025,)*3,'white',r)
        else:
            box('viewer handle',(.72,.04,-.22),(.20,.18,.57),'silver',r,.045)
            for i in range(3):ball('status lamp',(-.18+i*.12,-.035,-.435),(.022,)*3,'amber',r)
    elif tool=='thermometer':
        box('sensor body',(0,0,-.23),(.28,.16,.72),'white',r,.07)
        box('temperature display',(0,-.09,-.22),(.19,.025,.23),'glass',r,.02)
        rod('rounded sensor',(0,0,.12),(0,0,.32),.065,'silver',r)
        for i in range(3):box('display bar',(-.05+i*.05,-.11,-.22),(.025,.01,.12),'mint',r,0)
        ball('power button',(0,-.09,-.46),(.04,.02,.04),'mint',r)
    elif tool=='cooling':
        box('soft cooling pad',(0,0,-.2),(.58,.14,.82),'mint',r,.07)
        for z in [-.4,-.2,0]:box('pad quilt',(0,-.08,z),(.48,.018,.025),'white',r,.005)
    elif tool=='listen':
        ring('chestpiece',(0,0,0),.16,.025,'silver',r)
        ball('diaphragm',(0,0,0),(.16,.028,.16),'silver',r)
        curve('stethoscope tubing',[(0,0,-.1),(.08,.02,-.42),(.42,.04,-.56),(.62,.05,-.36),(.6,.06,.18)],.035,'rubber',r)
        for side in [-1,1]:
            curve('binaural',[(.6,.06,.18),(.6+side*.12,.06,.36),(.6+side*.20,.06,.51)],.025,'silver',r)
            ball('ear tip',(.6+side*.2,.06,.51),(.055,.04,.06),'rubber',r)
    elif tool in ['vaccine','drops','water-test','forceps']:
        if tool=='forceps':
            for side in [-1,1]:rod('forceps arm',(side*.02,0,.22),(side*.12,0,-.58),.027,'silver',r)
        else:
            rod('barrel',(0,0,-.45),(0,0,.10),.10,'white' if tool=='vaccine' else 'mint',r)
            rod('tip',(0,0,.10),(0,0,.31),.015 if tool=='vaccine' else .035,'silver',r)
            rod('plunger',(0,0,-.45),(0,0,-.68),.04,'silver',r)
            box('thumb pad',(0,0,-.70),(.27,.12,.045),'mint',r)
            for i in range(5):box('measurement mark',(.03,-.10,-.34+i*.08),(.065,.012,.012),'black',r,0)
    elif tool in ['comb','brush']:
        box('handle',(0,0,-.43),(.15,.12,.58),'mint',r)
        box('head',(0,0,-.02),(.58,.16,.27),'white',r,.07)
        for i in range(11):rod('tooth or bristle',(-.25+i*.05,0,.05),(-.25+i*.05,0,.27),.012,'silver' if tool=='comb' else 'rubber',r)
    elif tool=='bandage':
        ring('rolled gauze',(0,0,0),.20,.10,'white',r)
        box('loose gauze',(0,0,-.40),(.35,.025,.52),'white',r,.02)
    else:
        box('care bottle',(0,0,-.18),(.38,.25,.63),'white',r,.10)
        box('bottle label',(0,-.13,-.18),(.28,.018,.32),'mint',r,.02)
        rod('cap',(0,0,.12),(0,0,.27),.14,'mint',r)
    export(r.name,r)
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'assets','blender','examination.blend'),compress=True)
print('Exported complete skeletal anatomy, ear and mouth interiors, and 16 instruments.')
