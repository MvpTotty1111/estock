const assert = require('node:assert/strict');
const test = require('node:test');

const { SmartProvider } = require('../out/providers/smartProvider');

function withFakeDate(dateText, fn) {
  const OriginalDate = Date;
  global.Date = class FakeDate extends OriginalDate {
    constructor(...args) {
      if (args.length === 0) {
        return new OriginalDate(dateText);
      }
      return new OriginalDate(...args);
    }

    static now() {
      return new OriginalDate(dateText).getTime();
    }
  };

  return Promise.resolve()
    .then(fn)
    .finally(() => {
      global.Date = OriginalDate;
    });
}

test('routes China stocks to Tencent during opening auction', async () => {
  await withFakeDate('2026-07-03T01:18:00.000Z', async () => {
    const provider = new SmartProvider();
    const sinaCalls = [];
    const tencentCalls = [];
    provider.sina = {
      fetchQuotes: async (symbols) => {
        sinaCalls.push(symbols);
        return symbols.map(symbol => ({
          symbol,
          name: symbol,
          price: 0,
          change: 0,
          changePercent: 0,
        }));
      },
    };
    provider.tencent = {
      fetchQuotes: async (symbols) => {
        tencentCalls.push(symbols);
        return symbols.map(symbol => ({
          symbol,
          name: symbol,
          price: symbol === 'sz002027' ? 4.9 : 430.2,
          change: 0,
          changePercent: 0,
        }));
      },
    };

    const quotes = await provider.fetchQuotes(['sz002027', 'hk00700']);

    assert.deepEqual(sinaCalls, []);
    assert.deepEqual(tencentCalls, [['sz002027', 'hk00700']]);
    assert.equal(quotes[0].symbol, 'sz002027');
    assert.equal(quotes[0].price, 4.9);
    assert.equal(quotes[1].symbol, 'hk00700');
  });
});

test('marks Hong Kong Tencent quotes as delayed', async () => {
  await withFakeDate('2026-07-03T01:35:00.000Z', async () => {
    const provider = new SmartProvider();
    provider.sina = {
      fetchQuotes: async () => [],
    };
    provider.tencent = {
      fetchQuotes: async (symbols) => symbols.map(symbol => ({
        symbol,
        name: symbol,
        price: 438.6,
        change: 8.4,
        changePercent: 1.95,
      })),
    };

    const quotes = await provider.fetchQuotes(['hk00700']);

    assert.equal(quotes[0].delayed, true);
  });
});

test('merges Tencent valuation metrics into China stock Sina quotes', async () => {
  await withFakeDate('2026-07-03T01:35:00.000Z', async () => {
    const provider = new SmartProvider();
    const sinaCalls = [];
    const tencentCalls = [];
    provider.sina = {
      fetchQuotes: async (symbols) => {
        sinaCalls.push(symbols);
        return symbols.map(symbol => ({
          symbol,
          name: '分众传媒',
          price: 4.85,
          change: 0.11,
          changePercent: 2.32,
        }));
      },
    };
    provider.tencent = {
      fetchQuotes: async (symbols) => {
        tencentCalls.push(symbols);
        return symbols.map(symbol => ({
          symbol,
          name: '分众传媒',
          price: 4.86,
          change: 0.12,
          changePercent: 2.53,
          marketCap: 100_000_000_000,
          pe: 19.45,
          pb: 5.51,
          dividendYield: 7.01,
        }));
      },
    };

    const quotes = await provider.fetchQuotes(['sz002027']);

    assert.deepEqual(sinaCalls, [['sz002027']]);
    assert.deepEqual(tencentCalls, [['sz002027']]);
    assert.equal(quotes[0].price, 4.85);
    assert.equal(quotes[0].changePercent, 2.32);
    assert.equal(quotes[0].marketCap, 100_000_000_000);
    assert.equal(quotes[0].pe, 19.45);
    assert.equal(quotes[0].pb, 5.51);
    assert.equal(quotes[0].dividendYield, 7.01);
  });
});

test('merges market capitalization without replacing the Sina price when other metrics are absent', async () => {
  await withFakeDate('2026-07-03T01:35:00.000Z', async () => {
    const provider = new SmartProvider();
    const base = { symbol: 'sh601318', name: 'Test', price: 50, change: 1, changePercent: 2 };
    provider.sina = { fetchQuotes: async () => [base] };
    provider.tencent = { fetchQuotes: async () => [{ ...base, price: 49, marketCap: 100_000_000_000 }] };
    const [quote] = await provider.fetchQuotes(['sh601318']);
    assert.equal(quote.price, 50);
    assert.equal(quote.marketCap, 100_000_000_000);
  });
});

test('preserves Sina turnover and falls back to Tencent turnover when absent', async () => {
  await withFakeDate('2026-07-03T01:35:00.000Z', async () => {
    const provider = new SmartProvider();
    const base = { symbol: 'sh601318', name: 'Test', price: 50, change: 1, changePercent: 2 };
    provider.sina = { fetchQuotes: async () => [{ ...base, turnover: 0 }] };
    provider.tencent = { fetchQuotes: async () => [{ ...base, price: 49, turnover: 100000000 }] };
    const [quote] = await provider.fetchQuotes(['sh601318']);
    assert.equal(quote.turnover, 0);
    assert.equal(quote.price, 50);
    provider.sina = { fetchQuotes: async () => [base] };
    const [fallback] = await provider.fetchQuotes(['sh601318']);
    assert.equal(fallback.turnover, 100000000);
    assert.equal(fallback.price, 50);
  });
});
