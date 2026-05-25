const fs = require('fs');
const html = fs.readFileSync('C:/Users/shahr/Documents/GitHub/CRM/index_CRM.html','utf8');

const start = html.indexOf('function renderProjects()');
const end = html.indexOf('function renderBugs', start);
const section = html.substring(start, end);

let depth = 0;
let inTemplate = false;
let inString = false;
let strChar = '';
let lineNum = 1 + html.substring(0,start).split('\n').length - 1; // approximate line number

for (let i = 0; i < section.length; i++) {
  const c = section[i];
  const prev = i > 0 ? section[i-1] : '';
  
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
      console.log('Depth went negative at approx line', lineNum);
      // Find the actual line content
      const lineStart = section.lastIndexOf('\n', i) + 1;
      const lineEnd = section.indexOf('\n', i);
      const line = section.substring(lineStart, lineEnd > 0 ? lineEnd : section.length);
      console.log('  Content:', line.trim().substring(0, 120));
      break;
    }
  }
  if (c === '\n') lineNum++;
}
