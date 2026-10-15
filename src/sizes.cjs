'use strict';
// Pixel dimensions are Electron device-independent pixels (DIP).
const DIMENSIONS=Object.freeze({
  small:Object.freeze({width:188,height:206}),
  medium:Object.freeze({width:270,height:310}),
  large:Object.freeze({width:338,height:394}),
  'large-expanded':Object.freeze({width:390,height:455}),
});
const isSize=value=>value==='small'||value==='medium'||value==='large';
const normalizeSize=value=>isSize(value)?value:'medium';
function boundsFor(size,expanded=false){
  const current=normalizeSize(size);
  if(!expanded)return {...DIMENSIONS[current]};
  if(current==='small')return {...DIMENSIONS.medium};
  if(current==='medium')return {...DIMENSIONS.large};
  return {...DIMENSIONS['large-expanded']};
}
module.exports={DIMENSIONS,isSize,normalizeSize,boundsFor};
