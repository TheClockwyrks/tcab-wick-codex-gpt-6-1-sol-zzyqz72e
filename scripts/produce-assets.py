"""One-time art/audio authoring. Requires the run's draw, draw-sheet, sfx-synth and music tools.
The application build uses only the committed outputs, never this script.
"""
import json, math, random, subprocess, pathlib, tempfile
ROOT=pathlib.Path(__file__).resolve().parents[1]
TMP=pathlib.Path(tempfile.mkdtemp(prefix='wick-'))
random.seed(41)
ink='#101b21'; dark='#22383d'; teal='#497a75'; light='#9bb5a0'; gold='#b99052'; amber='#edbc6a'; cream='#fff0b9'; red='#b66c67'
def call(tool,config,*args):
 subprocess.run([tool,'--config',str(config),*map(str,args)],check=True,stdout=subprocess.DEVNULL)
def rect(x,y,w,h,c): return dict(op='fill_rect',x=int(x),y=int(y),width=max(1,int(w)),height=max(1,int(h)),color=c)
def circle(x,y,r,c): return dict(op='fill_circle',cx=int(x),cy=int(y),r=max(0,int(r)),color=c)
def ring(x,y,r,c): return dict(op='stroke_circle',cx=int(x),cy=int(y),r=max(0,int(r)),color=c)
def line(x,y,a,b,c):return dict(op='line',x1=int(x),y1=int(y),x2=int(a),y2=int(b),color=c)
def poly(points,c):
 ops=[]
 for y in range(int(min(p[1] for p in points)),int(max(p[1] for p in points))+1):
  xs=[]
  for a,b in zip(points,points[1:]+points[:1]):
   if min(a[1],b[1])<=y<max(a[1],b[1]):xs.append(a[0]+(y-a[1])*(b[0]-a[0])/(b[1]-a[1]))
  xs.sort()
  for x,z in zip(xs[::2],xs[1::2]):ops.append(rect(math.ceil(x),y,max(1,math.floor(z)-math.ceil(x)+1),1,c))
 return ops
def save(path,w,h,frames):
 out=ROOT/'assets'/path; out.parent.mkdir(parents=True,exist_ok=True)
 if len(frames)==1:
  cfg=TMP/'draw.json';log=TMP/'draw-log.json'
  log.write_text(json.dumps(frames[0]));cfg.write_text(json.dumps(dict(width=w,height=h,background='#00000000',actions=str(log),preview=str(out))))
  call('draw',cfg,'render','--no-layers','--actions',log,'--out',out,'--width',w,'--height',h)
 else:
  out.mkdir(parents=True,exist_ok=True)
  cfg=TMP/'sheet.json'
  cfg.write_text(json.dumps(dict(width=w,height=h,background='#00000000',frames=list(range(len(frames))),actions=str(TMP/'sheet-{frame}.json'),preview=str(out/'{frame}.png'))))
  for i,ops in enumerate(frames):(TMP/f'sheet-{i}.json').write_text(json.dumps(ops))
  
  for i in range(len(frames)):call('draw-sheet',cfg,'render','--no-layers','--actions',TMP/f'sheet-{i}.json','--out',out/f'{i}.png','--width',w,'--height',h)
def person(f):
 b=[0,-1,0,1,0,-1][f]; step=[0,1,2,0,-1,-2][f]
 o=[circle(12,28,8,'#08131588'),rect(8,23,4,7,ink),rect(14,23,4,7,ink),rect(7+step,29,6,2,gold),rect(14-step,29,6,2,gold)]
 o+=poly([(9,11+b),(16,11+b),(20,26),(6,26)],ink)+poly([(10,12+b),(15,12+b),(18,25),(8,25)],dark)
 o += [rect(10,14,2,9,teal),rect(14,13,2,11,gold),rect(10,6+b,8,7,gold),rect(13,7+b,5,5,'#d6ad78'),rect(16,8+b,2,2,ink),rect(7,5+b,12,3,ink),rect(9,2+b,7,4,dark),rect(10,2+b,2,3,teal),rect(15,17+b,6,2,gold),rect(20,15+b,1,9,gold),rect(18,18+b,5,7,ink),rect(19,19+b,3,5,amber),rect(20,19+b,1,3,cream)]
 return o
