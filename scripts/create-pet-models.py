"""Original articulated breed models. Run through blender-build.py --pets."""
import os, json, math
ROOT = globals().get('PROJECT_ROOT') or os.environ.get('BLENDER_PROJECT_ROOT') or os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# Share the established export/rig conventions, in a separately owned scene.
with open(os.path.join(ROOT, 'scripts/create-blender-assets.py')) as source:
    helpers = source.read().split("for species in ['dog','cat','rabbit','hamster','gerbil','goldfish']:")[0]
PROJECT_ROOT = ROOT
exec(helpers.replace("Louise's asset studio", "Hookville pet studio"))
OUT = os.path.join(ROOT, 'public/models/pets'); os.makedirs(OUT, exist_ok=True)
with open(os.path.join(ROOT, 'src/pet-looks.json')) as source: looks = json.load(source)['looks']

def marker(group, name, position):
    o=root('spot_'+name); o.parent=group; o.location=position

def rig_head(group, parts, position):
    joint=pivot('head_joint',position,parts,group)
    def look(o,clip,t):
        o.rotation_euler.z += (.09 if clip in ['Idle','Sit'] else .035)*math.sin(t)
        o.rotation_euler.x += .025*math.sin(t*2)
    animate_part(joint,look)
    for eye in joint.children:
        if eye.name.split('.')[0] == 'eye': blink(eye)

def blink(eye):
    def pose(o,clip,t):
        if clip in ['Idle','Sit','Read']: o.scale.z*=1-.90*max(0,1-abs(t-4.71)/.40)
    animate_part(eye,pose)

def merge_details(group):
    # Batch static ornament by parent/material, keeping clinical spheres intact.
    buckets={}
    for o in list(group.children_recursive):
        if o.type not in ['MESH','CURVE'] or o.animation_data or o.children: continue
        if o.name.split('.')[0] in ['body','chest','head','paw','muzzle','ear','inner_ear','beak','nose']: continue
        key=(o.parent, o.data.materials[0].name)
        buckets.setdefault(key,[]).append(o)
    for (parent,mat), objects in buckets.items():
        bpy.ops.object.select_all(action='DESELECT')
        for o in objects:o.select_set(True)
        bpy.context.view_layer.objects.active=objects[0]
        bpy.ops.object.convert(target='MESH')
        bpy.ops.object.join()
        bpy.context.object.name='details_'+mat

def pointed_ear(name, s, x, y, z, width, height, color, group):
    mesh=bpy.data.meshes.new(name)
    vertices=[(x-width,y-.045,z),(x+width,y-.045,z),(x+s*.03,y-.025,z+height),
              (x-width,y+.07,z),(x+width,y+.07,z),(x+s*.03,y+.07,z+height)]
    mesh.from_pydata(vertices,[],[(0,1,2),(5,4,3),(0,3,4,1),(1,4,5,2),(2,5,3,0)]);mesh.update()
    o=bpy.data.objects.new(name,mesh);scene.collection.objects.link(o);o.parent=group;mesh.materials.append(materials[color])
    bevel=o.modifiers.new('Rounded ear edges','BEVEL');bevel.width=.018;bevel.segments=3
    if hasattr(mesh,'use_auto_smooth'):mesh.use_auto_smooth=True
    o.modifiers.new('Soft ear normals','WEIGHTED_NORMAL');return o

