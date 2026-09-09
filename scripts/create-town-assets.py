"""Original low-poly Hookville exteriors. Blender Z-up; exports become game Y-up."""
import bpy, math, os, json
ROOT = globals().get('PROJECT_ROOT') or os.environ.get('BLENDER_PROJECT_ROOT') or os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'public', 'models', 'town')
os.makedirs(OUT, exist_ok=True)
os.makedirs(os.path.join(ROOT, 'assets', 'blender'), exist_ok=True)
old = bpy.data.scenes.get('Hookville studio')
if old:
    for obj in list(old.objects): bpy.data.objects.remove(obj, do_unlink=True)
    bpy.data.scenes.remove(old)
scene = bpy.data.scenes.new('Hookville studio'); bpy.context.window.scene = scene
layout=json.load(open(os.path.join(ROOT,'src','town-layout.json')))
mats = {}
for name, color in {'grass':(.43,.62,.34), 'road':(.29,.35,.38), 'path':(.78,.74,.62), 'cream':(.94,.84,.65), 'roof':(.55,.26,.22), 'mint':(.31,.62,.53), 'window':(.29,.56,.65), 'wood':(.46,.29,.17), 'white':(.97,.93,.82), 'rubber':(.08,.11,.12), 'car':(.87,.55,.25), 'leaf':(.27,.48,.23)}.items():
    m=bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True
    n=m.node_tree.nodes.get('Principled BSDF'); n.inputs['Base Color'].default_value=(*color,1); n.inputs['Roughness'].default_value=.85
    mats[name]=m

def root(name):
    o=bpy.data.objects.new(name,None);scene.collection.objects.link(o);return o

def box(r,name,p,s,mat):
    bpy.ops.mesh.primitive_cube_add(size=1,location=p);o=bpy.context.object;o.name=name;o.scale=s;o.parent=r;o.data.materials.append(mats[mat]);return o

def tree(r,x,y):
    box(r,'trunk',(x,y,.8),(.22,.22,1.6),'wood')
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1,location=(x,y,2))
    o=bpy.context.object;o.scale=(1,1,1.3);o.parent=r;o.data.materials.append(mats['leaf'])

def export(r):
    # Join each material to keep the static town inexpensive to draw.
    for mat in mats.values():
        parts=[o for o in r.children if o.type=='MESH' and o.data.materials[0]==mat]
        if not parts:continue
        bpy.ops.object.select_all(action='DESELECT')
        for o in parts:o.select_set(True)
        bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join()
    bpy.ops.object.select_all(action='DESELECT');r.select_set(True)
    for o in r.children_recursive:o.select_set(True)
    bpy.context.view_layer.objects.active=r
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,r.name+'.glb'),export_format='GLB',use_selection=True,export_animations=False)
    for o in [r,*r.children_recursive]:o.hide_set(True)

def ribbon(r,name,points,width,height,mat):
    # Shared cross-sections meet at the true offset-line intersection. Separate
    # rectangles leave triangular holes on the outside of every bend.
    closed = len(points)>2 and points[0]==points[-1]
    points = points[:-1] if closed else points
    verts=[]
    def tangent(a,b):
        dx,dz=b[0]-a[0],b[1]-a[1]
        length=math.hypot(dx,dz)
        return (dx/length,dz/length)
    for i,p in enumerate(points):
        prev=points[(i-1)%len(points)] if closed or i>0 else None
        nxt=points[(i+1)%len(points)] if closed or i<len(points)-1 else None
        incoming=tangent(prev,p) if prev is not None else tangent(p,nxt)
        outgoing=tangent(p,nxt) if nxt is not None else incoming
        nx,nz=-incoming[1]-outgoing[1],incoming[0]+outgoing[0]
        length=math.hypot(nx,nz)
        if length<1e-6:
            nx,nz=-outgoing[1],outgoing[0]
        else:
            nx,nz=nx/length,nz/length
        projection=nx*(-outgoing[1])+nz*outgoing[0]
        reach=min(width/2/max(projection,.001),width*2)
        for sign in [-1,1]:
            verts.append((p[0]+nx*reach*sign,-p[1]-nz*reach*sign,height))
    count=len(points) if closed else len(points)-1
    faces=[(2*i,2*i+1,2*((i+1)%len(points))+1,2*((i+1)%len(points))) for i in range(count)]
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
    o=bpy.data.objects.new(name,mesh);scene.collection.objects.link(o);o.parent=r;o.data.materials.append(mats[mat])

