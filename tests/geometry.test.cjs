const test=require('node:test');const assert=require('node:assert/strict');
const {closestDisplay,fitToWorkArea,snap,initialBounds}=require('../src/geometry.cjs');
const displays=[{id:1,workArea:{x:0,y:0,width:1920,height:1040}}, {id:2,workArea:{x:-1920,y:-250,width:1920,height:1080}}];
test('initial notes cascade within the selected monitor',()=>{
 for(let i=0;i<18;i++){const b=initialBounds(i,displays[1]);assert.ok(b.x>=-1920);assert.ok(b.y>=-250);assert.ok(b.x+b.width<=0);}
});
test('snaps note to every monitor edge',()=>{
 const b=snap({x:-280,y:-238,width:270,height:310},displays);assert.equal(b.x,-282);assert.equal(b.y,-238);
 const c=snap({x:1641,y:715,width:270,height:310},displays);assert.equal(c.x,1638);assert.equal(c.y,718);
});
test('preserves negative screen positions and clamps disconnected monitor notes',()=>{
 const b={x:-1600,y:-100,width:270,height:310};assert.equal(closestDisplay(b,displays).id,2);
 const fit=fitToWorkArea(b,[displays[0]]);assert.equal(fit.x,12);assert.equal(fit.y,12);
});
