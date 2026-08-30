#!/usr/bin/env node
/*
 * Generic commissioning-log -> Word builder.
 *   node build_log_docx.js LOG.md OUT.docx
 * Parses a simple markdown dialect (see SKILL.md) and emits a styled .docx,
 * embedding any images referenced as ![caption|w=NNN](relpath). Image paths are
 * resolved relative to the LOG.md directory. Requires the `docx` npm package —
 * run `npm install` in this script's directory once (the installer does this).
 * No other deps — image dimensions are read from file headers.
 */
const fs = require('fs'), path = require('path');

let docx;
try {
  docx = require('docx');
} catch (e) {
  console.error('ERROR: the "docx" package is not installed for this skill.');
  console.error('Fix: cd "' + __dirname + '" && npm install');
  process.exit(1);
}
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, ImageRun,
  Table, TableRow, TableCell, WidthType, ShadingType
} = docx;

const LOG = process.argv[2], OUT = process.argv[3];
if (!LOG || !OUT) {
  console.error('Usage: node build_log_docx.js LOG.md OUT.docx');
  process.exit(1);
}
if (!fs.existsSync(LOG)) {
  console.error('ERROR: log file not found: ' + LOG);
  process.exit(1);
}

const ACCENT="1F4E79", GREY="F2F2F2";
const TAGCOLOR={DONE:"375623",PENDING:"BF8F00",EXPECTED:"1F4E79",FAIL:"C00000"};

function imgSize(buf){ // returns {w,h,type} for png/jpg
  if(buf[0]===0x89&&buf[1]===0x50) return {w:buf.readUInt32BE(16),h:buf.readUInt32BE(20),type:"png"};
  if(buf[0]===0xFF&&buf[1]===0xD8){ let o=2;
    while(o+4<=buf.length){ if(buf[o]!==0xFF){o++;continue;} const m=buf[o+1];
      if(m>=0xC0&&m<=0xCF&&m!==0xC4&&m!==0xC8&&m!==0xCC)
        return {h:buf.readUInt16BE(o+5),w:buf.readUInt16BE(o+7),type:"jpg"};
      o+=2+buf.readUInt16BE(o+2);
    }
  }
  return {w:1200,h:800,type:(buf[0]===0x89?"png":"jpg")};
}

// inline **bold** + leading [TAG]
function runs(text){
  const out=[]; let m;
  if((m=text.match(/^\s*\[(DONE|PENDING|EXPECTED|FAIL)\]\s*/))){
    out.push(new TextRun({text:`[${m[1]}] `,bold:true,color:TAGCOLOR[m[1]]})); text=text.slice(m[0].length);
  }
  text.split(/(\*\*[^*]+\*\*)/).forEach(seg=>{ if(!seg) return;
    if(seg.startsWith("**")&&seg.endsWith("**")) out.push(new TextRun({text:seg.slice(2,-2),bold:true}));
    else out.push(new TextRun(seg));
  });
  return out.length?out:[new TextRun(text)];
}

const dir=path.dirname(LOG);
const lines=fs.readFileSync(LOG,"utf8").split(/\r?\n/);
const kids=[]; let title=null, tbl=null;

function flushTable(){ if(!tbl) return;
  const cols=Math.max(...tbl.map(r=>r.length)), W=9360, cw=Math.floor(W/cols);
  kids.push(new Table({width:{size:W,type:WidthType.DXA},columnWidths:Array(cols).fill(cw),
    rows:tbl.map((r,ri)=>new TableRow({children:Array.from({length:cols},(_,ci)=>new TableCell({
      width:{size:cw,type:WidthType.DXA},
      shading:ri===0?{type:ShadingType.CLEAR,fill:ACCENT,color:"auto"}:{type:ShadingType.CLEAR,fill:GREY,color:"auto"},
      margins:{top:50,bottom:50,left:90,right:90},
      children:[new Paragraph({children:[new TextRun({text:r[ci]||"",bold:ri===0,color:ri===0?"FFFFFF":"000000",size:18})]})]
    }))}))}));
  kids.push(new Paragraph({text:"",spacing:{after:80}})); tbl=null;
}

for(const raw of lines){
  const line=raw.replace(/\s+$/,"");
  let m;
  if(/^\s*\|(.+)\|\s*$/.test(line)){ // table row
    const cells=line.trim().slice(1,-1).split("|").map(s=>s.trim());
    if(cells.every(c=>/^:?-{2,}:?$/.test(c))) continue; // separator
    (tbl=tbl||[]).push(cells); continue;
  } else flushTable();

  if(!line.trim()){ continue; }
  if((m=line.match(/^!\[([^\]]*)\]\(([^)]+)\)/))){ // image
    let cap=m[1], w=620; const wm=cap.match(/\|w=(\d+)/); if(wm){w=parseInt(wm[1]);cap=cap.replace(/\|w=\d+/,"");}
    const p=path.resolve(dir,m[2]);
    if(fs.existsSync(p)){ const buf=fs.readFileSync(p); const s=imgSize(buf); const h=Math.round(w*s.h/s.w);
      kids.push(new Paragraph({children:[new ImageRun({type:s.type,data:buf,transformation:{width:w,height:h}})],spacing:{before:60,after:20}}));
      if(cap.trim()) kids.push(new Paragraph({children:[new TextRun({text:"▲ "+cap.trim(),italics:true,size:17,color:"595959"})],spacing:{after:150}}));
    } else kids.push(new Paragraph({children:[new TextRun({text:`[missing image: ${m[2]}]`,italics:true,color:"C00000"})]}));
    continue;
  }
  if((m=line.match(/^#\s+(.*)/))){ if(!title){title=m[1];
      kids.push(new Paragraph({children:[new TextRun({text:m[1],bold:true,size:38,color:ACCENT})],spacing:{after:120}}));
    } else kids.push(new Paragraph({text:m[1],heading:HeadingLevel.HEADING_1,spacing:{before:220,after:90}}));
    continue; }
  if((m=line.match(/^##\s+(.*)/))){ kids.push(new Paragraph({text:m[1],heading:HeadingLevel.HEADING_1,spacing:{before:200,after:80}})); continue; }
  if((m=line.match(/^###\s+(.*)/))){ kids.push(new Paragraph({text:m[1],heading:HeadingLevel.HEADING_2,spacing:{before:160,after:60}})); continue; }
  if((m=line.match(/^[-*]\s+(.*)/))){ kids.push(new Paragraph({children:runs(m[1]),bullet:{level:0},spacing:{after:50}})); continue; }
  kids.push(new Paragraph({children:runs(line),spacing:{after:100}}));
}
flushTable();

const doc=new Document({creator:"commissioning-logger",title:title||"Commissioning Log",
  sections:[{properties:{page:{size:{width:12240,height:15840},margin:{top:1080,bottom:1080,left:1080,right:1080}}},children:kids}]});
Packer.toBuffer(doc).then(b=>{
  try {
    fs.writeFileSync(OUT,b);
  } catch (e) {
    if (e.code==='EBUSY'||e.code==='EPERM') {
      console.error('ERROR: cannot write '+OUT+' — the document is probably open in Word. Close it and rerun.');
    } else {
      console.error('ERROR: cannot write '+OUT+': '+e.message);
    }
    process.exit(1);
  }
  console.log("wrote",OUT,b.length,"bytes");
}).catch(e=>{console.error('ERROR: docx build failed: '+e.message);process.exit(1);});
