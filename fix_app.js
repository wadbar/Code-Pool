import fs from 'fs';
let content = fs.readFileSync('src/App.tsx', 'utf8');

if (!content.includes('import { LineChart')) {
  content = content.replace(/import \{ motion, AnimatePresence \} from 'motion\/react';/, "import { motion, AnimatePresence } from 'motion/react';\nimport { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';");
}

if (!content.includes('const [resourceData')) {
  const hookCode = `\n  const [resourceData, setResourceData] = useState<any[]>(Array.from({length: 20}, (_, i) => ({ time: new Date(Date.now() - (19-i)*2000).toLocaleTimeString(), cpu: Math.random() * 30 + 10, memory: Math.random() * 20 + 40 })));\n  useEffect(() => {\n    if (activeTab !== 'overview' && activeTab !== 'dashboard') return;\n    const interval = setInterval(() => {\n      setResourceData(prev => {\n        const newData = [...prev.slice(1), { time: new Date().toLocaleTimeString(), cpu: Math.random() * 30 + 15, memory: Math.random() * 20 + 45 }];\n        return newData;\n      });\n    }, 2000);\n    return () => clearInterval(interval);\n  }, [activeTab]);\n`;
  content = content.replace(/(const \[activeTab, setActiveTab\] = useState[^;]+;)/, "$1" + hookCode);
}

fs.writeFileSync('src/App.tsx', content);
console.log('Fixed imports, states and hooks');