def mammal(look):
    cat=look['species']=='cat'; style=look['style']; r=root(look['id'])
    r['breed']=look['breed']; r['strideLength']=.64 if cat else .72
    fur=look['id']; accent=fur+' accent'
    material(fur,look['coat']);material(accent,look['accent'])
    slim=style in ['siamese','collie']; coon=look['id']=='cat-ginger'; british=look['id']=='cat-silver'; width=.37 if slim else .44 if coon else .42
    body=ball('body',(0,.18,.65),(width,.67,.42),fur,r)
    animate_part(body,lambda o,c,t: setattr(o.scale,'z',o.scale.z*(1+.009*math.sin(t*2 if c=='Walk' else t))))
    ball('chest',(0,-.30,.73),(.32,.31,.38),accent if style!='tabby' else fur,r)
    head_parts=[]
    def face(name,loc,scale,mat):
        o=ball(name,loc,scale,mat,r);head_parts.append(o);return o
    face('head',(0,-.55,.98),(.35 if slim else .42 if british else .39,.35,.36 if cat else .38),fur)
    for s in [-1,1]:
        face('muzzle',(s*.105,-.84,.87),(.14,.155 if cat else .20,.12),accent if style!='tabby' else 'cream')
    face('nose',(0,-1.015 if not cat else -.976,.91),(.065,.044,.045),'pink' if cat else 'black')
    smile=line('mouth smile',[(-.12,-.961,.82),(0,-.99,.81),(.12,-.961,.82)],.009,'black',r);head_parts.append(smile)
    for s in [-1,1]:
        eye=face('eye',(s*.185,-.864,1.08),(.065,.027,.077),'black')
        iris=face('iris',(s*.185,-.889,1.083),(.039,.013,.048),'blue' if style=='siamese' else 'gold' if cat else 'wood')
        pupil=face('pupil',(s*.185,-.901,1.083),(.012 if cat else .025,.007,.034),'black')
        shine=face('eye_sparkle',(s*.185-.012,-.911,1.106),(.012,.006,.015),'white')
        # Eye layers inherit the blink without losing their authored position.
        bpy.context.view_layer.update()
        for part in [iris,pupil,shine]:
            world=part.matrix_world.copy();part.parent=eye;part.matrix_world=world;head_parts.remove(part)
        face('brow',(s*.19,-.822,1.19),(.085,.035,.034),accent if style=='collie' else fur)
        if cat or style=='terrier':
            for j in range(3):
                whisker=line('whisker',[(s*.13,-.963,.87-j*.025),(s*.37,-.95,.90-j*.045),(s*.52,-.91,.94-j*.075)],.0035,'cream',r);head_parts.append(whisker)
        if cat or style in ['terrier','collie']:
            head_parts.append(pointed_ear('ear',s,s*.27,-.45,1.19,.135,.32 if style=='collie' else .28,accent if style=='siamese' else fur,r))
            head_parts.append(pointed_ear('inner_ear',s,s*.27,-.502,1.23,.077,.17,'pink',r))
        else:
            face('ear',(s*.38,-.43,.98),(.15,.17,.42 if style=='spaniel' else .34),fur if style=='spaniel' else accent)
            for j in range(3):face('ear feather',(s*(.36+j*.028),-.48,.77),(.055,.13,.23),fur)
    if style in ['collie','spaniel','tuxedo']:
        face('face blaze',(0,-.884,1.12),(.05,.016,.13),accent)
    if style in ['retriever','collie','terrier'] or coon:
        for s in [-1,1]:
            for j in range(3):ball('ruff',(s*(.25+j*.036),-.25,.79-j*.08),(.12,.18,.19),accent,r)
    if coon:
        for side in [-1,1]:head_parts.append(pointed_ear('ear tuft',side,side*.30,-.415,1.44,.036,.17,fur,r))
    if style=='terrier':
        for s in [-1,1]:face('beard',(s*.14,-.83,.77),(.13,.13,.14),accent)
    if style=='tabby':
        for j in range(5):
            y=-.10+j*.16
            line('coat stripe',[(width*.97*math.cos(t),y,.65+.405*math.sin(t)) for t in [k*math.pi/12 for k in range(13)]],.010,accent,r)
        for s in [-1,1]:
            for j in range(2):face('cheek stripe',(s*.29,-.79,.98-j*.08),(.082,.022,.019),accent)
    collar=line('collar',[(.325*math.cos(t),-.38,.75+.30*math.sin(t)) for t in [k*math.tau/32 for k in range(33)]],.025,'pink' if cat else 'mint',r)
    ball('name tag',(0,-.705,.61),(.063,.024,.073),'gold',r)
    # Four hip/knee chains: planted half-stride, lifted swing, diagonal gait.
    for x in [-.28,.28]:
        for y in [-.28,.60]:
            pieces=[]
            pieces.append(ball('upper leg',(x,y,.48),(.125,.14,.23),fur,r))
            lower=ball('lower leg',(x,y,.29),(.09,.11,.16),fur,r);pieces.append(lower)
            paw=ball('paw',(x,y-.025,.17),(.14,.21,.15),accent if style in ['collie','tuxedo','spaniel','siamese'] else fur,r);pieces.append(paw)
            if x>0 and y<0:paw['clinicalPaw']=True
            for toe in [-1,0,1]:pieces.append(ball('toe',(x+toe*.067,y-.174,.17),(.042,.058,.069),accent if style in ['collie','tuxedo','spaniel','siamese'] else fur,r))
            leg=pivot('leg_joint',(x,y,.59),pieces,r)
            phase=0 if x*y>0 else math.pi
            def step(o,clip,t,phase=phase,front=y<0):
                if clip=='Walk':o.rotation_euler.x+=.38*math.sin(t+phase)
                elif clip=='Play' and front:o.rotation_euler.x+=-.6+.22*math.sin(t*2+phase)
                elif clip=='Sit':o.rotation_euler.x+=.6
            animate_part(leg,step)
            knee=pivot('knee_joint',(x,y,.32),[lower,paw,*pieces[3:]],r)
            bpy.context.view_layer.update();world=knee.matrix_world.copy();knee.parent=leg;knee.matrix_world=world
            def bend(o,clip,t,phase=phase):
                if clip=='Walk':o.rotation_euler.x-=.46*max(0,math.sin(t+phase))
                elif clip=='Sit':o.rotation_euler.x-=1.0
            animate_part(knee,bend)
    curve=bpy.data.curves.new('Shaped tail','CURVE');curve.dimensions='3D';curve.bevel_depth=.095 if coon else .065 if cat else .11;curve.bevel_resolution=3;curve.resolution_u=10
    spline=curve.splines.new('BEZIER');spline.bezier_points.add(4)
    for j,p in enumerate(spline.bezier_points):
        p.co=(.08+.035*j,.76+j*.13,.78+j*(.09 if cat else .055));p.radius=1-j*.14
        p.handle_left_type='AUTO';p.handle_right_type='AUTO'
    tailmesh=bpy.data.objects.new('tail coat',curve);scene.collection.objects.link(tailmesh);tailmesh.parent=r
    curve.materials.append(materials[accent if style=='siamese' else fur])
    tail=pivot('tail_joint',(.08,.76,.78),[tailmesh],r)
    animate_part(tail,lambda o,c,t:setattr(o.rotation_euler,'z',o.rotation_euler.z+(.12 if cat else .27)*math.sin(t*2)))
    for name,pos in [('ear',(.36,-.48,1.16)),('chest',(0,-.65,.66)),('paw',(.28,-.28,.29)),('coat',(.38,.28,.80)),('mouth',(0,-.99,.88))]:marker(r,name,pos)
    head_parts.append(next(o for o in r.children if o.name.startswith('spot_ear')))
    rig_head(r,head_parts,(0,-.32,.81))
    rest=pivot('rest_joint',(0,0,0),list(r.children),r)
    animate_part(rest,lambda o,c,t:setattr(o.location,'z',o.location.z+(-.16 if c=='Sit' else 0)))
    merge_details(r);export(look['id'],r)
    return r

