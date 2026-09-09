"""Original connected examination room and swinging door, Blender Z-up."""
import bpy,os
ROOT=globals().get('PROJECT_ROOT') or os.environ.get('BLENDER_PROJECT_ROOT') or os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT=os.path.join(ROOT,'public/models/clinic');os.makedirs(OUT,exist_ok=True)
scene=bpy.data.scenes.new('Examination room studio');bpy.context.window.scene=scene
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
 bpy.ops.object.select_all(action='DESELECT');r.select_set(True)
 for o in r.children_recursive:o.select_set(True)
 bpy.context.view_layer.objects.active=r
 bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,r.name+'.glb'),export_format='GLB',use_selection=True,export_extras=True)
 for o in [r,*r.children_recursive]:o.hide_set(True)

r=root('examination-room')
box(r,'room foundation',0,0,-.13,7,6,.3,'cream')
for x in range(7):
 for z in range(6):box(r,'room tile',x-3,z-2.5,.035,.99,.99,.05,'white' if (x+z)%2 else 'mint')
for x in [-3.5,3.5]:box(r,'cutaway side wall',x,0,.45,.14,6,.9,'cream')
box(r,'back wall',0,-3,.5,7,.14,1,'cream')
# The connecting frame belongs to reception; this leaf swings into the room.
hinge=root('ExamDoorHinge',r);hinge.location=(1.2,-3,0)
box(hinge,'exam door',.8,0,1.2,1.55,.12,2.4,'mint')
box(hinge,'door window',.8,-.07,1.65,.9,.025,.55,'blue')
box(hinge,'door handle',1.36,.1,.96,.2,.12,.07,'gold')
# A compact sink and a stocked cabinet stay clear of the table and entry aisle.
box(r,'sink cabinet',-2.65,-1.85,.56,1.3,1.3,1.12,'mint')
box(r,'sink top',-2.65,-1.85,1.18,1.4,1.4,.13,'white')
box(r,'sink bowl',-2.65,-1.85,1.26,.85,.8,.04,'blue')
cylinder(r,'tap stem',-2.65,-2.32,1.4,.045,.38,'gold')
box(r,'tap spout',-2.65,-2.18,1.58,.08,.32,.08,'gold')
box(r,'supply cabinet',-2.65,.1,.82,1.2,1.4,1.64,'cream')
for z in [-.4,.2,.65]:box(r,'supply shelf',-2.65,z,1.7,1,.12,.08,'wood')
for i in range(4):
 cylinder(r,'care bottle',-2.95+i*.2,.1,1.85,.07,.28,'rose' if i%2 else 'blue')
box(r,'towel shelf',-.6,-2.7,.8,1.3,.55,.13,'wood')
for y in [.9,1.0,1.1]:box(r,'folded towel',-.6,-2.7,y,1,.4,.08,'rose')
box(r,'room sign',0,-2.9,1.4,1.4,.12,.6,'gold')
box(r,'care cross vertical',0,-2.81,1.4,.13,.04,.42,'mint')
box(r,'care cross horizontal',0,-2.81,1.4,.42,.04,.13,'mint')
export(r)
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'assets/blender/examination-room.blend'),compress=True)
print('Exported the connected examination room with a hinged door.')
