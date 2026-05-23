import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf8');

// The line we are looking for is like:
// className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 transition-all hover:shadow-md flex flex-col justify-between"

// We will change it to motion.div
content = content.replace(
  /<div className="([^"]*)rounded-3xl p-6 transition-all hover:shadow-md flex flex-col justify-between">/g,
  '<motion.div whileHover={{ y: -4, boxShadow: "var(--shadow-elevation-3)" }} transition={{ duration: 0.2, ease: "easeOut" }} className="$1rounded-3xl p-6 md3-card-elevated flex flex-col justify-between">'
);

// Close tags for those div
content = content.replace(
  /<\/div>\n\s*\{\/\* Card 2: Lego Blocks \*\/\}/g,
  '<\/motion.div>\n\n              {/* Card 2: Lego Blocks */}'
).replace(
  /<\/div>\n\s*\{\/\* Card 3: Blueprints \*\/\}/g,
  '<\/motion.div>\n\n              {/* Card 3: Blueprints */}'
).replace(
  /<\/div>\n\s*\{\/\* Card 4: Files Ingested \*\/\}/g,
  '<\/motion.div>\n\n              {/* Card 4: Files Ingested */}'
).replace(
  /<\/div>\n\s*<\/div>\n\n\s*\{\/\* Controle de Daemons Integrado \*\/\}/g,
  '<\/motion.div>\n            <\/div>\n\n            {/* Controle de Daemons Integrado */}'
);

fs.writeFileSync('src/App.tsx', content);
console.log('Cards converted to motion.div');
