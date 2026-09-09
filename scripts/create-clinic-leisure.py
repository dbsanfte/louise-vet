"""Original modular rooms and working waiting-room amusements, Blender Z-up."""
import bpy,math,os,json
ROOT=globals().get('PROJECT_ROOT') or os.environ.get('BLENDER_PROJECT_ROOT') or os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT=os.path.join(ROOT,'public/models/clinic');os.makedirs(OUT,exist_ok=True)
scene=bpy.data.scenes.new('Clinic leisure studio');bpy.context.window.scene=scene
mats={}
for name,c in {'cream':(.9,.85,.7),'mint':(.37,.64,.55),'rose':(.8,.49,.46),'gold':(.92,.72,.28),'blue':(.39,.64,.76),'wood':(.64,.42,.24),'white':(.98,.96,.86),'dark':(.2,.3,.3)}.items():
 m=bpy.data.materials.new(name);m.diffuse_color=(*c,1);m.use_nodes=True;m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(*c,1);mats[name]=m

def root(name,parent=None):
 o=bpy.data.objects.new(name,None);scene.collection.objects.link(o);o.parent=parent;return o

def box(r,n,x,z,y,sx,sz,sy,mat):
 bpy.ops.mesh.primitive_cube_add(size=1,location=(x,-z,y));o=bpy.context.object;o.name=n;o.scale=(sx,sz,sy);o.parent=r;o.data.materials.append(mats[mat]);return o

def cylinder(r,n,x,z,y,radius,depth,mat):
 bpy.ops.mesh.primitive_cylinder_add(vertices=24,radius=radius,depth=depth,location=(x,-z,y));o=bpy.context.object;o.name=n;o.parent=r;o.data.materials.append(mats[mat]);return o

def export(r):
 # Batch static details per parent/material while preserving moving prop groups.
 for parent in [r,*[o for o in r.children_recursive if o.type=='EMPTY']]:
  for mat in mats.values():
   parts=[o for o in parent.children if o.type=='MESH' and not o.children and o.data.materials[0]==mat]
   if len(parts)<2:continue
   bpy.ops.object.select_all(action='DESELECT')
   for o in parts:o.select_set(True)
   bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join()
 bpy.ops.object.select_all(action='DESELECT');r.select_set(True)
 for o in r.children_recursive:o.select_set(True)
 bpy.context.view_layer.objects.active=r
 bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,r.name+'.glb'),export_format='GLB',use_selection=True,export_extras=True)
 for o in [r,*r.children_recursive]:o.hide_set(True)

def chair(r,x,z):
 box(r,'chair seat',x,z,.78,.8,.7,.14,'rose');box(r,'chair back',x,z+.32,1.16,.8,.12,.8,'mint')
 for dx in [-.3,.3]:
  for dz in [-.25,.25]:box(r,'chair leg',x+dx,z+dz,.36,.08,.08,.7,'wood')