def animate_bird_part(obj,pose):animate_part(obj,pose,[('Fly',24)])

def bird(look):
    r=root(look['id']);r['breed']=look['breed'];r['strideLength']=.35
    fur=look['id'];accent=fur+' accent';material(fur,look['coat']);material(accent,look['accent'])
    body=ball('body',(0,.08,.61),(.29,.36,.40),fur,r)
    animate_bird_part(body,lambda o,c,t:setattr(o.scale,'z',o.scale.z*(1+.017*math.sin(t))))
    ball('chest',(0,-.18,.65),(.23,.20,.30),accent if look['style']=='budgie' else fur,r)
    parts=[ball('head',(0,-.17,1.02),(.24,.24,.26),accent if look['style']!='canary' else fur,r)]
    for s in [-1,1]:
        eye=ball('eye',(s*.177,-.331,1.066),(.038,.028,.044),'black',r);parts.append(eye)
        parts.append(ball('eye_sparkle',(s*.177-.008,-.355,1.08),(.011,.006,.012),'white',r))
        if look['style']=='cockatiel':parts.append(ball('cheek',(s*.207,-.278,.96),(.045,.04,.067),'pink',r))
    parts.append(ball('beak',(0,-.413,1.015),(.067,.09,.09),'gold' if look['style']=='budgie' else 'cream',r))
    parts.append(ball('beak lower',(0,-.405,.957),(.049,.06,.034),'wood',r))
    if look['style']=='cockatiel':
        for j in range(4):parts.append(ball('crest',(0,-.06+j*.04,1.26+j*.025),(.035,.06,.19-j*.022),accent,r))
    for s in [-1,1]:
        wing_parts=[]
        for j in range(6):
            wing_parts.append(ball('wing feather',(s*(.25+j*.012),.04+j*.065,.70-j*.045),(.075,.22,.115),accent if j%3==0 else fur,r))
        wing=pivot('wing_joint',(s*.25,-.06,.81),wing_parts,r)
        def flutter(o,c,t,s=s):o.rotation_euler.y+=s*((1.0+.65*math.sin(t*3)) if c=='Fly' else .48*math.sin(t*2) if c=='Play' else .045*math.sin(t))
        animate_bird_part(wing,flutter)
        leg_parts=[line('leg',[(s*.115,.01,.31),(s*.115,-.01,.12)],.024,'pink',r)]
        for j in [-1,0,1]:leg_parts.append(line('paw toe',[(s*.115,-.01,.12),(s*.115+j*.04,-.13,.085),(s*.115+j*.05,-.19,.10)],.014,'pink',r))
        leg=pivot('leg_joint',(s*.115,.01,.31),leg_parts,r)
        animate_bird_part(leg,lambda o,c,t,s=s:setattr(o.rotation_euler,'x',o.rotation_euler.x+(.8 if c=='Fly' else .30*s*math.sin(t) if c=='Walk' else .012*math.sin(t))))
    tail_parts=[ball('tail feather',((j-2)*.055,.39,.35),(.044,.30,.047),accent if j%2 else fur,r) for j in range(5)]
    tail=pivot('tail_joint',(0,.28,.42),tail_parts,r)
    animate_bird_part(tail,lambda o,c,t:setattr(o.rotation_euler,'z',o.rotation_euler.z+.09*math.sin(t)))
    rig_head(r,parts,(0,-.08,.86))
    for name,p in [('coat',(.26,.06,.69)),('chest',(0,-.33,.64)),('paw',(.115,-.13,.12)),('mouth',(0,-.47,1.01))]:marker(r,name,p)
    merge_details(r);export(look['id'],r);return r

