const assert = require('node:assert/strict');
const test = require('node:test');
const Module = require('node:module');
const vscode = require('./vscode');
const originalLoad = Module._load;
Module._load = function patchedLoad(request, parent, isMain) {
  return request === 'vscode' ? vscode : originalLoad.call(this, request, parent, isMain);
};
const { StockService } = require('../out/stockService');
const extension = require('../out/extension');

test('remove command shows cached names and removes the selected symbol', async (t) => {
  const values = { watchList: ['601318', 'hk00700'], displayList: ['hk00700'] };
  const quotes = new Map([
    ['sh601318', { symbol: 'sh601318', name: '中国平安' }],
    ['hk00700', { symbol: 'hk00700', name: '腾讯控股' }],
  ]);
  const handlers = new Map();
  t.mock.method(vscode.workspace, 'getConfiguration', () => ({
    get: (key, fallback) => values[key] ?? fallback,
    update: async (key, value) => { values[key] = value; },
  }));
  t.mock.method(vscode.commands, 'registerCommand', (command, handler) => {
    handlers.set(command, handler);
    return { dispose() {} };
  });
  t.mock.method(StockService.prototype, 'activate', function () {
    this.statusBar = { getLastQuote: symbol => quotes.get(symbol) };
    this.provider = { fetchQuotes: async () => assert.fail('Cached names should not trigger a fetch.') };
  });
  t.mock.method(StockService.prototype, 'dispose', () => {});
  t.mock.method(vscode.window, 'showQuickPick', async (items, options) => {
    assert.deepEqual(items.map(item => [item.label, item.description]), [
      ['中国平安(A)', '601318'],
      ['腾讯控股(H)', '00700'],
    ]);
    assert.equal(options.matchOnDescription, true);
    return items[1];
  });
  try {
    extension.activate({ subscriptions: [] });
    await handlers.get('estock.removeStock')();
    assert.deepEqual(values.watchList, ['601318']);
    assert.deepEqual(values.displayList, []);
  } finally {
    extension.deactivate();
  }
});

function setupService(t, watchList, cachedQuotes, fetchQuotes) {
  t.mock.method(vscode.workspace, 'getConfiguration', () => ({
    get: (key, fallback) => key === 'watchList' ? watchList : fallback,
  }));
  const service = new StockService();
  const cache = new Map(cachedQuotes.map(quote => [quote.symbol, quote]));
  service.statusBar = {
    getLastQuote: symbol => cache.get(symbol),
    updateQuotes: quotes => quotes.forEach(quote => cache.set(quote.symbol, quote)),
  };
  service.provider = { fetchQuotes };
  return service;
}

test('remove picker fetches names missing from the cache', async (t) => {
  const service = setupService(t, ['00700'], [], async symbols => {
    assert.deepEqual(symbols, ['hk00700']);
    return [{ symbol: 'hk00700', name: '腾讯控股' }];
  });
  t.mock.method(vscode.window, 'showQuickPick', async items => {
    assert.equal(items[0].label, '腾讯控股(H)');
    return undefined;
  });
  await service.showRemoveStock();
});

test('remove picker keeps stocks available when names cannot be fetched', async (t) => {
  const service = setupService(t, ['601318'], [], async () => { throw new Error('Offline'); });
  t.mock.method(vscode.window, 'showQuickPick', async items => {
    assert.equal(items[0].label, '601318(A)');
    assert.equal(items[0].symbol, 'sh601318');
    return undefined;
  });
  await service.showRemoveStock();
});

test('remove picker skips fetching and selection for an empty watch list', async (t) => {
  const service = setupService(t, [], [], async () => assert.fail('Empty lists should not fetch.'));
  t.mock.method(vscode.window, 'showQuickPick', () => assert.fail('Empty lists should not open a picker.'));
  const message = t.mock.method(vscode.window, 'showInformationMessage', () => {});
  await service.showRemoveStock();
  assert.equal(message.mock.calls[0].arguments[0], '股票池为空');
});
