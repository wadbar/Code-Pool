fetch('http://localhost:3000/api/pool/ingest-all', { method: 'POST' })
  .then(r => r.json())
  .then(console.log)
  .catch(console.error);
