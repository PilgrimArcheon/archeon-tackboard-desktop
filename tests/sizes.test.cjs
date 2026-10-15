'use strict';
const test=require('node:test'), assert=require('node:assert/strict');
const {isSize,normalizeSize,boundsFor}=require('../src/sizes.cjs');
test('only supported note sizes can be persisted',()=>{
 assert.equal(normalizeSize('unknown'),'medium');assert.equal(isSize('small'),true);assert.equal(isSize('huge'),false);
});
test('three note sizes increase predictably',()=>{
 const s=boundsFor('small'),m=boundsFor('medium'),l=boundsFor('large');
 assert.ok(s.width<m.width&&m.width<l.width);assert.ok(s.height<m.height&&m.height<l.height);
});
test('compact notes expand without permanently changing the setting',()=>{
 assert.deepEqual(boundsFor('small',true),boundsFor('medium'));
 assert.deepEqual(boundsFor('medium',true),boundsFor('large'));
 assert.ok(boundsFor('large',true).height>boundsFor('large').height);
});