save('sprites/lamplighter/idle.png',24,32,[person(0)])
save('sprites/lamplighter/walk',24,32,[person(f) for f in range(6)])
ids=['moth','bat','rat','gnat','beetle','wisp','spider','crow','shade','hound','mothwing','owl','dark'];sizes=[20,20,24,16,28,20,28,24,32,36,56,72,80]
for name,n in zip(ids,sizes):
 frames=[]
 for f in range(4):
  c=n//2; bob=[0,1,0,-1][f];o=[]
  def P(ps,col):return poly([(x*n/20,y*n/20+bob) for x,y in ps],col)
  if name in ['moth','mothwing','bat','crow','gnat']:
   tip=[3,6,4,1][f]
   col=light if name in ['moth','mothwing'] else teal if name=='gnat' else '#6b697d'
   o+=P([(10,8),(3,tip),(1,11),(6,15),(10,11),(14,15),(19,11),(17,tip)],ink)
   o+=P([(9,9),(3,tip+1),(2,10),(6,13),(9,11)],col)+P([(11,9),(17,tip+1),(18,10),(14,13),(11,11)],col)
   o+=[circle(c,c+bob,n*.13,dark),rect(c-1,c-4+bob,2,n*.45,gold)]
   if name in ['moth','mothwing']:o += [circle(n*.24,n*.48+bob,n*.09,gold),circle(n*.76,n*.48+bob,n*.09,gold),circle(n*.24,n*.48+bob,n*.035,ink),circle(n*.76,n*.48+bob,n*.035,ink)]
   if name=='crow':o+=P([(11,6),(17,9),(12,11)],gold)
  elif name in ['rat','hound']:
   o+=P([(1,13),(3,7),(10,7),(13,3),(15,7),(19,8),(18,13),(14,14),(14,18),(12,18),(11,14),(6,14),(5,18),(3,18),(3,13)],ink)
   o+=P([(3,11),(5,8),(11,8),(14,5),(15,9),(18,9),(17,12),(12,13),(6,12)],'#6b7770' if name=='rat' else '#6f777e')
   o+=[rect(n*.76,n*.45+bob,2,2,amber),rect(n*.22,n*.72+bob,3,2,gold)]
   if name=='rat':o+=P([(3,12),(1,12),(0,5),(1,5),(2,10)],red)
  elif name in ['beetle','spider']:
   for side in [-1,1]:
    for i in range(3 if name=='beetle' else 4):
     y=(6+i*3)*n/20;dy=(2 if f%2 else -2)*(i%2*2-1)
     o+=poly([(c+side*n*.17,y),(c+side*n*.44,y+dy),(c+side*n*.47,y+dy+3),(c+side*n*.37,y+dy+2),(c+side*n*.15,y+2)],gold if name=='beetle' else '#69877c')
   o += [circle(c,c,n*.29,ink),circle(c,c-1,n*.23,teal),rect(c,c-n*.2,1,n*.42,gold),circle(c,c-n*.28,n*.12,ink),rect(c-3,c-n*.28,2,2,amber),rect(c+2,c-n*.28,2,2,amber)]
  elif name in ['shade','dark','wisp']:
   o+=P([(10,1),(15,5),(16,12),(19,18),(14,16),(12,19),(9,17),(6,19),(1,17),(4,12),(5,5)],ink)
   o+=P([(10,3),(14,6),(13,12),(16,16),(11,15),(8,17),(5,15),(7,9),(6,6)],'#394b54' if name!='wisp' else teal)
   o += [rect(c-n*.18,c-n*.14+bob,n*.12,max(1,n*.035),cream),rect(c+n*.08,c-n*.14+bob,n*.12,max(1,n*.035),cream)]
   if name=='dark':
    o+=P([(5,5),(2,0),(8,3),(10,0),(12,3),(18,0),(15,6)],gold)
    o+=P([(7,12),(10,15),(13,12),(12,17),(10,18),(8,17)],'#090f17')
  elif name=='owl':
   o+=P([(2,2),(7,5),(13,5),(18,2),(17,10),(19,17),(13,16),(10,19),(7,16),(1,17),(3,10)],ink)
   o+=P([(4,4),(8,7),(12,7),(16,4),(15,12),(10,17),(5,12)],'#8e9690')
   o += [circle(n*.33,n*.42+bob,n*.15,gold),circle(n*.67,n*.42+bob,n*.15,gold),circle(n*.33,n*.42+bob,n*.08,ink),circle(n*.67,n*.42+bob,n*.08,ink)]
   o+=P([(8,10),(12,10),(10,13)],amber)
  # Creature-specific contours, independent of palette or scale.
  if name=='wisp':
   o=P([(10,1),(12,5),(16,7),(16,11),(12,16),(14,19),(8,18),(4,14),(3,9),(7,6)],ink)
   o+=P([(10,3),(11,7),(14,8),(13,12),(9,16),(7,13),(6,9)],teal)+[rect(c-3,c-1+bob,2,2,cream),rect(c+2,c-1+bob,2,2,cream)]
  if name=='gnat':
   flap=[-2,1,2,-1][f]
   o=P([(9,6),(10,2),(11,6),(12,11),(10,18),(8,11)],ink)
   o+=P([(9,8),(0,5+flap),(2,10+flap),(8,11)],light)+P([(11,8),(20,5+flap),(18,10+flap),(12,11)],light)+[rect(c,c-2+bob,1,6,gold)]
  if name=='bat':o+=P([(7,8),(7,1),(10,5),(13,1),(13,8)],'#6b697d')
  if name=='mothwing':
   o+=P([(2,11),(4,18),(7,15),(9,20),(10,12)],gold)+P([(18,11),(16,18),(13,15),(11,20),(10,12)],gold)
   o+=P([(8,7),(6,0),(7,1),(10,7),(13,0),(14,0),(12,7)],cream)
  # glints and moving breath give every frame a unique contour
  o += [rect(c-2+f,c-3+bob,1,1,cream)]
  frames.append(o)
 save(f'sprites/enemies/{name}',n,n,frames)
