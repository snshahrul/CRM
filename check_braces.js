const fs = require('fs');
const html = fs.readFileSync('C:/Users/shahr/Documents/GitHub/CRM/index_CRM.html','utf8');

// Find renderProjects function to just before renderBugs
const start = html.indexOf('function renderProjects()');
const end = html.indexOf('function renderBugs', start);
const section = html.substring(start, end);

// Count braces more accurately - skip template literals and strings
let depth = 0;
let inTemplate = false;
let inString = false;
let strChar = '';
let minDepth = 0;

for (let i = 0; i < section.length; i++) {
  const c = section[i];
  const prev = i > 0 ? section[i-1] : '';
  
  // Handle template literals (backticks)
  if (c === '`' && !inString) {
    inTemplate = !inTemplate;
    continue;
  }
  
  // Handle strings
  if ((c === "'" || c === '"') && !inTemplate) {
    if (!inString) {
      inString = true;
      strChar = c;
    } else if (strChar === c && prev !== '\\') {
      inString = false;
    }
    continue;
  }
  
  if (inString || inTemplate) continue;
  
  if (c === '{') depth++;
  if (c === '}') {
    depth--;
    if (depth < minDepth) minDepth = depth;
  }
}

console.log('Depth at end of renderProjects section:', depth);
console.log('Minimum depth:', minDepth);
console.log('Section length:', section.length, 'chars');