plan=json.load(open(os.path.join(ROOT,'src/clinic-layout.json')))
for kind,room in zip(['lounge','playroom','play-annex','sun-courtyard'],plan['rooms']):
 r=root(kind);w,d=room['width'],room['depth']
 box(r,'room foundation',0,0,-.13,w,d,.3,'cream')
 for x in range(w):
  for z in range(d):box(r,'room tile',x-(w-1)/2,z-(d-1)/2,.035,.99,.99,.05,'white' if kind=='lounge' else 'mint' if (x+z)%2 else 'blue')
 if kind=='lounge':
  for x in [-1.975,1.975]:box(r,'back wall',x,-d/2+.04,.4,2.05,.15,.8,'cream')
 elif kind=='playroom':box(r,'back wall',-.95,-d/2+.04,.4,w-1.9,.15,.8,'cream')
 else:box(r,'back wall',0,-d/2+.04,.4,w,.15,.8,'cream')
 # Central connecting aisle remains at clinic-local Z=0, even as the garden grows.
 aisle=-room['z']
 for lo,hi in [(-d/2,aisle-.95),(aisle+.95,d/2)]:
  lo=max(lo,-d/2);hi=min(hi,d/2)
  if hi>lo:box(r,'cutaway end wall',-w/2,(lo+hi)/2,.4,.15,hi-lo,.8,'cream')
 if kind=='lounge':
  box(r,'door lintel',-w/2,aisle,2.98,.15,1.9,.44,'cream')
  for z in [aisle-.99,aisle+.99]:box(r,'doorpost',-w/2,z,1.45,.15,.16,2.9,'mint')
  for x in [-1.7,-.1,1.5]:
   seat=root('lounge chair',r);chair(seat,0,0);seat.location=(x,-2.65,0)
 elif kind=='playroom':
  # A contained garden edge facing the pavement, with the whole footprint inside the plot.
  box(r,'garden front border',0,d/2-.08,.2,w,.16,.4,'mint')
  box(r,'play sign',0,-d/2+.2,1.15,2.6,.12,.7,'gold')
  for st in plan['stations']:
   if st['audience']!='pet' or not (room['x']-w/2 <= st['x'] <= room['x']+w/2 and room['z']-d/2 <= st['z'] <= room['z']+d/2):continue
   for i in range(3):
    if st['kind'] in ['coaster','ferris']:x,z=-11.9,st['z']+.65-i*.45
    else:x,z=st['x']+(.7 if st['x']<-14 else -.7),(1 if st['z']>0 else -1)*(1.35-i*.5)
    cylinder(r,'queue spot',x-room['x'],z-room['z'],.08,.14,.025,'gold')
 else:
  if kind=='sun-courtyard':box(r,'courtyard front border',-.95,d/2-.08,.2,w-1.9,.16,.4,'mint')
  else:
   for x in [-1.975,1.975]:box(r,'garden entrance border',x,d/2-.08,.2,2.05,.16,.4,'mint')
  for st in plan['stations']:
   if 'queueX' not in st or not (room['x']-w/2 <= st['x'] <= room['x']+w/2 and room['z']-d/2 <= st['z'] <= room['z']+d/2):continue
   for i in range(3):cylinder(r,'queue spot',st['queueX']-room['x'],st['queueZ']-i*.45-room['z'],.08,.13,.025,'gold')
 export(r)
r=root('door');box(r,'closed future doorway',0,0,1.25,.14,1.8,2.5,'mint');box(r,'door sign',-.09,0,1.55,.04,.8,.5,'gold');export(r)
r=root('bench');chair(r,-.375,0);chair(r,.375,0);export(r)
r=root('books');box(r,'book trolley',0,0,.7,.8,.5,.9,'wood')
for i in range(6):box(r,'colourful book',-.3+i*.12,0,1.3,.1,.45,.38,'gold' if i%2 else 'rose')
export(r)
r=root('reading-book')
for side in [-1,1]:
 o=box(r,'open pages',side*.14,0,0,.28,.35,.035,'cream');o.rotation_euler.y=side*.15
export(r)
r=root('table-games');box(r,'game table',0,0,.85,1.45,1.35,.12,'wood')
for x in [-.55,.55]:
 for z in [-.5,.5]:box(r,'table leg',x,z,.42,.12,.12,.84,'wood')
box(r,'game board',0,0,.925,1,1,.04,'mint')
for x in [-.3,0,.3]:
 for z in [-.3,0,.3]:cylinder(r,'playing piece',x,z,.98,.06,.07,'gold' if x*z>0 else 'rose')
# Separate chairs face the board.
for x in [-1,1]:
 sub=root('game chair',r);chair(sub,0,0)
 sub.location=(x,0,0);sub.rotation_euler.z=-math.pi/2 if x<0 else math.pi/2