save('sprites/puff',24,24,[[circle(12+math.cos(a)*f*2,12+math.sin(a)*f*2,5-f,'#97a78f88') for a in range(6)] for f in range(4)])
for i,(tier,n) in enumerate(zip(['small','medium','large'],[8,12,16])):
 o=poly([(n/2,0),(n-1,n/2),(n/2,n-1),(0,n/2)],ink)+poly([(n/2,1),(n-2,n/2),(n/2,n-2),(1,n/2)],'#5aa99b')
 o+=poly([(n/2,1),(n/2,n-2),(1,n/2)],'#b1d9b2')+[rect(n/2,2,1,n*.45,cream)]
 if i==2:o+=[rect(2,n/2,2,2,amber),rect(n-4,n/2,2,2,amber)]
 save(f'sprites/gems/{tier}.png',n,n,[o])
# wet cobbles: deterministic, seamless across cell boundaries
o=[rect(0,0,64,64,'#142428')]
for y in range(-16,64,16):
 for x in range(-32,64,32):
  xx=x+(16 if (y//16)%2 else 0)
  o += [rect(xx+1,y+1,30,14,'#1a2d30'),rect(xx+3,y+2,26,1,'#22383a'),rect(xx+29,y+4,1,9,'#101f25')]
for _ in range(35):
 x=random.randrange(64);y=random.randrange(64);o+=[rect(x,y,random.randrange(1,4),1,random.choice(['#263d3c','#18292c','#314340']))]
save('sprites/ground.png',64,64,[o])
weapons=['taper','ember','pin','lantern','halo','oil-splash','spark','shard','sconce','flare','pyre','beacon','hail','chandelier','corona','blaze']
passives=['wick','oil','glass','brass','mirror','bellows','tallow','tinder','soot','lure']
def icon(name):
 o=[]; col=amber if name not in ['shard','glass','mirror','hail'] else '#a9ded3'
 if name in ['taper','pyre','wick','tallow','tinder']:
  o=[rect(10,10,5,11,gold),rect(11,10,2,10,cream),rect(8,20,9,2,dark)]+poly([(12,1),(16,7),(14,11),(10,11),(8,8)],'#d47f48')+poly([(12,4),(14,8),(12,10),(10,8)],cream)
 elif name in ['lantern','chandelier','sconce']:
  o=[ring(12,5,3,gold),rect(7,8,11,13,ink),rect(8,9,9,10,gold),rect(10,10,5,8,amber),rect(12,10,1,8,cream),rect(6,7,13,2,teal),rect(6,20,13,2,teal)]
 elif name in ['halo','corona','lure']:o=[ring(12,12,9,gold),ring(12,12,7,col),circle(12,12,2,cream)]+[rect(11,0,2,5,col),rect(11,19,2,5,col)]
 elif name in ['oil','oil-splash','blaze','lamp-oil','draft']:
  o=[rect(9,3,7,4,gold),rect(10,1,5,2,teal)]+poly([(9,7),(15,7),(19,14),(18,21),(6,21),(5,14)],ink)+poly([(9,9),(15,9),(17,15),(16,19),(8,19),(7,15)],teal)+[rect(9,12,2,5,col)]
 elif name in ['pin','hail','shard','glass','mirror']:o=poly([(14,1),(20,7),(9,21),(4,21),(3,16)],ink)+poly([(14,3),(18,7),(8,19),(5,18)],col)+[rect(12,6,2,6,cream)]
 elif name=='brass':o=poly([(4,3),(12,1),(20,3),(19,15),(12,22),(5,15)],gold)+poly([(7,5),(12,4),(17,5),(16,14),(12,18),(8,14)],dark)+[rect(11,7,2,9,amber)]
 elif name=='bellows':o=poly([(3,6),(14,3),(20,17),(9,20)],gold)+[rect(6,8,9,2,dark),rect(8,12,9,2,dark),rect(10,16,8,2,dark)]
 elif name=='soot':o=[circle(10,14,7,ink),circle(16,15,5,dark),rect(7,9,4,2,teal),rect(12,5,2,3,light)]
 elif name=='spark':o=poly([(15,1),(5,13),(11,13),(8,23),(21,9),(14,9)],col)
 elif name=='flare':
  o=[circle(12,12,5,amber),circle(12,12,2,cream)]
  for a in range(8):o+=poly([(12+math.cos(a*math.pi/4)*7,12+math.sin(a*math.pi/4)*7),(12+math.cos(a*math.pi/4)*11,12+math.sin(a*math.pi/4)*11),(13+math.cos(a*math.pi/4)*7,13+math.sin(a*math.pi/4)*7)],gold)
 else:o=poly([(14,1),(18,9),(16,17),(10,22),(4,17),(6,10)],'#d77c46')+poly([(12,7),(15,14),(11,19),(8,16)],cream)
 if name=='wick':
  o=[rect(5,17,14,4,ink),rect(6,16,12,4,gold)]
  for i in range(6):o += [rect(6+i*2,5+(i%2),2,12,cream),rect(6+i*2,10+(i%2),2,2,teal)]
 if name=='tallow':
  o=[rect(4,10,7,12,gold),rect(13,7,7,15,cream),rect(5,11,2,8,cream),rect(15,8,2,8,gold)]+poly([(7,3),(10,7),(8,10),(5,8)],amber)+poly([(16,0),(19,4),(17,7),(14,5)],amber)
 if name=='tinder':
  o=[rect(4,11,15,10,gold),rect(6,13,11,6,red),rect(9,15,5,1,cream)]+poly([(13,2),(15,3),(9,16),(7,15)],cream)+[circle(14,3,2,'#db7747'),rect(19,3,1,3,amber),rect(18,7,3,1,amber)]
 if name=='oil-splash':
  o=[circle(11,17,8,ink),circle(11,17,6,teal),rect(5,15,10,1,gold)]+poly([(14,1),(19,8),(17,12),(12,12),(10,8)],amber)+[rect(13,6,2,4,cream)]
 if name=='lamp-oil':
  o=[rect(4,10,14,12,ink),rect(5,11,12,10,gold),rect(7,13,8,6,teal),rect(5,5,9,5,gold),rect(7,6,5,3,ink)]+poly([(16,11),(23,7),(23,11),(17,16)],amber)+[rect(10,13,2,6,cream)]
 if name=='glass':
  o=poly([(4,3),(20,3),(17,21),(7,21)],ink)+poly([(6,5),(18,5),(15,19),(9,19)],teal)+[rect(8,6,2,8,cream),rect(8,14,9,1,gold)]
 if name=='mirror':
  o=[circle(12,9,8,gold),circle(12,9,6,ink),circle(12,9,5,teal),rect(10,16,4,7,gold)]+poly([(10,4),(15,4),(9,13),(7,11)],cream)
 if name=='lure':
  o=[ring(12,11,8,teal),rect(4,4,4,10,gold),rect(16,4,4,10,gold),rect(3,2,6,4,cream),rect(15,2,6,4,cream),rect(9,3,6,9,'#00000000'),rect(10,18,4,4,teal)]
 if name=='sconce':
  o=[rect(3,9,3,13,gold),rect(5,16,14,3,gold),rect(16,8,3,10,gold),rect(13,7,9,3,teal),rect(15,2,5,5,amber),rect(16,3,2,3,cream),rect(2,20,8,2,teal)]
 if name=='pin':
  o=poly([(19,1),(22,4),(4,22),(2,20)],ink)+poly([(18,3),(20,4),(4,20),(3,20)],cream)+[circle(18,5,3,gold),circle(18,5,1,ink)]
 if name in ['pyre','beacon','hail','chandelier','corona','blaze']:o+=[rect(1,1,3,3,cream),rect(20,20,3,3,amber)]
 return o
for name in weapons+passives+['lamp-oil']:save(f'icons/{name}.png',24,24,[icon(name)])
for name in ['chest','bread','draft']:
 o=icon('draft') if name=='draft' else [rect(3,7,18,14,ink),rect(4,8,16,12,gold),rect(5,9,14,4,'#d4aa65'),rect(4,13,16,2,ink),rect(10,12,4,5,amber),rect(11,13,2,2,ink)] if name=='chest' else poly([(3,10),(7,6),(17,6),(22,11),(20,18),(5,19),(2,15)],gold)+poly([(4,10),(8,7),(17,7),(20,11),(18,14),(5,15)],'#e3c18b')+[rect(8,8,2,5,cream),rect(14,8,2,5,cream)]
 save(f'sprites/pickups/{name}.png',24,24,[o])
effects=[(120,40,1),(16,16,1),(12,12,1),(28,28,1),(160,160,1),(100,100,1),(80,80,4),(16,16,1),(24,24,4),(128,128,6)]
for idx,name in enumerate(weapons):
 base=idx if idx<10 else [0,1,2,3,4,5][idx-10];w,h,count=effects[base];frames=[];evolved=idx>=10
 for f in range(count):
  o=[];col='#e6dbac' if evolved else amber
  if base==0:
   for y in range(h):
    t=abs(y-h/2)/(h/2);start=int(w*.06+t*w*.25);end=int(w*(1-t*.45));o+=[rect(start,y,max(1,end-start),1,col+'99')]
   o+=poly([(1,h/2),(w*.8,h*.35),(w-1,h/2),(w*.8,h*.55)],cream)
  elif base in [1,2,7]:
   o=poly([(w/2,0),(w-1,h/2),(w/2,h-1),(0,h/2)],'#d88845' if base==1 else teal)+poly([(w/2,2),(w-3,h/2),(w/2,h-3),(2,h/2)],col)+[rect(w/2,3,1,h*.5,cream)]
  elif base in [3,8]:
   scale=w/24
   for a in icon('chandelier' if evolved else 'lantern'):
    b=dict(a)
    for k in ['x','y','width','height','cx','cy','r']: 
     if k in b:b[k]=int(b[k]*scale)
    o.append(b)
   if base==8:o+=[rect(1+f*4,1,2,2,cream)]
  elif base==4:
   o=[ring(w/2,h/2,w/2-2,col+'88'),ring(w/2,h/2,w/2-5,gold+'99')]
   for a in range(16):o+=[circle(w/2+math.cos(a*math.pi/8)*(w/2-4),h/2+math.sin(a*math.pi/8)*(w/2-4),2,cream)]
   if evolved:o+=[ring(w/2,h/2,w/2-12,'#c2e0b366')]
  elif base==5:
   o=[circle(w/2,h/2,w*.48,'#326a5d55'),ring(w/2,h/2,w*.47,gold+'77')]
   for i in range(24):
    a=i*2.4;r=(.1+.35*((i*7)%23)/23)*w;x=w/2+math.cos(a)*r;y=h/2+math.sin(a)*r
    o+=poly([(x,y-7),(x+3,y+2),(x-2,y+3)],col+'aa')
  elif base==6:
   o=[ring(w/2,h/2,w*(.2+f*.09),col+'88')]+poly([(w*.57,0),(w*.32,h*.52),(w*.5,h*.48),(w*.4,h*.96),(w*.7,h*.35),(w*.52,h*.38)],cream)
  else:
   r=w*(.2+f*.055);o=[circle(w/2,h/2,r,'#edbc6a22'),ring(w/2,h/2,r,col+'bb'),ring(w/2,h/2,r-4,'#fff0b966')]
   for a in range(16):
    t=a*math.pi/8;o+=[circle(w/2+math.cos(t)*r,h/2+math.sin(t)*r,2,cream)]
  frames.append(o)
 save(f'sprites/effects/{name}'+('.png' if count==1 else ''),w,h,frames)
# Soft, related chimes, dry transients and low warning tones.
cues=['hit','kill','gem','hurt','level-up','choose','chest','evolve','pickup','fallen','dawn','menu-move','menu-confirm','hum']
for i,name in enumerate(cues):
 cfg=TMP/'sfx.json';dur=2500 if name=='hum' else 1500 if name in ['fallen','dawn','evolve'] else 600 if name in ['level-up','chest'] else 100 if name in ['hit','gem','menu-move'] else 250
 cfg.write_text(json.dumps(dict(sample_rate=22050,channels='mono',max_duration_ms=dur+300,seed=41,actions=str(TMP/'sfx-log.json'),preview=str(TMP/'sfx.png'),wav=str(ROOT/f'assets/audio/{name}.wav'))))
 (ROOT/'assets/audio').mkdir(exist_ok=True)
 call('sfx-synth',cfg,'init')
 freq=[180,640,1046,95,523,784,392,262,659,146,294,740,880,73][i]
 for v in range(3 if name in ['evolve','dawn','level-up','fallen','chest'] else 1):
  voice=f'v{v}';call('sfx-synth',cfg,'add-voice','--name',voice,'--wave','triangle' if name in ['hurt','fallen'] else 'sine','--freq',freq*(1.25**v),'--gain',-23 if name=='hum' else -18,'--start',v*85,'--dur',dur-v*85)
  call('sfx-synth',cfg,'set-envelope','--voice',voice,'--env','swell' if name=='hum' else 'pluck')
  if name in ['hit','hurt','fallen']:call('sfx-synth',cfg,'set-pitch','--voice',voice,'--slide-to',freq*.45,'--over',dur)
 call('sfx-synth',cfg,'render')
# 32-second nocturne: D minor / B-flat / G minor / A, sparse glass melody.
cfg=TMP/'music.json';cfg.write_text(json.dumps(dict(sample_rate=22050,channels='stereo',max_duration_ms=34000,seed=41,actions=str(TMP/'music-log.json'),preview=str(TMP/'music.png'),wav=str(ROOT/'assets/audio/music.wav'),mid=str(ROOT/'assets/audio/music.mid'))))
call('music',cfg,'init');call('music',cfg,'set-tempo','--bpm',120)
for track,wave,gain in [('glass','triangle',.22),('night','sine',.16)]:
 call('music',cfg,'define-track','--name',track,'--instrument',wave)
 # gain is decibels in this tool
 call('music',cfg,'set-track-fx','--track',track,'--gain',-17 if track=='glass' else -21,'--env','pluck' if track=='glass' else 'swell')
for bar,root in enumerate([50,46,43,45]*2):
 for note in [root,root+7,root+12]:call('music',cfg,'add-note','--track','night','--pitch',note,'--t',bar*8,'--dur',8,'--velocity',65)
 for j,note in enumerate([root+24,root+19,root+27,root+24]):call('music',cfg,'add-note','--track','glass','--pitch',note,'--t',bar*8+j*2,'--dur',1.8,'--velocity',52+j*5)
call('music',cfg,'render')
# Circular crossfade joins adjacent samples at the loop seam.
import wave, struct
music_path=ROOT/'assets/audio/music.wav'
with wave.open(str(music_path),'rb') as wav:
 params=wav.getparams();channels=wav.getnchannels();rate=wav.getframerate()
 raw=list(struct.unpack('<'+'h'*params.nframes*channels,wav.readframes(params.nframes)))
overlap=rate//4
for frame in range(overlap):
 t=frame/overlap
 for channel in range(channels):
  front=frame*channels+channel;back=(params.nframes-overlap+frame)*channels+channel
  raw[front]=round(raw[back]*(1-t)+raw[front]*t)
raw=raw[:(params.nframes-overlap)*channels]
with wave.open(str(music_path),'wb') as wav:
 wav.setparams(params);wav.writeframes(struct.pack('<'+'h'*len(raw),*raw))
print('Produced all Wick sprites, animation frames, icons, cues and music.')
# A painted pixel-art street for the frontispiece, composed from original geometry.
o=[rect(0,0,320,360,'#101f25')]
for rr in [110,90,70,50,30]:o+=[circle(180,168,rr,'#1c3032')]
# distant roofs and towers
for i in range(14):
 x=i*26-15;hh=45+(i*37)%80;y=190-hh
 o += [rect(x,y,24,hh,'#17272d')]+poly([(x-3,y),(x+12,y-18),(x+27,y)],'#0e1c23')
 for wy in range(y+12,185,15):o+=[rect(x+9,wy,3,6,'#394536')]
# perspective paving
o+=poly([(130,180),(203,180),(320,360),(0,360)],'#203435')
for yy in range(190,360,12):o+=[rect(0,yy,320,1,'#2b4140')]
for xx in range(-140,460,50):o+=poly([(164,177),(xx,360),(xx+1,360)],'#11262c')
for side in [0,1]:
 for i in range(4):
  width=44-i*5;x=3+i*29 if side==0 else 320-44-i*29;y=15+i*34;hh=300-i*32
  o+=[rect(x,y,width,hh,'#102027'),rect(x+3,y+7,width-6,hh-7,'#1e3337'),rect(x,y+hh-4,width,4,'#0c1a21'),rect(x+width-3,y+7,2,hh-10,'#3c4b43')]
  o+=poly([(x-5,y+8),(x+width/2,y-15),(x+width+4,y+8)],'#0b1920')
  for wy in range(y+22,y+hh-15,35):
   for wx in [x+8,x+width-15]:
    o+=[rect(wx-1,wy-2,9,17,'#0b1b22'),rect(wx,wy,6,12,'#657052' if (wy+i)%3 else '#b89358'),rect(wx+3,wy,1,12,'#233937'),rect(wx,wy+5,6,1,'#233937')]
# antique street lantern
# The lamplight halo is composited in the title view, preserving the street beneath.
o += [rect(217,110,3,145,'#0b181f'),rect(207,255,22,4,'#0b181f'),rect(215,100,7,5,gold),rect(208,104,18,22,ink),rect(210,106,14,17,gold),rect(212,107,10,14,amber),rect(217,107,2,14,cream),rect(207,102,20,3,ink)]
# gutter foliage and brass flecks
for i in range(90):
 x=random.randrange(320);y=random.randrange(250,360)
 if x<70 or x>260:o += [rect(x,y,1,random.randrange(2,7),'#3b5147')]
save('sprites/night.png',320,360,[o])

# Remove sub-millisecond endpoint discontinuities from the short cues.
for cue in cues:
 path=ROOT/f'assets/audio/{cue}.wav'
 with wave.open(str(path),'rb') as wav:
  params=wav.getparams();channels=wav.getnchannels();raw=list(struct.unpack('<'+'h'*params.nframes*channels,wav.readframes(params.nframes)))
 fade=min(params.nframes//8,params.framerate//100)
 for i in range(fade):
  factor=i/max(1,fade-1)
  for ch in range(channels):
   raw[i*channels+ch]=round(raw[i*channels+ch]*factor)
   j=(params.nframes-1-i)*channels+ch;raw[j]=round(raw[j]*factor)
 with wave.open(str(path),'wb') as wav:
  wav.setparams(params);wav.writeframes(struct.pack('<'+'h'*len(raw),*raw))
