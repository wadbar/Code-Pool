
fetch('http://localhost:3000/api/pool/hunt', { method: 'POST' })
  .then(res => res.json())
  .then(data => console.log('Hungry Pool Engine result:', data))
  .catch(err => console.error('Error triggering Hungry Pool Engine:', err));
