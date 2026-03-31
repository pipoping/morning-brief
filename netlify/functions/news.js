const https = require('https');

exports.handler = async function(event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  };

  function fetchUrl(url) {
    return new Promise((resolve, reject) => {
      https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(data));
      }).on('error', reject);
    });
  }

  async function fetchMarket() {
    try {
      const symbols = ['^KS11', '^GSPC', 'KRW=X', 'CL=F'];
      const names = ['KOSPI', 'S&P 500', 'USD/KRW', 'WTI 유가'];
      const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbols.join(',')}&fields=regularMarketPrice,regularMarketChangePercent`;
      const raw = await fetchUrl(url);
      const data = JSON.parse(raw);
      const quotes = data?.quoteResponse?.result || [];
      return symbols.map((sym, i) => {
        const q = quotes.find(q => q.symbol === sym);
        if (!q) return { name: names[i], val: '-', chg: '-', up: true };
        const price = q.regularMarketPrice;
        const chgPct = q.regularMarketChangePercent;
        const up = chgPct >= 0;
        let val;
        if (sym === '^KS11') val = price.toLocaleString('ko-KR', { maximumFractionDigits: 2 });
        else if (sym === 'KRW=X') val = price.toLocaleString('ko-KR', { maximumFractionDigits: 1 });
        else if (sym === 'CL=F') val = '$' + price.toFixed(2);
        else val = price.toLocaleString('en-US', { maximumFractionDigits: 2 });
        return { name: names[i], val, chg: (up ? '+' : '') + chgPct.toFixed(2) + '%', up };
      });
    } catch(e) { return null; }
  }

  async function fetchNews() {
    try {
      const queries = ['주식+코스피+증시', '환율+달러', '부동산+아파트', '금리+한국은행', '비트코인+암호화폐', '미국경제+연준'];
      const results = await Promise.all(queries.map(q =>
        fetchUrl(`https://news.google.com/rss/search?hl=ko&gl=KR&ceid=KR:ko&q=${encodeURIComponent(q)}`)
      ));
      const articles = [];
      results.forEach(xml => {
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
      return articles;
    } catch(e) { return []; }
  }

  try {
    const [market, articles] = await Promise.all([fetchMarket(), fetchNews()]);
    return { statusCode: 200, headers, body: JSON.stringify({ articles, market }) };
  } catch(e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