export(r)
r=root('scratch');cylinder(r,'soft base',0,0,.08,.6,.14,'rose');cylinder(r,'scratching column',0,0,.65,.2,1.15,'cream');cylinder(r,'top cushion',0,0,1.3,.44,.15,'mint')
for y in [.25,.4,.55,.7,.85,1,1.15]:
 bpy.ops.mesh.primitive_torus_add(major_radius=.205,minor_radius=.025,major_segments=16,minor_segments=6,location=(0,0,y));o=bpy.context.object;o.parent=r;o.data.materials.append(mats['wood'])
export(r)
r=root('wheel');box(r,'wheel stand',0,0,.1,1.5,.8,.2,'wood')
rotor=root('WheelRotor',r);rotor.location=(0,0,.85)
# Cylinder axis is local X; open rim and tread let the running pet stay visible.
for x in [-.3,.3]:
 bpy.ops.mesh.primitive_torus_add(major_radius=.73,minor_radius=.05,major_segments=32,minor_segments=8,location=(x,0,0),rotation=(0,math.pi/2,0));o=bpy.context.object;o.parent=rotor;o.data.materials.append(mats['rose'])
for i in range(20):
 t=i*math.tau/20;o=box(rotor,'wheel tread',0,math.sin(t)*.73,math.cos(t)*.73,.65,.07,.07,'gold');o.rotation_euler.x=t
export(r)
r=root('carousel');cylinder(r,'ride base',0,0,.09,1.05,.18,'mint');rotor=root('CarouselRotor',r);cylinder(rotor,'turntable',0,0,.23,.94,.16,'gold')
for x,z in [(.65,0),(-.65,0),(0,.65),(0,-.65)]:cylinder(rotor,'soft handle',x,z,.52,.055,.45,'rose')
cylinder(r,'centre post',0,0,.58,.1,.8,'mint');export(r)
r=root('toys');box(r,'play mat',0,0,.08,1.8,1.5,.06,'rose');box(r,'toy basket',.5,.35,.32,.65,.55,.4,'wood')
for x,z in [(-.5,.2),(-.3,-.4),(.25,-.4)]:cylinder(r,'rolling toy',x,z,.23,.16,.25,'gold')
export(r)

def beam(r,n,a,b,width,mat):
 from mathutils import Vector
 start,end=Vector((a[0],-a[1],a[2])),Vector((b[0],-b[1],b[2]));delta=end-start
 o=box(r,n,0,0,0,width,width,delta.length,mat);o.location=(start+end)/2;o.rotation_euler=delta.to_track_quat('Z','Y').to_euler();return o

def cabin(r,name,mat):
 c=root(name,r)
 box(c,'cushioned floor',0,0,.035,.82,.85,.1,mat)
 for x in [-.43,.43]:box(c,'padded side',x,0,.24,.09,.88,.4,mat)
 box(c,'soft back',0,-.43,.27,.9,.08,.45,mat)
 box(c,'front safety bar',0,.43,.27,.9,.06,.09,'cream')
 return c

r=root('coaster')
# A low oval with one gentle rise. Its exported centreline matches pet-rides.ts.
def track(t,side=0):return ((2+side)*math.cos(t),(1.4+side)*math.sin(t),.24+.5*(1-math.cos(t)))
for i in range(64):
 a,b=i*math.tau/64,(i+1)*math.tau/64
 for side in [-.34,.34]:beam(r,'continuous rail',track(a,side),track(b,side),.07,'rose')
 if i%2==0:
  beam(r,'track sleeper',track(a,-.39),track(a,.39),.07,'gold')
 if i%8==0:
  x,z,y=track(a);beam(r,'track support',(x,z,.08),(x,z,y),.12,'mint')
car=cabin(r,'CoasterCar','blue');car.location=(2,0,.28)
for x in [-.34,.34]:
 for z in [-.25,.25]:cylinder(car,'car wheel',x,z,-.04,.09,.08,'dark').rotation_euler.y=math.pi/2
