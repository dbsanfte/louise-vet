"""Original cutaway pet party pavilion; geometry shares its plan with the simulation."""
import os, json, math
ROOT=globals().get('PROJECT_ROOT') or os.environ.get('BLENDER_PROJECT_ROOT') or os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROJECT_ROOT=ROOT
with open(os.path.join(ROOT,'scripts/create-town-assets.py')) as f:
    exec(f.read().split("r=root('neighbourhood')")[0].replace('Hookville studio','Hookville party studio'))
plan=json.load(open(os.path.join(ROOT,'src/party-layout.json')))
for name,col in {'party-pink':(.88,.45,.60),'party-blue':(.30,.63,.80),'party-gold':(.99,.74,.30),'party-floor':(.90,.79,.64),'party-lilac':(.68,.52,.79)}.items():
    m=bpy.data.materials.new(name);m.diffuse_color=(*col,1);m.use_nodes=True
    m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(*col,1)
    m.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.65;mats[name]=m

def sphere(r,name,x,z,y,scale,mat):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=10,location=(x,-z,y))
    o=bpy.context.object;o.name=name;o.scale=scale;o.parent=r;o.data.materials.append(mats[mat])
    for p in o.data.polygons:p.use_smooth=True
    return o

def pole(r,name,x,z,y,radius,height,mat):
    bpy.ops.mesh.primitive_cylinder_add(vertices=16,radius=radius,depth=height,location=(x,-z,y))
    o=bpy.context.object;o.name=name;o.parent=r;o.data.materials.append(mats[mat]);return o

r=root('party-hall');b=plan['bounds'];cx,cz=plan['centre']['x'],plan['centre']['z']
box(r,'party pavilion floor',(cx,-cz,.12),(7.6,7.4,.12),'party-floor')
ribbon(r,'party front path',[[-18,3],[-20,3],[-20,5.4]],.95,.126,'path')
# A cutaway veranda roof and low side walls keep every mat visible from the town camera.
box(r,'back wall',(cx,-12.3,.82),(7.6,.18,1.3),'cream')
for x in [-23.7,-16.3]:
    box(r,'side wall',(x,-8.9,.43),(.18,6.6,.55),'mint')
    for z in [5.25,12.15]:
        pole(r,'veranda column',x,z,1.6,.1,2.95,'white')
        box(r,'column foot',(x,-z,.28),(.30,.30,.2),'mint')
box(r,'back canopy',(cx,-11.9,2.97),(7.8,1.25,.18),'party-blue')
for x in [-22.7,-20.9,-19.1,-17.3]:
    for z in [11.62,11.43,11.24]:box(r,'bench slat',(x,-z,.68),(1.32,.16,.10),'wood')
    for y in [.97,1.17]:box(r,'bench back',(x,-11.77,y),(1.32,.08,.15),'mint')
    for dx in [-.46,.46]:pole(r,'bench foot',x+dx,11.5,.4,.045,.5,'rubber')
    for z in [8,9.6]:
        pole(r,'personal party mat',x,z,.194,.52,.025,'party-lilac' if z>8 else 'party-blue')
        # Bowls are beside, not underneath, each animal's reserved activity spot.
        pole(r,'pet snack bowl',x-.39,z+.43,.25,.14,.10,'party-gold')
        pole(r,'fresh water bowl',x+.36,z+.43,.25,.12,.10,'mint')
        pole(r,'water surface',x+.36,z+.43,.308,.095,.012,'window')
# Bright pennants along the open front and back beams.
for z in [5.25,12.15]:
    box(r,'bunting string',(cx,-z,2.73),(7.2,.018,.018),'white')
    for i in range(13):
        x=-23.4+i*.56
        mesh=bpy.data.meshes.new('pennant');mesh.from_pydata([(x,-z,2.73),(x+.4,-z,2.73),(x+.2,-z,2.38)],[],[(0,1,2)])
        o=bpy.data.objects.new('birthday pennant',mesh);scene.collection.objects.link(o);o.parent=r;o.data.materials.append(mats[['party-pink','party-blue','party-gold'][i%3]])
for x in [-23.35,-16.65]:
    for j in range(3):
        xx=x+(j-1)*.24;z=5.2+j*.14;y=2.05+j*.27
        pole(r,'balloon ribbon',xx,z,y/2,.008,y,'white')
        sphere(r,'party balloon',xx,z,y,(.20,.20,.26),['party-pink','party-blue','party-gold'][j])
    box(r,'wrapped present',(x,-5,.39),(.42,.42,.4),'party-pink')
    box(r,'present ribbon',(x,-5,.40),(.06,.44,.42),'party-gold')
# A recognisable paw emblem above the front entrance; no text texture dependency.
pole(r,'sign upright',-22.95,5.1,1.2,.06,2.2,'wood')
box(r,'paw sign',(-22.95,-5.1,2.1),(1.05,.08,.75),'mint')
sphere(r,'paw pad',-22.95,5.03,2.02,(.18,.035,.14),'cream')
for dx,dy in [(-.27,.18),(-.1,.3),(.1,.3),(.27,.18)]:sphere(r,'paw toe',-22.95+dx,5.03,2.02+dy,(.075,.04,.09),'cream')
export(r)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'assets/blender/hookville-parties.blend'),compress=True)
print('Exported original Pet Party Hall.')
