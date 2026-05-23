import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf8');

// 1. Rename 'overview' to 'dashboard'
content = content.replace(/useState<'overview'/g, "useState<'dashboard'");
content = content.replace(/\('overview'\)/g, "('dashboard')");
content = content.replace(/(activeTab ===|activeTab !==) 'overview'/g, "$1 'dashboard'");

// 2. Add Recharts monitoring to dashboard (after Health card)
if (!content.includes('import { LineChart')) {
  content = content.replace(/import \{ motion, AnimatePresence \} from 'motion\/react';/g, "import { motion, AnimatePresence } from 'motion/react';\nimport { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';");
}

if (!content.includes('const [resourceData, setResourceData]')) {
  const insertIndex = content.indexOf("const [activeTab");
  const hookCode = `  const [resourceData, setResourceData] = useState<any[]>(Array.from({length: 20}, (_, i) => ({ time: new Date(Date.now() - (19-i)*2000).toLocaleTimeString(), cpu: Math.random() * 30 + 10, memory: Math.random() * 20 + 40 })));\n  useEffect(() => {\n    if (activeTab !== 'dashboard') return;\n    const interval = setInterval(() => {\n      setResourceData(prev => {\n        const newData = [...prev.slice(1), { time: new Date().toLocaleTimeString(), cpu: Math.random() * 30 + 15, memory: Math.random() * 20 + 45 }];\n        return newData;\n      });\n    }, 2000);\n    return () => clearInterval(interval);\n  }, [activeTab]);\n\n`;
  content = content.slice(0, insertIndex) + hookCode + content.slice(insertIndex);
}

const dashAnchor = '{/* Bento Grid layout with real quantifiable numbers */}';
const widgetCode = `            {/* Real-time System Resource Monitoring Widget */}\n            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="md3-card-elevated space-y-4 mb-6">\n              <div className="flex items-center gap-2">\n                <Cpu className="w-5 h-5 text-[var(--md-sys-color-primary)]" />\n                <h3 className="text-lg font-bold font-sans text-[var(--md-sys-color-on-surface)]">System Resources (Live)</h3>\n              </div>\n              <div className="h-[250px] w-full">\n                <ResponsiveContainer width="100%" height="100%">\n                  <LineChart data={resourceData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>\n                    <CartesianGrid strokeDasharray="3 3" stroke="var(--md-sys-color-outline-variant)" opacity={0.3} />\n                    <XAxis dataKey="time" stroke="var(--md-sys-color-on-surface-variant)" fontSize={10} tick={{fill: "var(--md-sys-color-on-surface-variant)"}} />\n                    <YAxis stroke="var(--md-sys-color-on-surface-variant)" fontSize={10} tick={{fill: "var(--md-sys-color-on-surface-variant)"}} unit="%" />\n                    <RechartsTooltip contentStyle={{ backgroundColor: 'var(--md-sys-color-surface-container-high)', border: 'none', borderRadius: '8px', color: 'var(--md-sys-color-on-surface)' }} itemStyle={{ color: 'var(--md-sys-color-primary)' }} />\n                    <Line type="monotone" dataKey="cpu" name="CPU Usage" stroke="var(--md-sys-color-primary)" strokeWidth={2} dot={false} isAnimationActive={false} />\n                    <Line type="monotone" dataKey="memory" name="Memory Usage" stroke="var(--md-sys-color-tertiary)" strokeWidth={2} dot={false} isAnimationActive={false} />\n                  </LineChart>\n                </ResponsiveContainer>\n              </div>\n            </motion.div>\n\n            `;
if (!content.includes('System Resources (Live)')) {
  content = content.replace(dashAnchor, widgetCode + dashAnchor);
}

// 3. HighlightedText Component and apply to file explorer
if (!content.includes('export const HighlightedText')) {
  // Insert at top of file, below imports
  const hlCode = `\nexport const HighlightedText = ({ text, highlight }: { text: string; highlight: string }) => {\n  if (!highlight.trim()) return <>{text}</>;\n  const parts = text.split(new RegExp(\`(\${highlight})\`, 'gi'));\n  return (\n    <>\n      {parts.map((p, i) =>\n        p.toLowerCase() === highlight.toLowerCase() ? (\n          <span key={i} className="bg-yellow-200 dark:bg-yellow-700/50 text-indigo-900 dark:text-yellow-100 font-bold">{p}</span>\n        ) : (\n          <span key={i}>{p}</span>\n        )\n      )}\n    </>\n  );\n};\n`;
  const insertIndex2 = content.indexOf('export interface');
  content = content.slice(0, insertIndex2) + hlCode + content.slice(insertIndex2);
}

// Apply it to the Lego file names
content = content.replace(
  /\{block\.replace\('\.ts', ''\)\}/g,
  `<HighlightedText text={block.replace('.ts', '')} highlight={blockFilter} />`
);

// 4. Refactor colors and rounded classes
const replacements = [
  // Backgrounds
  [/dark:bg-slate-950 bg-slate-50/g, "bg-[var(--md-sys-color-background)]"],
  [/dark:bg-slate-900 bg-slate-100/g, "bg-[var(--md-sys-color-surface-container)]"],
  [/dark:bg-slate-900\/60 bg-white/g, "bg-[var(--md-sys-color-surface-container-high)]"],
  [/dark:bg-slate-900\/60 bg-slate-100\/60/g, "bg-[var(--md-sys-color-surface-container-highest)]"],
  [/dark:bg-slate-800 bg-slate-200(\/40|)/g, "bg-[var(--md-sys-color-surface-variant)]"],
  [/dark:bg-slate-900 bg-black\/20/g, "bg-[var(--md-sys-color-surface-container)]"],
  
  // Text colors
  [/dark:text-slate-100 text-slate-900/g, "text-[var(--md-sys-color-on-background)]"],
  [/dark:text-slate-300 text-slate-700/g, "text-[var(--md-sys-color-on-surface)]"],
  [/dark:text-slate-400 text-slate-600/g, "text-[var(--md-sys-color-on-surface-variant)]"],
  [/dark:text-slate-200 text-slate-800/g, "text-[var(--md-sys-color-on-surface)]"],

  // Borders
  [/dark:border-slate-800 border-slate-200/g, "border-[var(--md-sys-color-outline-variant)]"],
  [/dark:border-slate-850 border-slate-300/g, "border-[var(--md-sys-color-outline-variant)]"],
  
  // Hover Backgrounds
  [/hover:dark:bg-slate-800\/80 hover:bg-slate-200\/50/g, "hover:bg-[var(--md-sys-color-surface-container-highest)]"],
  [/hover:dark:bg-slate-800 hover:bg-slate-300/g, "hover:bg-[var(--md-sys-color-surface-variant)]"],

  // Rounded corners
  [/rounded-2xl/g, "rounded-3xl"],
  [/rounded-xl/g, "rounded-3xl"],
  [/rounded-lg/g, "rounded-3xl"],
];

for (const [regex, repl] of replacements) {
  content = content.replace(regex, repl);
}

// Ensure motion presence on modals
content = content.replace(
  /\{isViewingLog && \(/g,
  '<AnimatePresence>{isViewingLog && ('
).replace(
  /(<LogViewerModal[\s\S]*?\/>\n\s*)<\/div>\n\s*\)/g,
  '$1</motion.div>\n        )'
);

// Write to file
fs.writeFileSync('src/App.tsx', content);
console.log('Update complete!');