export(r)
r=root('ferris')
box(r,'wheel foundation',0,0,.08,4.5,1.45,.16,'mint')
for z in [-.5,.5]:
 for x in [-1.4,1.4]:beam(r,'A frame support',(x,z,.15),(0,z,2),.14,'blue')
rotor=root('FerrisRotor',r);rotor.location=(0,0,2)
for z in [-.32,.32]:
 bpy.ops.mesh.primitive_torus_add(major_radius=1.65,minor_radius=.055,major_segments=48,minor_segments=8,rotation=(math.pi/2,0,0));o=bpy.context.object;o.name='Ferris rim';o.parent=rotor;o.location=(0,-z,0);o.data.materials.append(mats['gold'])
 for i in range(8):
  t=i*math.tau/8;beam(rotor,'wheel spoke',(0,z,0),(math.sin(t)*1.65,z,-math.cos(t)*1.65),.07,'rose')
for i in range(4):
 c=cabin(r,'FerrisCabin'+str(i),'rose' if i%2 else 'gold');t=i*math.tau/4;c.location=(math.sin(t)*1.65,0,2-math.cos(t)*1.65)
export(r)
def sphere(r,n,x,z,y,sx,sz,sy,mat):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=10,location=(x,-z,y));o=bpy.context.object;o.name=n;o.parent=r;o.scale=(sx,sz,sy);o.data.materials.append(mats[mat])
 for face in o.data.polygons:face.use_smooth=True
 return o

for kind in ['treat-dispenser','water-dispenser']:
 r=root(kind);box(r,'rounded station plinth',0,0,.1,1.3,1.2,.16,'mint')
 cylinder(r,'dispenser body',0,-.3,.65,.32,.9,'blue' if kind=='water-dispenser' else 'gold')
 sphere(r,'round lid',0,-.3,1.16,.36,.36,.12,'mint')
 box(r,'spout',0,.04,.56,.13,.4,.13,'white');cylinder(r,'paw button',.42,.15,.22,.15,.08,'rose')
 cylinder(r,'bowl rim',0,.45,.18,.29,.13,'cream');cylinder(r,'bowl contents',0,.45,.252,.235,.025,'blue' if kind=='water-dispenser' else 'wood')
 moving=root('DispenserFlow',r)
 if kind=='water-dispenser':cylinder(moving,'water stream',0,.21,.4,.035,.22,'blue')
 else:
  for x in [-.08,.06]:sphere(moving,'little treat',x,.28,.34,.065,.065,.045,'wood')
 export(r)
for kind in ['toy-box','yarn']:
 r=root(kind);box(r,'soft play mat',0,0,.08,2.05,1.9,.1,'blue' if kind=='toy-box' else 'rose')
 if kind=='toy-box':
  box(r,'toy chest',-.5,-.45,.28,.6,.55,.4,'gold')
  for x in [-.58,-.38]:sphere(r,'spare toy',x,-.45,.52,.12,.12,.13,'rose')
 else:
  box(r,'yarn basket',-.5,-.45,.22,.55,.5,.3,'wood')
  for x in [-.59,-.39]:sphere(r,'spare yarn',x,-.45,.43,.14,.14,.14,'gold')
 ball=root('PlayBall',r);sphere(ball,'rolling ball',0,0,0,.19,.19,.19,'gold' if kind=='toy-box' else 'mint')
 for a in [0,math.pi/3,2*math.pi/3]:
  bpy.ops.mesh.primitive_torus_add(major_radius=.19,minor_radius=.012,major_segments=20,minor_segments=5,rotation=(a,math.pi/2,0));o=bpy.context.object;o.parent=ball;o.data.materials.append(mats['white'])
 ball.location=(0,-.55,.27);export(r)
