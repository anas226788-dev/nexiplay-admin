const cheerio = require('cheerio');
const axios = require('axios');
async function test() {
  const url = 'https://romanticgolpo.com/coffee-vanilla-part-1/';
  const res = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const $ = cheerio.load(res.data);
  let allP = [];
  $('p').each((i, el) => {
    let t = $(el).text().trim().substring(0, 30);
    if(t) allP.push(t);
  });
  console.log('Total P tags:', allP.length);
  console.log('First 5:', allP.slice(0, 5));
  console.log('Parent classes of first P:', $('p').first().parent().attr('class'));
}
test();
