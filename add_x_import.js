import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf8');

if (!content.includes(', X,')) {
  content = content.replace('from \'lucide-react\';', '  X,\n} from \'lucide-react\';');
}

fs.writeFileSync('src/App.tsx', content);
console.log('Added X to imports');