r=root('aviary');cylinder(r,'pavilion floor',0,0,.08,1.03,.12,'mint')
# Open front and widely spaced rails keep birds visible inside their flight space.
for i in range(9):
 a=math.pi+i*math.pi/8;x,z=math.cos(a),math.sin(a)
 cylinder(r,'pavilion upright',x,z,1.1,.035,2.1,'cream')
for y in [.15,2.15]:
 for i in range(16):
  a,b=i*math.tau/16,(i+1)*math.tau/16;beam(r,'pavilion ring',(math.cos(a),math.sin(a),y),(math.cos(b),math.sin(b),y),.035,'mint')
beam(r,'perch branch',(-.8,-.5,1.1),(.5,-.5,1.25),.075,'wood')
swing=root('BirdSwing',r);swing.location=(.2,.4,1.7)
for x in [-.25,.25]:beam(swing,'swing rope',(x,0,0),(x,0,-.45),.02,'cream')
beam(swing,'swing perch',(-.3,0,-.45),(.3,0,-.45),.055,'wood');export(r)
r=root('play-tree');cylinder(r,'tree mat',0,0,.065,1.08,.1,'rose');cylinder(r,'tree trunk',0,0,1.1,.15,2.15,'wood')
# Twelve overlapping landings follow the same gentle spiral used by climbing pets.
for i in range(13):
 a=i/12*math.tau;y=i/12*1.55
 cylinder(r,'spiral cushion',math.sin(a)*.65,math.cos(a)*.65,y+.07,.31,.1,'mint' if i%2 else 'gold')
for x,z,y in [(-.65,-.25,2),(.65,-.1,2.25),(0,.65,1.58)]:beam(r,'friendly branch',(0,0,y-.25),(x,z,y),.085,'wood')
for x,z,y in [(-.55,-.3,2.1),(.6,-.25,2.4)]:sphere(r,'leaf canopy',x,z,y,.4,.35,.22,'mint')
export(r)
bpy.context.preferences.filepaths.save_version=0

# Courtyard purchases: articulated moving parts stay named in the exports.
r=root('puzzle-table')
box(r,'picnic tabletop',0,0,.86,1.4,1.2,.13,'wood')
for x in [-.5,.5]:box(r,'table foot',x,0,.43,.14,.9,.85,'mint')
for x in [-1,1]:
 sub=root('puzzle chair',r);chair(sub,0,0);sub.location=(x,0,0);sub.rotation_euler.z=-math.pi/2 if x<0 else math.pi/2
for x in range(4):
 for z in range(4):box(r,'puzzle square',-.36+x*.24,-.36+z*.24,.945,.23,.23,.035,'mint' if (x+z)%2 else 'gold')
for x,z in [(-.36,-.12),(.12,.36),(.36,-.36)]:cylinder(r,'puzzle counter',x,z,1,.07,.065,'rose')
cylinder(r,'parasol pole',0,-.68,1.35,.045,2.7,'wood')
sphere(r,'parasol canopy',0,-.1,2.65,1.45,1.25,.25,'gold');export(r)
r=root('bubbles');cylinder(r,'bubble mat',0,0,.06,.98,.09,'blue')
box(r,'bubble machine',0,-.55,.4,.55,.45,.65,'rose');cylinder(r,'bubble nozzle',0,-.3,.65,.16,.1,'gold')
# Thin soap shells reflect light and reveal the pet behind them.
m=bpy.data.materials.new('soap film');m.use_nodes=True;m.diffuse_color=(.6,.84,1,.3);m.blend_method='BLEND'
n=m.node_tree.nodes['Principled BSDF'];n.inputs['Base Color'].default_value=(.6,.84,1,1);n.inputs['Alpha'].default_value=.3;n.inputs['Roughness'].default_value=.15;n.inputs['Metallic'].default_value=.15;mats['soap']=m
for i in range(7):
 bubble=root('Bubble'+str(i),r);sphere(bubble,'soap bubble',0,0,0,.14,.14,.14,'soap')
