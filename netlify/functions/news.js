const https = require('https');

exports.handler = async function(event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  };

  function fetchUrl(url) {
    return new Promise((resolve, reject) => {
      https.get(url, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(data));
      }).on('error', reject);
    });
  }

  try {
    const queries = ['주식+코스피+증시', '환율+달러', '부동산+아파트', '금리+한국은행', '비트코인+암호화폐', '미국경제+연준'];
    const results = await Promise.all(queries.map(q =>
      fetchUrl(`https://news.google.com/rss/search?hl=ko&gl=KR&ceid=KR:ko&q=${encodeURIComponent(q)}`)
    ));

    const articles = [];
    results.forEach((xml, i) => {
      const matches = xml.match(/<item>([\s\S]*?)<\/item>/g) || [];
      matches.slice(0, 3).forEach(item => {
        const title = (item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) || item.match(/<title>(.*?)<\/title>/) || [])[1] || '';
        const desc = (item.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/) || item.match(/<description>(.*?)<\/description>/) || [])[1] || '';
        const link = (item.match(/<link>(.*?)<\/link>/) || [])[1] || '';
        const pubDate = (item.match(/<pubDate>(.*?)<\/pubDate>/) || [])[1] || '';
        const source = (item.match(/<source[^>]*>(.*?)<\/source>/) || [])[1] || '뉴스';
        if (title) articles.push({ title: title.replace(/ - [^-]+$/, ''), desc: desc.replace(/<[^>]*>/g,'').slice(0,200), link, pubDate, source });
      });
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ articles })
    };
  } catch(e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
