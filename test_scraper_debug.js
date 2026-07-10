const cheerio = require('cheerio');
const axios = require('axios');

async function test() {
  const url = 'https://romanticgolpo.com/category/coffee-vanilla/';
  const categoryRes = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const $cat = cheerio.load(categoryRes.data);
  
  let chapterLinks = [];
  $cat('h2.entry-title a, h3.entry-title a, h3 a').each((i, el) => {
      const href = $cat(el).attr('href');
      const cTitle = $cat(el).text().trim();
      if (href && href.includes('romanticgolpo.com') && !chapterLinks.some(c => c.url === href)) {
          chapterLinks.push({ title: cTitle, url: href });
      }
  });
  
  console.log(`Found ${chapterLinks.length} links.`);
  if (chapterLinks.length > 0) {
    const chapterUrl = chapterLinks[0].url;
    console.log(`Fetching chapter 1: ${chapterUrl}`);
    const chapRes = await axios.get(chapterUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const $chap = cheerio.load(chapRes.data);
    let contentHtml = '';
    $chap('.entry-content p').each((_, p) => {
        contentHtml += `<p>${$chap(p).text().trim()}</p>`;
    });
    console.log(`Extracted content length: ${contentHtml.length}`);
    if (contentHtml.length === 0) {
      console.log('Could not find .entry-content p');
      // What classes are available?
      console.log('Available classes in body:');
    }
  }
}
test();
