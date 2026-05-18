import https from 'https';

const url = 'https://archive.org/wayback/available?url=https://olucasandrade.medium.com/14-reposit%C3%B3rios-excelentes-do-github-para-ajudar-na-sua-carreira-52b0184b7fab';

https.get(url, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log(data);
  });
}).on('error', err => console.error(err));
