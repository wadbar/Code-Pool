import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf8');

const replacements = [
  [/dark:bg-slate-950 bg-slate-50/g, 'bg-[var(--md-sys-color-background)]'],
  [/dark:bg-slate-900 bg-slate-100(\/60)?/g, 'bg-[var(--md-sys-color-surface-container)]'],
  [/dark:bg-slate-800 bg-slate-200(\/[0-9]+)?/g, 'bg-[var(--md-sys-color-surface-container-high)]'],
  [/hover:dark:bg-slate-800 bg-slate-200(\/[0-9]+)?/g, 'hover:bg-[var(--md-sys-color-surface-container-high)]'],
  [/dark:border-slate-850 border-slate-300/g, 'border-[var(--md-sys-color-outline-variant)]'],
  [/dark:border-slate-800 border-slate-200/g, 'border-[var(--md-sys-color-outline-variant)]'],
  [/dark:text-slate-100 text-slate-900/g, 'text-[var(--md-sys-color-on-background)]'],
  [/dark:text-slate-300 text-slate-700/g, 'text-[var(--md-sys-color-on-surface)]'],
  [/dark:text-slate-400 text-slate-600/g, 'text-[var(--md-sys-color-on-surface-variant)]'],
  [/rounded-lg/g, 'rounded-2xl'],
  [/rounded-xl/g, 'rounded-3xl'],
  [/hover:dark:text-slate-200 text-slate-800/g, 'hover:text-[var(--md-sys-color-on-surface)]'],
];

replacements.forEach(([regex, repl]) => {
  content = content.replace(regex, repl);
});

// Import motion
if (!content.includes("from 'motion/react'")) {
  content = content.replace(/from 'lucide-react';/, "from 'lucide-react';\nimport { motion, AnimatePresence } from 'motion/react';");
}

fs.writeFileSync('src/App.tsx', content);

console.log('Refactored App.tsx CSS');
