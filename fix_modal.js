import fs from 'fs';
let content = fs.readFileSync('src/App.tsx', 'utf8');

// Replace the inspectingBlock modal with AnimatePresence
const oldModal = `{/* Dynamic High Fidelity Block Inspector overlay Modal */}\n      {inspectingBlock && (`;

const newModal = `{/* Dynamic High Fidelity Block Inspector overlay Modal */}\n      <AnimatePresence>\n      {inspectingBlock && (`;

content = content.replace(oldModal, newModal);
// Need to replace the div with motion.div and add exit animations
content = content.replace(
  /<div \n          className="fixed inset-0 z-50 flex items-center justify-center bg-black\/75 backdrop-blur-sm p-4 md:p-6 animate-in fade-in duration-200"/g,
  `<motion.div \n          initial={{ opacity: 0 }}\n          animate={{ opacity: 1 }}\n          exit={{ opacity: 0 }}\n          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 md:p-6"`
);

content = content.replace(
  /onClick=\{e => e.stopPropagation\(\)\}\n          >\n            \{\/\* Drawer Head \*\/\}/g,
  `onClick={e => e.stopPropagation()}\n          >\n            {/* Drawer Head */}`
);

// Second div inside the modal
content = content.replace(
  /<div \n            className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-\[85vh\] flex flex-col overflow-hidden shadow-2xl relative animate-in zoom-in-95 duration-150"/g,
  `<motion.div \n            initial={{ scale: 0.95, opacity: 0, y: 20 }}\n            animate={{ scale: 1, opacity: 1, y: 0 }}\n            exit={{ scale: 0.95, opacity: 0, y: 20 }}\n            className="bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)] rounded-3xl w-full max-w-6xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl relative"`
);

// Replace closing tags
const endModalText = `                    </div>\n                  </div>\n                </div>\n              </div>\n            </div>\n          </div>\n        </div>\n      )}`;
const endModalNew = `                    </div>\n                  </div>\n                </div>\n              </div>\n            </div>\n          </motion.div>\n        </motion.div>\n      )}\n      </AnimatePresence>`;
if (content.includes(endModalText)) {
  content = content.replace(endModalText, endModalNew);
} else {
  // Try regex if spacing is weird
  content = content.replace(/<\/div>\n          <\/div>\n        <\/div>\n      \)\}/g, `<\/div>\n          <\/motion.div>\n        <\/motion.div>\n      )}\n      </AnimatePresence>`);
}

fs.writeFileSync('src/App.tsx', content);
console.log('Fixed inspectingBlock modal');
