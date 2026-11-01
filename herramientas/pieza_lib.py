"""Matemática de grupos del editor Weeb (madre -> hijos). Euler YXZ como three.js; sin rz."""
import math
import numpy as np

def tf_matrix(t):
    s=t.get('scale',1); sx=t.get('sx',1) or 1; sy=t.get('sy',1) or 1
    rx=math.radians(t.get('rx',0) or 0); ry=math.radians(t.get('rotationY',0) or 0)
    Rx=np.array([[1,0,0],[0,math.cos(rx),-math.sin(rx)],[0,math.sin(rx),math.cos(rx)]])
    Ry=np.array([[math.cos(ry),0,math.sin(ry)],[0,1,0],[-math.sin(ry),0,math.cos(ry)]])
    rz=math.radians(t.get('rz',0) or 0)
    Rz=np.array([[math.cos(rz),-math.sin(rz),0],[math.sin(rz),math.cos(rz),0],[0,0,1]])
    R=Ry@Rx@Rz
    M=np.eye(4); M[:3,:3]=R@np.diag([s*sx,s*sy,s]); M[:3,3]=t.get('position',[0,0,0]); return M

def mat_to_tf(M,base):
    sc=np.linalg.norm(M[:3,:3],axis=0); R=M[:3,:3]/sc
    x=math.asin(-max(-1,min(1,R[1,2])))
    if abs(R[1,2])<0.9999999: y=math.atan2(R[0,2],R[2,2]); z=math.atan2(R[1,0],R[1,1])
    else: y=math.atan2(-R[2,0],R[0,0]); z=0.0
    sz=abs(sc[2]) or 1e-6
    out=dict(base); out.update(position=[round(float(v),4) for v in M[:3,3]],scale=round(float(sz),5),
        sx=round(float(sc[0]/sz),5),sy=round(float(sc[1]/sz),5),rotationY=round(math.degrees(y),4),rx=round(math.degrees(x),4),rz=round(math.degrees(z),4))
    return out
