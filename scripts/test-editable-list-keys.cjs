const ts=require('typescript');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');

const attributes=node=>(ts.isJsxElement(node)?node.openingElement:node).attributes.properties.filter(ts.isJsxAttribute);
function dependencies(node){
 const out=new Set();
 function visit(n){if(ts.isPropertyAccessExpression(n)||ts.isElementAccessExpression(n))out.add(n.getText().replace(/\?\./g,'.'));ts.forEachChild(n,visit);}
 visit(node);return out;
}
// Values indexed by an immutable ID, membership checks and option values do not edit that ID.
function editableValues(node){
 if(ts.isPropertyAccessExpression(node)||ts.isElementAccessExpression(node))return [node.getText().replace(/\?\./g,'.')];
 if(ts.isParenthesizedExpression(node)||ts.isAsExpression(node)||ts.isNonNullExpression(node))return editableValues(node.expression);
 if(ts.isBinaryExpression(node))return [ts.SyntaxKind.QuestionQuestionToken,ts.SyntaxKind.BarBarToken,ts.SyntaxKind.AmpersandAmpersandToken,ts.SyntaxKind.PlusToken,ts.SyntaxKind.MinusToken].includes(node.operatorToken.kind)?[...editableValues(node.left),...editableValues(node.right)]:[];
 if(ts.isConditionalExpression(node))return [...editableValues(node.whenTrue),...editableValues(node.whenFalse)];
 if(ts.isTemplateExpression(node))return node.templateSpans.flatMap(span=>editableValues(span.expression));
 if(ts.isCallExpression(node)&&['String','Number','Boolean'].includes(node.expression.getText()))return node.arguments.flatMap(editableValues);
 return [];
}
function findEditableKeyIssues(text,file='fixture.tsx'){
 const source=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 const issues=[];let containers=0;
 function visit(node){
  if(ts.isJsxElement(node)||ts.isJsxSelfClosingElement(node)){
   const key=attributes(node).find(attr=>attr.name.getText()==='key');
   if(key?.initializer&&ts.isJsxExpression(key.initializer)&&key.initializer.expression){
    const keyValues=dependencies(key.initializer.expression),fieldValues=[];
    function fields(child){
     if(ts.isJsxElement(child)||ts.isJsxSelfClosingElement(child)){
      const attrs=attributes(child);
      if(attrs.some(attr=>['onChange','onInput'].includes(attr.name.getText()))&&!attrs.some(attr=>attr.name.getText()==='readOnly'&&(!attr.initializer||(ts.isJsxExpression(attr.initializer)&&attr.initializer.expression?.kind===ts.SyntaxKind.TrueKeyword)))){
       const type=attrs.find(attr=>attr.name.getText()==='type')?.initializer;
       const option=type&&ts.isStringLiteral(type)&&['radio','checkbox'].includes(type.text);
       for(const attr of attrs.filter(attr=>attr.name.getText()==='checked'||(!option&&attr.name.getText()==='value'))){
        if(attr.initializer&&ts.isJsxExpression(attr.initializer)&&attr.initializer.expression)fieldValues.push(...editableValues(attr.initializer.expression));
       }
      }
     }
     ts.forEachChild(child,fields);
    }
    fields(node);
    if(fieldValues.length){containers++;const overlap=[...keyValues].filter(value=>fieldValues.includes(value));if(overlap.length){const loc=source.getLineAndCharacterOfPosition(key.getStart());issues.push({file:file.split(path.sep).join('/'),line:loc.line+1,key:key.initializer.getText(),mutableFields:overlap});}}
   }
  }
  ts.forEachChild(node,visit);
 }
 visit(source);return {containers,issues};
}
module.exports={findEditableKeyIssues};
if(require.main===module){
 const fixtures=[
  ['<article key={row.name}><input value={row.name} onChange={change}/></article>',1],
  ['<article key={`${slot.level}-${index}`}><input value={slot.level??""} onChange={change}/></article>',1],
  ['<article key={row.name}><input value={String(row.name)} onChange={change}/></article>',1],
  ['<article key={row.id}><input value={row.name} onChange={change}/></article>',0],
  ['<article key={operation.key}><select value={decisions[operation.key]??""} onChange={change}/></article>',0],
  ['<label key={session.id}><input type="checkbox" checked={selected.includes(session.id)} onChange={change}/></label>',0],
  ['<label key={option.id}><input type="radio" value={option.id} checked={option.id===selected} onChange={change}/></label>',0],
  ['<article key={row.name}><input value={row.name} readOnly/></article>',0],
  ['<article key={row.name}><input value={row.name} readOnly={false} onChange={change}/></article>',1]
 ];
 for(const [text,count] of fixtures)assert.equal(findEditableKeyIssues(text).issues.length,count,text);
 const issues=[];let containers=0,files=0;
 function scan(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())scan(file);else if(file.endsWith('.tsx')){files++;const result=findEditableKeyIssues(fs.readFileSync(file,'utf8'),file);containers+=result.containers;issues.push(...result.issues);}}}
 scan('apps/web/src');const report={files,editableContainers:containers,issues};
 if(process.argv.includes('--json'))console.log(JSON.stringify(report,null,2));else console.log(`Editable list keys: ${files} TSX files, ${containers} keyed editing containers, ${issues.length} mutable-key issues`);
 if(issues.length){if(!process.argv.includes('--json'))console.error(JSON.stringify(issues,null,2));process.exitCode=1;}
}
