const cheerio = require('cheerio');
const axios = require('axios');
async function test() {
  const url = 'https://romanticgolpo.com/category/coffee-vanilla/';
  const res = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const $ = cheerio.load(res.data);
  let chapterLinks = [];
  $('h2.entry-title a, h3.entry-title a, h3 a, h3.entry-title').each((i, el) => {
      const href = $(el).attr('href');
      const cTitle = $(el).text().trim();
      if (href && href.includes('romanticgolpo.com') && !chapterLinks.some(c => c.url === href)) {
          chapterLinks.push({ title: cTitle, url: href });
      }
  });
  console.log('Original order:');
  chapterLinks.forEach(c => console.log(c.title));
}
test();
