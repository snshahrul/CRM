const fs = require('fs');
const html = fs.readFileSync('C:/Users/shahr/Documents/GitHub/CRM/index_CRM.html','utf8');
const lines = html.split('\n');
let inTemplate = false;
let inString = false;
let strChar = '';
let depth = 0;
let inRenderProjects = false;
let renderProjectsEndLine = 0;

for (let lineNum = 0; lineNum < lines.length; lineNum++) {
  const line = lines[lineNum];
  
  if (line.indexOf('function renderProjects()') >= 0) inRenderProjects = true;
  if (line.indexOf('function renderBugs') >= 0 && inRenderProjects) {
    console.log('renderBugs starts at line', lineNum + 1, '- depth at this point:', depth);
    break;
  }
  
  if (!inRenderProjects) continue;
  
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    const prev = i > 0 ? line[i-1] : '';
    
    if (c === '`' && !inString) { inTemplate = !inTemplate; continue; }
    if ((c === "'" || c === '"') && !inTemplate) {
      if (!inString) { inString = true; strChar = c; }
      else if (strChar === c && prev !== '\\') { inString = false; }
      continue;
    }
    if (inString || inTemplate) continue;
    
    if (c === '{') depth++;
    if (c === '}') {
      depth--;
      if (depth < 0) {
        console.log('EXTRA CLOSING BRACE at line', lineNum + 1);
        console.log('  Content:', line.trim().substring(0, 150));
        renderProjectsEndLine = lineNum;
        depth = 0; // reset to continue checking
      }
    }
  }
}
