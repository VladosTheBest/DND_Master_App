// Apply a reviewed extraction using TypeScript property boundaries, never regex
// replacement over whole source text. The input contains public CC-BY SRD text.
import fs from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';
const input=process.argv[2];
assert(input,'Usage: node scripts/apply-srd-spell-text.mjs reviewed.json');
const records=JSON.parse(fs.readFileSync(input,'utf8'));
const count=Object.keys(records).length;
assert([319,339].includes(count));
const file=new URL('../apps/web/src/features/characters/rules-data.ts',import.meta.url);
const source=fs.readFileSync(file,'utf8');
const ast=ts.createSourceFile('rules-data.ts',source,ts.ScriptTarget.Latest,true);
const edits=[];const seen=new Set();
function visit(node){
  if(ts.isObjectLiteralExpression(node)){
    const props=new Map(node.properties.filter(ts.isPropertyAssignment).map(p=>[p.name.getText(ast).replace(/^['"]|['"]$/g,''),p]));
    const id=props.get('id')?.initializer;
    if(id&&ts.isStringLiteral(id)&&records[id.text]){
      assert(!seen.has(id.text),`Duplicate spell object: ${id.text}`);seen.add(id.text);
      const record=records[id.text];
      for(const key of ['description','components','castingTime','range','duration']){
        assert(typeof record[key]==='string'&&record[key].length,`Missing ${id.text}/${key}`);
        const property=props.get(key);
        if(property)edits.push({start:property.initializer.getStart(ast),end:property.initializer.end,text:JSON.stringify(record[key])});
        else {const last=node.properties.at(-1);edits.push({start:last.end,end:last.end,text:`,\n    ${key}: ${JSON.stringify(record[key])}`});}
      }
    }
  }
  ts.forEachChild(node,visit);
}
visit(ast);assert.equal(seen.size,count,'All source objects must match');
let result=source;
for(const edit of edits.sort((a,b)=>b.start-a.start))result=result.slice(0,edit.start)+edit.text+result.slice(edit.end);
assert.equal(ts.createSourceFile('rules-data.ts',result,ts.ScriptTarget.Latest,true).parseDiagnostics.length,0,'Generated TypeScript must parse');
fs.writeFileSync(file,result);
console.log(`Updated ${count} SRD descriptions and component/casting metadata.`);