def pavements(r):
    crossings={tuple(sorted(e)) for e in layout['crossings']}
    edges={tuple(sorted(e)) for e in layout['edges']} - crossings
    neighbours={}
    for a,b in sorted(edges):
        neighbours.setdefault(a,[]).append(b)
        neighbours.setdefault(b,[]).append(a)
    # Very tight turns need a round join, not a long offset-line spike.
    breaks={i for i,adj in neighbours.items() if len(adj)!=2}
    for i,adj in neighbours.items():
        if len(adj)!=2:continue
        p=layout['nodes'][i]
        vectors=[(layout['nodes'][n]['x']-p['x'],layout['nodes'][n]['z']-p['z']) for n in adj]
        dot=sum(a*b for a,b in zip(*vectors))/(math.hypot(*vectors[0])*math.hypot(*vectors[1]))
        if dot>.3:breaks.add(i)
    used=set()
    def walk(a,b):
        ids=[a,b];used.add(tuple(sorted((a,b))))
        while b not in breaks:
            nxt=next(n for n in neighbours[b] if n!=a)
            edge=tuple(sorted((b,nxt)))
            if edge in used:break
            used.add(edge);ids.append(nxt);a,b=b,nxt
        points=[[layout['nodes'][i]['x'],layout['nodes'][i]['z']] for i in ids]
        ribbon(r,'continuous pavement',points,1.7,.105,'path')
    for a in sorted(neighbours):
        if a in breaks:
            for b in neighbours[a]:
                if tuple(sorted((a,b))) not in used:walk(a,b)
    # All-degree-two components are closed loops, including the inner kerbs.
    for a,b in sorted(edges-used):
        if (a,b) not in used:walk(a,b)
    # Round caps seal the seams where three paths meet or a path ends.
    for i,adjacent in neighbours.items():
        if i not in breaks:continue
        p=layout['nodes'][i];verts=[(p['x'], -p['z'], .105)]
        for j in range(24):
            angle=j*math.tau/24
            verts.append((p['x']+math.cos(angle)*.85,-p['z']+math.sin(angle)*.85,.105))
        mesh=bpy.data.meshes.new('pavement junction')
        mesh.from_pydata(verts,[],[(0,j+1,(j+1)%24+1) for j in range(24)]);mesh.update()
        o=bpy.data.objects.new('pavement junction',mesh);scene.collection.objects.link(o);o.parent=r;o.data.materials.append(mats['path'])

def segment(r,name,a,b,width,height,mat):ribbon(r,name,[a,b],width,height,mat)

def local(lot,x,z):
    angle=lot['facing'];return [lot['x']+math.cos(angle)*x+math.sin(angle)*z,lot['z']-math.sin(angle)*x+math.cos(angle)*z]

r=root('neighbourhood')
box(r,'village green',(0,0,-.12),(94,88,.2),'grass')
pavements(r)
for road in layout['roads']:
    ribbon(r,road['name'],road['points'],4,.07,'road')
    for i,(a,b) in enumerate(zip(road['points'],road['points'][1:])):
        if i%2==0:
            mid=[(a[k]+b[k])/2 for k in range(2)]
            segment(r,'centre dash',a,mid,.09,.081,'white')
def road_distance(p):
    distances=[]
    for road in layout['roads']:
        for a,b in zip(road['points'],road['points'][1:]):
            dx,dz=b[0]-a[0],b[1]-a[1];t=max(0,min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dz)/(dx*dx+dz*dz)))
            distances.append(math.hypot(p[0]-a[0]-dx*t,p[1]-a[1]-dz*t))
    return min(distances)
for a,b in layout['crossings']:
    pa,pb=layout['nodes'][a],layout['nodes'][b];dx,dz=pb['x']-pa['x'],pb['z']-pa['z'];length=math.hypot(dx,dz)
    if length<.1:continue
    for j in range(int(length/.6)):
        t=(j+.5)*.6/length;p=[pa['x']+dx*t,pa['z']+dz*t]
        if road_distance(p)<1.85:
            segment(r,'zebra crossing',[p[0]-dz/length*.65,p[1]+dx/length*.65],[p[0]+dz/length*.65,p[1]-dx/length*.65],.26,.09,'white')
for lot in layout['lots']:
    # Each home has a garden, driveway to its actual pavement node, and fence.
    for a,b in [((-3.4,-3.3),(-3.4,3.3)),((3.4,-3.3),(3.4,3.3)),((-3.4,-3.3),(3.4,-3.3))]:
        pa,pb=local(lot,*a),local(lot,*b)
        o=box(r,'garden fence',((pa[0]+pb[0])/2,-(pa[1]+pb[1])/2,.5),(.12,math.dist(pa,pb),.9),'white')
        o.rotation_euler.z=math.atan2(pb[0]-pa[0],pb[1]-pa[1])
    gate=layout['nodes'][lot['gate']]
    segment(r,'garden path',local(lot,0,1.7),[gate['x'],gate['z']],.8,.12,'path')
    tx,tz=local(lot,-2.7,0);tree(r,tx,-tz)
