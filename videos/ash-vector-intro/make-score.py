import numpy as np
import wave
from pathlib import Path
sr=48000;duration=20;n=sr*duration;t=np.arange(n)/sr;rng=np.random.default_rng(917);mix=np.zeros(n)
def add(start,signal,volume=1):
 a=int(start*sr);length=min(len(signal),n-a)
 if length>0:mix[a:a+length]+=signal[:length]*volume
def tone(freq,length,slide=None):
 x=np.arange(int(length*sr))/sr
 if slide is None:phase=2*np.pi*freq*x
 else:phase=2*np.pi*(freq*x+(slide-freq)*x*x/(2*length))
 return np.sin(phase)
# Low sustained machinery with evolving minor harmony.
for f in [36.7,55,73.4,110]:mix+=tone(f,duration)*.032*(.7+.3*np.sin(t*.8))
for start in [.15,6,12,16.5]:
 length=2.5;x=np.arange(int(length*sr))/sr;env=np.exp(-x*2)*(1-np.exp(-x*40))
 braam=(tone(55,length,39)+tone(82.4,length,58)+tone(110,length,78))*.25*env
 noise=rng.normal(0,1,len(x));noise=np.convolve(noise,np.ones(25)/25,mode='same')
 add(start,braam+noise*.22*np.exp(-x*3))
for i in range(36):
 start=2+i*.43
 if start>17:break
 x=np.arange(int(.23*sr))/sr
 add(start,tone(105,.23,35)*np.exp(-x*23),.27)
 if i%2: add(start,rng.normal(0,1,len(x))*np.exp(-x*40),.055)
 f=[110,146.83,164.81,130.81][i%4]
 add(start,tone(f,.23)*np.exp(-x*10),.05)
# Rising air preceding the two reveals.
for start in [4.7,10.7,15.4]:
 length=1.1;x=np.arange(int(length*sr))/sr;noise=rng.normal(0,1,len(x));noise=np.convolve(noise,np.ones(7)/7,mode='same');add(start,noise*(x/length)**2,.22)
mix*=np.minimum(t/.4,1)*np.minimum((duration-t)/1.0,1)
mix=np.tanh(mix*1.2);mix/=max(1,np.max(np.abs(mix))/0.86)
stereo=np.column_stack([mix,np.roll(mix,170)*.98]);audio=(stereo*32767).astype('<i2')
out=Path(__file__).parent/'assets'/'score.wav'
with wave.open(str(out),'wb') as w:w.setnchannels(2);w.setsampwidth(2);w.setframerate(sr);w.writeframes(audio.tobytes())
print(out, out.stat().st_size)
