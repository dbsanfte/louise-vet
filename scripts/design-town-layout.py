"""Author Hookville's shared road, pavement and lot plan (game X/Z coordinates)."""
import json, math
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent

def curve(knots):
    out=[]
    for i in range(len(knots)-1):
        a,b,c,d=knots[max(0,i-1)],knots[i],knots[i+1],knots[min(len(knots)-1,i+2)]
        steps=max(2,math.ceil(math.dist(b,c)/2))
        for j in range(steps):
            t=j/steps
            out.append([round(.5*((2*b[k])+(-a[k]+c[k])*t+(2*a[k]-5*b[k]+4*c[k]-d[k])*t*t+(-a[k]+3*b[k]-3*c[k]+d[k])*t**3),3) for k in range(2)])
    return out+[knots[-1]]
# Keep the two established zebra crossings on a clear, straight section.
main=[[-30,0],[-26,0],[-24,0],[-18,0],[-12,0],[-4,0],[4,0],[12,0],[18,0],[24,0],[30,0]]
roads=[{'name':'High Street','points':main},
 {'name':'Willow Crescent','points':curve([[-30,0],[-35,-12],[-27,-23],[-12,-26],[4,-25],[20,-21],[31,-12],[30,0]])},
 {'name':'Orchard Lane','points':curve([[-30,0],[-34,12],[-24,24],[-8,27],[8,24],[25,19],[33,10],[30,0]])}]
nodes=[];edges=[];sideids=[]
def node(p):
    nodes.append({'x':round(p[0],3),'z':round(p[1],3)});return len(nodes)-1
for road in roads:
    points=road['points']
    def inset(a,b):
        d=math.dist(a,b);return [a[k]+(b[k]-a[k])/d*4 for k in range(2)]
    stations=[inset(points[0],points[1])]+[p for p in points[1:-1] if math.dist(p,points[0])>4.1 and math.dist(p,points[-1])>4.1]+[inset(points[-1],points[-2])]
    road['walkPoints']=stations
    sides=[]
    for side in [-1,1]:
        ids=[]
        for i,p in enumerate(stations):
            a=stations[max(0,i-1)];b=stations[min(len(stations)-1,i+1)]
            dx,dz=b[0]-a[0],b[1]-a[1];l=math.hypot(dx,dz)
            ids.append(node([p[0]-dz/l*3*side,p[1]+dx/l*3*side]))
            if len(ids)>1:edges.append([ids[-2],ids[-1]])
        sides.append(ids)
    sideids.append(sides)
crossings=[]
for x in [-18,18]:
    i=roads[0]['walkPoints'].index([x,0]);a,b=sideids[0][0][i],sideids[0][1][i]
    edges.append([a,b]);crossings.append([a,b])
# Join the six inset kerbs in geometric order. Across each road mouth is a
# zebra crossing; links round the three corners remain ordinary pavement.
for end in [0,-1]:
    centre=roads[0]['points'][end]
    ids=sorted([side[end] for road in sideids for side in road],key=lambda i:math.atan2(nodes[i]['z']-centre[1],nodes[i]['x']-centre[0]))
    pairs=[{road[0][end],road[1][end]} for road in sideids]
    for i,a in enumerate(ids):
        b=ids[(i+1)%len(ids)];edges.append([a,b])
        if {a,b} in pairs:crossings.append([a,b])
# A park path joins the eastern crossing, clear of the carriageway.
park=node([22,-6]);edge=node([22,-3]);edges.extend([[sideids[0][0][roads[0]['walkPoints'].index([18,0])],edge],[edge,park],[edge,sideids[0][0][roads[0]['walkPoints'].index([24,0])]]])
owners=['Amelia','Oliver','Sophie','Noah','Isla','Leo','Grace','Freddie','Ava','Oscar','Mia','Ethan','Ruby','Archie','Lily','Theo']
positions=[[-12,-8],[-4,-8],[4,-8],[12,-8],[-12,8],[-4,8],[4,8],[12,8],[-27,-33],[-12,-35],[5,-34],[25,-29],[-27,34],[-10,37],[8,34],[28,27]]
lots=[]
for i,(owner,pos) in enumerate(zip(owners,positions)):
    nearest=min(range(len(nodes)),key=lambda j:math.hypot(nodes[j]['x']-pos[0],nodes[j]['z']-pos[1]))
    n=nodes[nearest];angle=math.atan2(n['x']-pos[0],n['z']-pos[1])
    lots.append({'id':i,'x':pos[0],'z':pos[1],'facing':round(angle,5),'gate':nearest,'kind':'Flat' if i in [3,5,10,15] else 'House','owners':[owner]+(['Zara'] if i==10 else ['Max'] if i==15 else []),'asset':f'home-{i:02d}'})
layout={'roads':roads,'nodes':nodes,'edges':edges,'crossings':crossings,'lots':lots,'park':park,'clinic':{'x':-24,'z':-7,'scale':.7,'rotation':-math.pi/2}}
(ROOT/'src/town-layout.json').write_text(json.dumps(layout,indent=2)+'\n')