# Park at the established crossing, plus planted greens between the curving streets.
for x,z in [(-25,10),(-40,-18),(-4,-18),(12,-17),(-20,18),(3,18),(22,12),(-41,-5),(40,17)]:tree(r,x,-z)
export(r)

# Sixteen authored silhouettes: different proportions, roof forms, porches,
# dormers, chimneys, bays and balconies, as well as individual colour schemes.
palette=[(.76,.55,.38),(.43,.63,.69),(.75,.68,.40),(.63,.52,.67),(.78,.52,.53),(.48,.66,.55),(.87,.73,.54),(.48,.57,.71),(.78,.60,.42),(.60,.73,.67),(.74,.55,.62),(.69,.73,.46),(.51,.69,.73),(.83,.66,.63),(.66,.61,.76),(.65,.72,.60)]
for lot in layout['lots']:
    i=lot['id'];r=root(lot['asset']);mat='facade-'+str(i)
    m=bpy.data.materials.new(mat);m.diffuse_color=(*palette[i],1);m.use_nodes=True;m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(*palette[i],1);mats[mat]=m
    height=4.1+(i%3)*.3 if lot['kind']=='Flat' else 2.1+(i%4)*.25
    width=3.7+(i%3)*.3;depth=2.9+(i%2)*.3
    box(r,'individual walls',(0,0,height/2),(width,depth,height),mat)
    if i%4==2:
        box(r,'flat parapet roof',(0,0,height+.13),(width+.35,depth+.35,.25),'roof')
        for x in [-width/2,width/2]:box(r,'parapet coping',(x,0,height+.36),(.16,depth+.4,.22),'white')
    else:
        for side in [-1,1]:
            panel=box(r,'pitched roof',(0,side*(depth/4+.05),height+.42),(width+.5,depth/2+.45,.17),'roof' if i%2==0 else 'wood');panel.rotation_euler.x=-side*(.48+i%3*.08)
    box(r,'front door',(-.3 if i%2 else .3,-depth/2-.04,.76),(.75,.09,1.5),'wood')
    for x in [-width*.32,width*.32]:
        for z in ([1.1,2.7] if lot['kind']=='Flat' else [1.1]):
            box(r,'window frame',(x,-depth/2-.07,z),(.92,.12,.85),'white')
            box(r,'window pane',(x,-depth/2-.15,z),(.74,.04,.66),'window')
            if i%3==0:
                for dx in [-.57,.57]:box(r,'shutter',(x+dx,-depth/2-.10,z),(.19,.08,.85),'mint')
    if i%4==0:
        box(r,'porch canopy',(0,-depth/2-.65,1.95),(2.7,1.35,.14),'roof')
        for x in [-1.15,1.15]:box(r,'porch post',(x,-depth/2-1.1,.94),(.12,.12,1.88),'white')
    elif i%4==1:
        box(r,'projecting bay',(width/2-.35,-.25,1),(1.1,1.7,2),mat)
        box(r,'bay glass',(width/2+.22,-.25,1.25),(.05,1.3,.8),'window')
        box(r,'bay cap',(width/2-.3,-.25,2.08),(1.25,1.9,.15),'roof')
    elif i%4==2:
        box(r,'entrance awning',(0,-depth/2-.45,1.93),(1.6,.9,.12),'mint')
        box(r,'side chimney',(-width/2+.2,.55,height+.5),(.55,.65,1.25),'wood')
    else:
        box(r,'dormer',(-.9,-.3,height+.4),(1.1,1.1,.9),mat)
        box(r,'dormer window',(-.9,-.88,height+.45),(.65,.05,.6),'window')
        box(r,'dormer cap',(-.9,-.3,height+.92),(1.3,1.3,.15),'roof')
    if lot['kind']=='Flat':
        box(r,'balcony deck',(.7,-depth/2-.4,2.05),(2,.9,.13),'cream')
        for x in [0,.4,.8,1.2,1.6]:box(r,'balcony baluster',(x,-depth/2-.84,2.43),(.065,.06,.75),'white')
        box(r,'balcony rail',(.8,-depth/2-.84,2.8),(1.8,.09,.1),'white')
    if i==12:
        box(r,'sun room extension',(1.8,.4,.9),(1.5,2.2,1.8),'white')
        box(r,'sun room glass',(2.57,.4,1.1),(.06,1.85,1.15),'window')
        box(r,'sun room roof',(1.8,.4,1.92),(1.7,2.4,.16),'mint')
    elif i==13:
        box(r,'tall stone chimney',(-1.65,.65,height*.6),(.75,.85,height*1.2),'cream')
        box(r,'chimney crown',(-1.65,.65,height*1.2+.1),(.95,1.05,.2),'wood')
    elif i==14:
        for x in [-1.7,-.85,0,.85,1.7]:box(r,'roof terrace rail post',(x,-1.45,height+.55),(.075,.075,.9),'white')
        box(r,'roof terrace handrail',(0,-1.45,height+1),(3.6,.1,.1),'white')
        box(r,'terrace flower bed',(0,.55,height+.38),(2.5,.6,.4),'mint')
    elif i==15:
        box(r,'stair tower',(1.4,.5,height/2+.35),(1.1,1.6,height+.7),mat)
        box(r,'stair tower cap',(1.4,.5,height+.85),(1.3,1.8,.2),'mint')
        for z in [1.2,2.5,3.8]:box(r,'tower side window',(1.98,.5,z),(.07,.6,.65),'window')
    # Individual garden pots and a letterbox are part of each house model.
    for n in range(1+i%3):box(r,'flower planter',(-1.7+n*.4,-depth/2-.25,.19),(.3,.35,.35),'mint')
    box(r,'letterbox',(-.8,-2.8,.9),(.4,.35,.3),'wood')
    box(r,'letterbox post',(-.8,-2.8,.45),(.08,.08,.8),'white')
    export(r)