export(r)
r=root('cat-nook');sphere(r,'soft cat bed',0,.1,.13,.8,.68,.15,'rose')
for x in [-.73,.73]:box(r,'bed hood post',x,-.25,.52,.09,.09,1,'wood')
box(r,'open hood roof',0,-.25,1.05,1.7,1.2,.12,'mint')
for x in [-.4,0,.4]:box(r,'canopy stripe',x,-.25,1.12,.15,1.2,.02,'cream')
sphere(r,'back bolster',0,-.44,.28,.68,.12,.2,'gold');export(r)
r=root('bird-chimes')
for x in [-.7,.7]:cylinder(r,'chime arch upright',x,0,1,.06,2,'wood')
beam(r,'curved arch left',(-.7,0,2),(0,0,2.2),.08,'mint');beam(r,'curved arch right',(0,0,2.2),(.7,0,2),.08,'mint')
beam(r,'bird landing perch',(-.65,-.4,1.35),(.65,-.4,1.35),.055,'wood')
chimes=root('Chimes',r);chimes.location=(0,0,1.8)
for i in range(5):cylinder(chimes,'colourful chime',-.4+i*.2,0,-.2,.045,.25+(i%3)*.12,['rose','gold','blue'][i%3])
export(r)
r=root('flower-border')
for z in [-3,-1,1.6]:
 box(r,'raised planter',-2.65,z,.25,.4,1.1,.45,'wood')
 for dz in [-.32,0,.32]:
  cylinder(r,'flower stem',-2.65,z+dz,.58,.025,.55,'mint')
  for a in range(5):sphere(r,'rounded petal',-2.65+math.cos(a*math.tau/5)*.09,z+dz+math.sin(a*math.tau/5)*.09,.86,.08,.08,.04,'rose' if dz else 'gold')
  sphere(r,'flower heart',-2.65,z+dz,.88,.04,.04,.04,'gold')
export(r)
r=root('bunting');beam(r,'bunting string',(-4.5,-3.4,3.36),(4.4,-3.4,3.36),.018,'wood')
for i in range(10):
 x=-4.2+i*.9;box(r,'pennant',x,-3.4,3.14,.45,.04,.35,['rose','mint','gold'][i%3])
 sphere(r,'paw pad',x,-3.36,3.10,.075,.024,.065,'cream')
 for dx in [-.09,0,.09]:sphere(r,'paw toe',x+dx,-3.36,3.22,.03,.024,.035,'cream')
export(r)
r=root('cosy-rug');box(r,'woven rug',0,0,.074,2.6,1.6,.025,'rose')
for z in [-.71,.71]:box(r,'rug border',0,z,.091,2.45,.08,.012,'gold')
for x in [-1.2,1.2]:box(r,'rug border',x,0,.091,.08,1.4,.012,'gold')
for x in [-.65,.65]:
 sphere(r,'rug paw pad',x,0,.094,.18,.15,.01,'cream')
 for dx in [-.18,0,.18]:sphere(r,'rug paw toe',x+dx,-.25,.094,.075,.075,.01,'cream')
export(r)
r=root('wall-art')
for i in range(3):
 x=-3.6+i*1.2;box(r,'picture frame',x,-3.44,1.06,.88,.06,.62,'wood');box(r,'pastel picture',x,-3.40,1.06,.76,.025,.52,['mint','rose','blue'][i])
 sphere(r,'friendly pet face',x,-3.375,1.07,.16,.025,.15,'gold')
 for dx in [-.14,.14]:sphere(r,'pet ear',x+dx,-3.375,1.23,.05,.025,.08,'gold')
 for dx in [-.055,.055]:sphere(r,'pet eye',x+dx,-3.34,1.10,.022,.015,.026,'dark')
 sphere(r,'pet nose',x,-3.34,1.0,.03,.015,.022,'dark')
export(r)

bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'assets/blender/clinic-leisure.blend'),compress=True)
print('Exported modular clinic rooms and enrichment props.')
