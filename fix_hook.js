import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf8');

// The hook I added:
const hookCode = `  const [resourceData, setResourceData] = useState<any[]>(Array.from({length: 20}, (_, i) => ({ time: new Date(Date.now() - (19-i)*2000).toLocaleTimeString(), cpu: Math.random() * 30 + 10, memory: Math.random() * 20 + 40 })));\n  useEffect(() => {\n    if (activeTab !== 'dashboard') return;\n    const interval = setInterval(() => {\n      setResourceData(prev => {\n        const newData = [...prev.slice(1), { time: new Date().toLocaleTimeString(), cpu: Math.random() * 30 + 15, memory: Math.random() * 20 + 45 }];\n        return newData;\n      });\n    }, 2000);\n    return () => clearInterval(interval);\n  }, [activeTab]);\n\n`;

// Let's remove it first
content = content.replace(hookCode, '');

// And insert it properly after activeTab:
const insertionAnchor = "const [activeTab, setActiveTab] = useState<'dashboard' | 'repos' | 'legos' | 'sandbox' | 'activity' | 'logs' | 'ai'>('dashboard');";
content = content.replace(insertionAnchor, insertionAnchor + '\n' + hookCode);

// Also add isGitModalOpen:
if (!content.includes('const [isGitModalOpen')) {
  // Let's find gitAutoPush
  const gitHasTokenAnchor = "const [gitPushing, setGitPushing] = useState(false);";
  content = content.replace(gitHasTokenAnchor, gitHasTokenAnchor + "\\n  const [isGitModalOpen, setIsGitModalOpen] = useState(false);");
}

fs.writeFileSync('src/App.tsx', content);
console.log('Fixed hook order and missing state!');