r=root('clinic-exterior')
# The clinic's existing cutaway interior occupies this exact footprint. Keep the
# street-facing side doorway open and add a canopy/sign, rather than a second box.
box(r,'clinic rear roof',(0,2.9,3.5),(10.8,2.4,.18),'roof')
box(r,'door canopy',(5.4,-1.65,2.7),(1.4,2.7,.16),'mint')
box(r,'clinic sign',(5.11,-1.65,3.25),(.15,1.6,.65),'mint')
box(r,'vet cross upright',(5.21,-1.65,3.25),(.08,.13,.5),'white')
box(r,'vet cross across',(5.21,-1.65,3.25),(.08,.5,.13),'white')
export(r)
r=root('doghouse')
for x in [-.59,.59]:box(r,'kennel side wall',(x,0,.5),(.12,1.35,1),'wood')
box(r,'kennel back wall',(0,.61,.5),(1.3,.12,1),'wood')
for x in [-.50,.50]:box(r,'door frame',(x,-.61,.45),(.30,.12,.9),'wood')
box(r,'door lintel',(0,-.61,.9),(1.3,.12,.2),'wood')
box(r,'shaded interior',(0,.53,.46),(1.06,.025,.78),'rubber')
box(r,'kennel bed',(0,0,.08),(1.02,1.1,.14),'mint')
box(r,'sleeping cushion',(0,-.86,.12),(.7,.7,.15),'mint')
box(r,'kennel roof',(0,0,1.04),(1.6,1.6,.2),'roof')
export(r)
r=root('car')
box(r,'car body',(0,0,.55),(1.15,2.2,.55),'car')
box(r,'windscreen',(0,0,1.0),(.95,1.1,.5),'window')
box(r,'roof',(0,0,1.3),(1.1,1.2,.12),'car')
for x in [-.57,.57]:
    for y in [-.72,.72]:
        bpy.ops.mesh.primitive_cylinder_add(vertices=12,radius=.29,depth=.16,location=(x,y,.34),rotation=(0,math.pi/2,0))
        o=bpy.context.object;o.parent=r;o.name='wheel';o.data.materials.append(mats['rubber'])
for x in [-.37,.37]:box(r,'headlight',(x,-1.12,.6),(.25,.05,.2),'white')
export(r)
bpy.context.preferences.filepaths.save_version=0
r=root('shade-tree');box(r,'shade trunk',(0,0,1.2),(.25,.25,2.4),'wood')
for x,y,z in [(-.65,0,2.8),(.65,.1,2.8),(0,-.6,2.8),(0,.55,2.8),(0,0,3.25)]:
 bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2,radius=1,location=(x,y,z));o=bpy.context.object;o.scale=(1,1,.75);o.parent=r;o.data.materials.append(mats['leaf'])
export(r)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'assets','blender','hookville.blend'),compress=True)
print('Exported original Hookville scenery, including sixteen unique homes and a shade tree.')
