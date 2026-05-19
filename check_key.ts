console.log("GEMINI_API_KEY present:", !!process.env.GEMINI_API_KEY);
console.log("GOOGLE_API_KEY present:", !!process.env.GOOGLE_API_KEY);
console.log("VITE_GEMINI_API_KEY present:", !!process.env.VITE_GEMINI_API_KEY);
console.log("KEYS found:", Object.keys(process.env).filter(k => k.includes("KEY") || k.includes("API")));