models=[bird(look) if look['species']=='bird' else mammal(look) for look in looks]
# Simplified original avian anatomy, matching the bird silhouette and feet.
OUT=os.path.join(ROOT,'public/models/examination')
r=root('skeleton-bird');material('bone',(.82,.91,.96))
ball('cranium',(0,-.17,1.02),(.17,.18,.19),'bone',r)
line('beak',[(0,-.29,1.05),(0,-.47,1.01),(0,-.31,.95)],.025,'bone',r)
line('spine',[(0,-.1,.92),(0,.04,.80),(0,.19,.51),(0,.36,.39)],.026,'bone',r)
for j in range(6):
    for s in [-1,1]:line('rib',[(0,.01+j*.037,.8-j*.027),(s*.19,.01+j*.037,.68-j*.025),(s*.12,-.04+j*.037,.48)],.012,'bone',r)
for s in [-1,1]:
    line('wing bones',[(s*.12,0,.8),(s*.28,.16,.65),(s*.30,.35,.44)],.018,'bone',r)
    line('leg bones',[(s*.13,.13,.45),(s*.11,.01,.28),(s*.115,-.01,.12)],.018,'bone',r)
    for j in [-1,0,1]:line('toe bones',[(s*.115,-.01,.12),(s*.115+j*.05,-.17,.09)],.009,'bone',r)
export('skeleton-bird',r)
# Lay out the editable breed collection as an asset contact sheet.
for i,model in enumerate(models):
    model.location=(i%4*2.7,i//4*3,0)
    for o in [model,*model.children_recursive]:o.hide_set(False)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'assets/blender/pet-varieties.blend'), compress=True)
print('Exported eleven original breed models and an avian skeleton.')
