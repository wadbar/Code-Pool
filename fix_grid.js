import fs from 'fs';
let content = fs.readFileSync('src/App.tsx', 'utf8');

// The layout was possibly an absolute-positioned flex/div, let's look for absolute positioning and fix main containers.
// E.g., class="min-h-screen dark:bg-slate-950 bg-slate-50 ..."
content = content.replace(/className="min-h-screen \[.*?\]"/g, 'className="min-h-screen bg-[var(--md-sys-color-background)] text-[var(--md-sys-color-on-background)] font-sans selection:bg-blue-500/20"');

// Fix grid wrapper if needed (we can just inject max-w-7xl mx-auto and grid layout to the main content area)
content = content.replace(/className="max-w-6xl mx-auto space-y-6"/g, 'className="max-w-7xl mx-auto space-y-6 grid grid-cols-1 lg:grid-cols-12 gap-6"');
// Wait, replacing it with a grid on the main wrapper might break if there's no col-span definitions on children.

fs.writeFileSync('src/App.tsx', content);
console.log('Done CSS updates');
