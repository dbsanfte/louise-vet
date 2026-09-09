"""Original pavement lamps, hydrants, and discreet dog-walk cleanup props."""
import os, math, bpy
ROOT=globals().get('PROJECT_ROOT') or os.environ.get('BLENDER_PROJECT_ROOT') or os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROJECT_ROOT=ROOT
with open(os.path.join(ROOT,'scripts/create-blender-assets.py')) as f:
    helpers=f.read().split("for species in ['dog','cat','rabbit','hamster','gerbil','goldfish']:")[0]
exec(helpers.replace("Louise's asset studio",'Hookville street detail studio'))
OUT=os.path.join(ROOT,'public/models/town');os.makedirs(OUT,exist_ok=True)
material('hydrant red',(.78,.19,.13));material('warm lamp',(.98,.81,.43));material('poo brown',(.28,.16,.085))
shader=materials['warm lamp'].node_tree.nodes.get('Principled BSDF')
shader.inputs['Emission' if 'Emission' in shader.inputs else 'Emission Color'].default_value=(1,.69,.24,1)
shader.inputs['Emission Strength'].default_value=.65
r=root('lamppost')
cyl('foot',(0,0,.06),.20,.12,'dark',r);cyl('post',(0,0,1.55),.055,3.0,'dark',r)
line('curved arm',[(0,0,2.85),(0,0,3.10),(0,-.15,3.20),(0,-.38,3.20),(0,-.50,3.08)],.045,'dark',r)
cyl('shade',(0,-.50,3.06),.23,.085,'dark',r)
ball('warm lantern',(0,-.50,2.95),(.14,.14,.15),'warm lamp',r)
export('lamppost',r)
r=root('hydrant')
cyl('base',(0,0,.04),.20,.08,'dark',r);cyl('barrel',(0,0,.33),.12,.56,'hydrant red',r)
ball('cap',(0,0,.64),(.15,.15,.12),'hydrant red',r)
for x in [-.16,.16]:
    cyl('outlet',(x,0,.38),.08,.18,'hydrant red',r).rotation_euler.y=math.pi/2
    cyl('cap bolt',(x*1.5,0,.38),.045,.05,'cream',r).rotation_euler.y=math.pi/2
export('hydrant',r)
r=root('dog-poo')
for x,y,z,scale in [(-.055,0,.035,(.09,.065,.045)),(.055,0,.036,(.075,.07,.047)),(0,.025,.081,(.06,.055,.047))]:ball('small rounded pile',(x,y,z),scale,'poo brown',r)
export('dog-poo',r)
r=root('cleanup-bag')
ball('bag',(0,0,.10),(.11,.07,.14),'mint',r)
line('tied handle',[(-.04,0,.22),(-.045,0,.30),(.045,0,.30),(.04,0,.22)],.012,'mint',r)
export('cleanup-bag',r)
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'assets/blender/hookville-street-details.blend'),compress=True)
