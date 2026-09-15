"""Original extra pet amusements and a safe fish-bowl trolley, Blender Z-up."""
import bpy, math, os
ROOT=globals().get('PROJECT_ROOT') or os.environ.get('BLENDER_PROJECT_ROOT') or os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT=os.path.join(ROOT,'public/models/clinic');os.makedirs(OUT,exist_ok=True)
scene=bpy.data.scenes.new('More pet amusements');bpy.context.window.scene=scene
mats={}
for name,c in {'cream':(.94,.9,.78),'mint':(.36,.66,.53),'rose':(.85,.47,.43),'gold':(.96,.73,.28),'blue':(.38,.68,.82),'wood':(.57,.36,.2),'dark':(.16,.25,.23),'water':(.45,.77,.84)}.items():
 m=bpy.data.materials.new(name);m.diffuse_color=(*c,1);m.use_nodes=True;m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(*c,1);mats[name]=m

def root(name,parent=None):
 o=bpy.data.objects.new(name,None);scene.collection.objects.link(o);o.parent=parent;return o

def box(r,n,x,z,y,sx,sz,sy,mat):
 bpy.ops.mesh.primitive_cube_add(size=1,location=(x,-z,y));o=bpy.context.object;o.name=n;o.scale=(sx,sz,sy);o.parent=r;o.data.materials.append(mats[mat]);return o

def sphere(r,n,x,z,y,sx,sz,sy,mat):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=8,location=(x,-z,y));o=bpy.context.object;o.name=n;o.scale=(sx,sz,sy);o.parent=r;o.data.materials.append(mats[mat]);
 for p in o.data.polygons:p.use_smooth=True
 return o

def ring(r,n,x,z,y,radius,mat,rotation=(math.pi/2,0,0)):
 bpy.ops.mesh.primitive_torus_add(major_radius=radius,minor_radius=.055,major_segments=24,minor_segments=8,location=(x,-z,y),rotation=rotation);o=bpy.context.object;o.name=n;o.parent=r;o.data.materials.append(mats[mat]);return o

def export(r):
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

for kind in ['fish-bubbles','fish-reef']:
 r=root(kind);box(r,'bowl docking mat',0,0,.065,1.5,1.45,.08,'blue')
 for x in [-.63,.63]:box(r,'guide rail',x,0,.2,.08,1.1,.18,'mint')
 box(r,'reef backdrop',0,-.56,.62,1.35,.13,1.1,'water')
 if kind=='fish-reef':
  for i in range(6):
   x=-.5+i*.2
   sphere(r,'friendly coral',x,-.43,.55,.07,.06,.24+(i%3)*.1,['rose','gold','mint'][i%3])
  ring(r,'aquatic hoop',0,-.30,.62,.25,'gold')
 else:
  for column in range(3):
   x=(column-1)*.4
   box(r,'bubble tube',x,-.38,.64,.16,.16,.92,'blue')
   for j in range(4):
    sphere(r,'bubble bead',x,-.25,.28+j*.21,.07,.07,.07,'cream')
  box(r,'bubble pump',.53,-.31,.23,.18,.3,.2,'gold')
 box(r,'dock sign',0,-.61,1.22,.85,.10,.23,'cream')
 for i in range(5):
  b=root('AquaticBubble'+str(i),r);sphere(b,'round water bubble',0,0,0,.055,.055,.055,'water')
 export(r)
r=root('bowl-trolley');box(r,'padded bowl carrier',0,0,.01,2.05,1.95,.12,'mint')
for x in [-.86,.86]:
 for z in [-.75,.75]:
  w=root('TrolleyWheel',r);w.location=(x,-z,-.16);ring(w,'soft wheel',0,0,0,.12,'dark',(0,math.pi/2,0))
export(r)
r=root('agility-tunnel');box(r,'tunnel mat',0,0,.06,2.5,1.65,.08,'mint')
for i in range(7):ring(r,'rainbow tunnel rib',-1.02+i*.34,0,.55,.55,['rose','gold','blue'][i%3],(0,math.pi/2,0))
for z in [-.55,.55]:box(r,'soft tunnel runner',0,z,.15,2.4,.12,.16,'cream')
export(r)
r=root('snuffle-mat');box(r,'snuffle mat',0,0,.06,1.7,1.7,.08,'rose')
for i in range(7):
 for j in range(7):
  sphere(r,'soft snuffle tuft',-.66+i*.22,-.66+j*.22,.13,.075,.075,.1,['mint','gold','cream'][(i+j)%3])
for x,z in [(-.4,-.2),(.3,.4),(.1,-.5)]:sphere(r,'hidden snack',x,z,.18,.06,.045,.035,'wood')
export(r)
r=root('cat-feather');box(r,'pounce mat',0,0,.05,1.7,1.7,.07,'blue');box(r,'toy support',0,-.55,.5,.10,.10,.95,'wood')
arm=root('FeatherArm',r);arm.location=(0,.55,.98)
box(arm,'wand',0,.25,0,.045,.75,.045,'mint');box(arm,'dangling string',0,.63,-.23,.025,.025,.45,'cream')
for i in range(3):sphere(arm,'felt feather',(i-1)*.06,.63,-.45,.045,.035,.16,['rose','gold','blue'][i])
export(r)
r=root('dig-box');box(r,'digging box',0,0,.12,1.9,1.7,.2,'wood');box(r,'soft bedding',0,0,.23,1.73,1.52,.06,'cream')
for x in [-.87,.87]:box(r,'low box rim',x,0,.31,.10,1.7,.20,'mint')
for z in [-.77,.77]:box(r,'low box rim',0,z,.31,1.9,.10,.20,'mint')
for i in range(7):sphere(r,'bedding mound',math.sin(i*2)*.6,math.cos(i*2)*.48,.3,.17,.13,.08,'gold')
export(r)
r=root('bird-hoops');box(r,'flight course mat',0,0,.06,2.3,1.7,.08,'mint')
for i in range(3):
 x=(i-1)*.7;box(r,'hoop post',x,0,.75,.065,.065,1.4,'wood');ring(r,'flying hoop',x,0,1.5,.31,['rose','gold','blue'][i],(0,math.pi/2,0))
box(r,'landing perch',0,.62,.23,1.4,.10,.10,'wood');export(r)
r=root('pet-piano');box(r,'piano mat',0,0,.05,1.7,1.7,.07,'blue');box(r,'piano case',0,-.22,.22,1.6,.8,.30,'wood')
for i in range(5):
 k=root('PianoKey'+str(i),r);k.location=(-.6+i*.3,.04,.41)
 box(k,'big colourful key',0,0,0,.27,.64,.10,['cream','rose','gold','mint','blue'][i])
 sphere(r,'note light',-.6+i*.3,-.53,.61,.08,.06,.08,['cream','rose','gold','mint','blue'][i])
export(r)
bpy.context.preferences.filepaths.save_version=0
os.makedirs(os.path.join(ROOT,'assets/blender'),exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'assets/blender/extra-amusements.blend'),compress=True)
print('Exported eight amusements and the bowl trolley.')
