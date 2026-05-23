import fs from 'fs';
let content = fs.readFileSync('src/App.tsx', 'utf8');

const dashAnchor = '{/* Bento Grid layout with real quantifiable numbers */}';
const widgetCode = `            {/* Real-time System Resource Monitoring Widget */}\n            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="md3-card-elevated space-y-4 mb-6">\n              <div className="flex items-center gap-2">\n                <Cpu className="w-5 h-5 text-[var(--md-sys-color-primary)]" />\n                <h3 className="text-lg font-bold font-sans text-[var(--md-sys-color-on-surface)]">System Resources (Live)</h3>\n              </div>\n              <div className="h-[250px] w-full">\n                <ResponsiveContainer width="100%" height="100%">\n                  <LineChart data={resourceData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>\n                    <CartesianGrid strokeDasharray="3 3" stroke="var(--md-sys-color-outline-variant)" opacity={0.3} />\n                    <XAxis dataKey="time" stroke="var(--md-sys-color-on-surface-variant)" fontSize={10} tick={{fill: "var(--md-sys-color-on-surface-variant)"}} />\n                    <YAxis stroke="var(--md-sys-color-on-surface-variant)" fontSize={10} tick={{fill: "var(--md-sys-color-on-surface-variant)"}} unit="%" />\n                    <RechartsTooltip contentStyle={{ backgroundColor: 'var(--md-sys-color-surface-container-high)', border: 'none', borderRadius: '8px', color: 'var(--md-sys-color-on-surface)' }} itemStyle={{ color: 'var(--md-sys-color-primary)' }} />\n                    <Line type="monotone" dataKey="cpu" name="CPU Usage" stroke="var(--md-sys-color-primary)" strokeWidth={2} dot={false} isAnimationActive={false} />\n                    <Line type="monotone" dataKey="memory" name="Memory Usage" stroke="var(--md-sys-color-tertiary)" strokeWidth={2} dot={false} isAnimationActive={false} />\n                  </LineChart>\n                </ResponsiveContainer>\n              </div>\n            </motion.div>\n\n            `;

if (!content.includes('System Resources (Live)') && content.includes(dashAnchor)) {
  content = content.replace(dashAnchor, widgetCode + dashAnchor);
}

// Ensure theme toggle is properly implemented
if (!content.includes('document.documentElement.setAttribute(')) {
    const toggleCode = `  const [isDarkMode, setIsDarkMode] = useState(true);\n  useEffect(() => {\n    document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');\n    if (isDarkMode) document.documentElement.classList.add('dark');\n    else document.documentElement.classList.remove('dark');\n  }, [isDarkMode]);\n`;
    content = content.replace(/(const \[realScanData, setRealScanData\] = useState[^;]+;)/, "$1\n" + toggleCode);
}

// Find existing dark mode toggle button in App.tsx if any, and replace its action
content = content.replace(/<button[^>]*>\s*<Moon[^>]*\/>\s*<\/button>/g, `<button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 rounded-full hover:bg-[var(--md-sys-color-surface-variant)] transition-colors"><Moon className="w-5 h-5 text-[var(--md-sys-color-on-surface-variant)]" /></button>`);
content = content.replace(/<button[^>]*>\s*<Sun[^>]*\/>\s*<\/button>/g, `<button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 rounded-full hover:bg-[var(--md-sys-color-surface-variant)] transition-colors"><Sun className="w-5 h-5 text-[var(--md-sys-color-on-surface-variant)]" /></button>`);


fs.writeFileSync('src/App.tsx', content);
console.log('Fixed widget and theme toggle');
