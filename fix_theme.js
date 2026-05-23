import fs from 'fs';
let content = fs.readFileSync('src/App.tsx', 'utf8');

// I added isDarkMode, remove it.
content = content.replace(/const \[isDarkMode, setIsDarkMode\] = useState\(true\);\s*useEffect\(\(\) => \{\s*document\.documentElement\.setAttribute\('data-theme', isDarkMode \? 'dark' \: 'light'\);\s*if \(isDarkMode\) document\.documentElement\.classList\.add\('dark'\);\s*else document\.documentElement\.classList\.remove\('dark'\);\s*\}, \[isDarkMode\]\);\n/g, "");

content = content.replace(/const \[theme, setTheme\] = useState<'dark' \| 'light'>\('dark'\);/g, "const [theme, setTheme] = useState<'dark' | 'light'>('dark');\n  useEffect(() => {\n    document.documentElement.setAttribute('data-theme', theme);\n    if (theme === 'dark') document.documentElement.classList.add('dark');\n    else document.documentElement.classList.remove('dark');\n  }, [theme]);");

fs.writeFileSync('src/App.tsx', content);
console.log('Fixed theme state usage');
