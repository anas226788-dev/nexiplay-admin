const cheerio = require('cheerio');
const axios = require('axios');
async function test() {
  const url = 'https://romanticgolpo.com/coffee-vanilla-part-1/';
  const res = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const $ = cheerio.load(res.data);
  console.log($('.entry-content').html() || 'NO ENTRY CONTENT');
}
test();
