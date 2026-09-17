const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(relative, dependencies = {}) {
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname,'..',relative),'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const result = {exports:{}};
  vm.runInNewContext(code, {exports:result.exports,module:result,require:name => dependencies[name] || require(name),Date,Map,console});
  return result.exports;
}
const {calculateMetrics} = load('lib/pro-metrics.ts');
const now = new Date(2026,8,17,12);
function customer(created, last = null, design = null) { return {created_at:created,last_visit:last,selected_design:design}; }
test('7-day totals include both boundary days and exclude older/future/invalid timestamps',()=>{
  const rows=[customer(new Date(2026,8,11,0).toISOString()),customer(new Date(2026,8,17,23,59).toISOString()),customer(new Date(2026,8,10,23,59).toISOString()),customer(new Date(2026,8,18,0).toISOString()),customer('invalid'),customer(null)];
  const m=calculateMetrics(rows,7,now);
  assert.equal(m.newClients,2); assert.equal(m.buckets.length,7); assert.equal(m.buckets[0].count,1); assert.equal(m.buckets[6].count,1); assert.equal(m.buckets.reduce((sum,b)=>sum+b.count,0),m.newClients);
});
test('reminders exclude future, missing and exactly 21-day-old visits',()=>{
  const day=86400000;
  const rows=[customer(null,new Date(+now-22*day).toISOString()),customer(null,new Date(+now-21*day).toISOString()),customer(null,new Date(+now+day).toISOString()),customer(null),customer(null,'invalid')];
  assert.equal(calculateMetrics(rows,30,now).overdue,1);
});
test('design ranking counts real choices, handles arbitrary labels and missing values',()=>{
  const m=calculateMetrics([customer(null,null,'French'),customer(null,null,'French'),customer(null,null,'__proto__'),customer(null,null,' '),customer(null)],30,now);
  assert.equal(m.topDesigns[0][0],'French'); assert.equal(m.topDesigns[0][1],2); assert.equal(m.topDesigns.length,2);
});
function fakeDatabase(pages, fail = false) {
  const calls=[];
  const client={from(table){calls.push(['from',table]);const query={select(){return query;},eq(field,value){calls.push(['eq',field,value]);return query;},order(field){calls.push(['order',field]);return query;},range(start,end){calls.push(['range',start,end]);return Promise.resolve({data:pages[start/1000] || [],error:fail ? new Error('denied'):null});}};return query;}};
  return {client,calls};
}
test('client totals fetch beyond the default database page and scope every query to the signed-in user',async()=>{
  const fake=fakeDatabase([Array.from({length:1000},(_,id)=>({id})),[{id:1000}]]);
  const {readProCustomers}=load('lib/pro-overview.ts',{'./supabase':{supabase:fake.client},react:{}});
  const data=await readProCustomers('artist-123');
  assert.equal(data.length,1001);
  assert.equal(fake.calls.filter(c=>c[0]==='eq' && c[1]==='user_id' && c[2]==='artist-123').length,2);
  assert.deepEqual(fake.calls.filter(c=>c[0]==='range'),[['range',0,999],['range',1000,1999]]);
});
test('database failure rejects instead of reporting a misleading zero clients',async()=>{
  const fake=fakeDatabase([],true);
  const {readProCustomers}=load('lib/pro-overview.ts',{'./supabase':{supabase:fake.client},react:{}});
  await assert.rejects(()=>readProCustomers('artist-123'),/denied/);
});
