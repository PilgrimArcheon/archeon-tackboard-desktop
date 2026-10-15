'use strict';
// Pure, display-aware positioning. Electron's display workArea coordinates are
// global DIP coordinates (including negative values on left/top monitors).
const margin = 12;
const clamp = (value,min,max) => Math.min(max,Math.max(min,value));
const intersects = (a,b) => a.x < b.x+b.width && a.x+a.width>b.x && a.y < b.y+b.height && a.y+a.height>b.y;
function distanceToRect(x,y,rect){
  const dx=Math.max(rect.x-x,0,x-(rect.x+rect.width));
  const dy=Math.max(rect.y-y,0,y-(rect.y+rect.height));return dx*dx+dy*dy;
}
function closestDisplay(bounds,displays){
  if(!displays.length)throw Error('No screens');
  const x=bounds.x+bounds.width/2,y=bounds.y+bounds.height/2;
  return displays.find(d=>intersects(bounds,d.workArea)) || displays.reduce((a,b)=>distanceToRect(x,a.workArea)<=distanceToRect(x,b.workArea)?a:b);
}
function fitToWorkArea(bounds, displays){
  const area=closestDisplay(bounds,displays).workArea;
  return {...bounds, x:clamp(bounds.x,area.x+margin,Math.max(area.x+margin,area.x+area.width-bounds.width-margin)),
    y:clamp(bounds.y,area.y+margin,Math.max(area.y+margin,area.y+area.height-bounds.height-margin))};
}
function snap(bounds,displays,threshold=30){
  const area=closestDisplay(bounds,displays).workArea;
  const fitted=fitToWorkArea(bounds,displays);
  const left=area.x+margin, right=area.x+area.width-margin-bounds.width;
  const top=area.y+margin,bottom=area.y+area.height-margin-bounds.height;
  if(Math.abs(fitted.x-left)<=threshold)fitted.x=left;
  else if(Math.abs(fitted.x-right)<=threshold)fitted.x=right;
  if(Math.abs(fitted.y-top)<=threshold)fitted.y=top;
  else if(Math.abs(fitted.y-bottom)<=threshold)fitted.y=bottom;
  return fitted;
}
function initialBounds(index,display,width=270,height=300){
  const area=display.workArea;
  const step=index%9;
  return fitToWorkArea({x:area.x+area.width-width-24-step*24,y:area.y+24+step*28,width,height},[display]);
}
module.exports={closestDisplay,fitToWorkArea,snap,initialBounds};
