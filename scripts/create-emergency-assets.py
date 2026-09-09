"""Original emergency service scenery, engine, ladder and responder equipment."""
import os, math, bpy
ROOT=globals().get('PROJECT_ROOT') or os.environ.get('BLENDER_PROJECT_ROOT') or os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROJECT_ROOT=ROOT
with open(os.path.join(ROOT,'scripts/create-blender-assets.py')) as f:
    helpers=f.read().split("for species in ['dog','cat','rabbit','hamster','gerbil','goldfish']:")[0]
exec(helpers.replace("Louise's asset studio","Hookville emergency studio"))
OUT=os.path.join(ROOT,'public/models/town');os.makedirs(OUT,exist_ok=True)
material('fire red',(.76,.12,.09));material('police blue',(.08,.20,.42));material('metal',(.65,.72,.75));material('reflective',(.97,.84,.20))
def label(r,text,loc,size,colour):
    bpy.ops.object.text_add(location=loc,rotation=(math.pi/2,0,0));o=bpy.context.object;o.data.body=text;o.data.align_x='CENTER';o.data.size=size;o.data.extrude=.006;o.parent=r;o.data.materials.append(materials[colour])
def batch(r):
    groups={}
    for o in list(r.children_recursive):
        if o.type in ['MESH','CURVE','FONT'] and not o.children:groups.setdefault((o.parent,o.data.materials[0]),[]).append(o)
    for (parent,mat),parts in groups.items():
        bpy.ops.object.select_all(action='DESELECT')
        for o in parts:o.select_set(True)
        bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.convert(target='MESH');bpy.ops.object.join()
for kind,colour in [('fire','fire red'),('police','police blue')]:
    r=root(kind+'-station')
    cube('foundation',(0,0,.12),(7.7,6.2,.24),'cream',r)
    cube('station walls',(0,.4,1.8),(7,4.7,3.5),'cream',r,.12)
    cube('roof',(0,.4,3.65),(7.5,5.2,.3),colour,r,.12)
    cube('sign board',(0,-2.01,2.95),(6.8,.14,.85),colour,r,.07)
    label(r,'FIRE & RESCUE' if kind=='fire' else 'HOOKVILLE POLICE',(0,-2.1,2.74),.45,'white')
    for x in [-1.7,1.7]:
        cube('garage' if kind=='fire' else 'window',(x,-1.99,1.45),(2.6,.12,2.25),'dark' if kind=='fire' else 'blue',r,.06)
        for z in [.6,1,1.4,1.8,2.2]:cube('door slat',(x,-2.08,z),(2.55,.035,.045),'metal',r,.01)
    cube('front apron',(0,-3.2,.1),(7.6,2,.13),'gray',r,.08)
    batch(r);export(kind+'-station',r)
r=root('fire-engine')
cube('chassis',(0,0,.53),(1.85,4.5,.45),'dark',r)
cube('cab',(0,-1.4,1.26),(1.9,1.7,1.65),'fire red',r,.14)
cube('windscreen',(0,-2.27,1.65),(1.65,.06,.69),'blue',r,.04)
for x in [-.98,.98]:
    cube('cab window',(x,-1.55,1.7),(.05,1.02,.58),'blue',r,.03)
    cube('equipment lockers',(x,.68,1.13),(.08,2.5,.78),'metal',r,.04)
    cube('safety stripe',(x,0,.82),(.09,4.1,.16),'reflective',r,.01)
    for y in [-1.4,1.4]:
        cyl('tyre',(x,y,.42),.44,.24,'black',r).rotation_euler.y=math.pi/2
        cyl('hub',(x*1.14,y,.42),.23,.025,'metal',r).rotation_euler.y=math.pi/2
cube('water tank',(0,.64,1.17),(1.75,2.8,1.2),'fire red',r,.1)
cube('beacon bar',(0,-1.45,2.18),(1.35,.25,.2),'blue',r,.06)
for x in [-.6,.6]:ball('beacon',(x,-1.45,2.3),(.16,.16,.18),'blue',r)
for x in [-.65,.65]:ball('headlamp',(x,-2.33,.88),(.17,.045,.13),'white',r)
label(r,'FIRE',(0,-2.34,1.03),.26,'white')
batch(r);export('fire-engine',r)
r=root('rescue-ladder')
for x in [-.23,.23]:cube('ladder rail',(x,0,1.7),(.065,.065,3.4),'metal',r,.015)
for i in range(12):cube('rung',(0,0,.16+i*.28),(.5,.065,.055),'metal',r,.012)
batch(r);export('rescue-ladder',r)
for kind,colour in [('firefighter-kit','gold'),('police-kit','police blue')]:
    r=root(kind)
    ball('helmet' if kind=='firefighter-kit' else 'cap',(0,0,1.86),(.34,.29,.18),colour,r)
    cube('brim',(0,-.14,1.78),(.7,.52,.05),colour,r,.06)
    cube('badge',(.16,-.25,1.14),(.12,.025,.13),'gold',r,.02)
    if kind=='firefighter-kit':
        for z in [.86,1.12]:cube('reflective band',(0,-.247,z),(.63,.02,.065),'reflective',r,.012)
        cube('air pack',(0,.29,1.05),(.30,.20,.46),'gold',r,.07)
    batch(r);export(kind,r)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'assets/blender/hookville-emergencies.blend'),compress=True)
