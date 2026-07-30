const assert = require('node:assert/strict');
const test = require('node:test');
const Module = require('node:module');

const vscode = require('./vscode');
const originalLoad = Module._load;
Module._load = function patchedLoad(request, parent, isMain) {
  if (request === 'vscode') {
    return vscode;
  }
  return originalLoad.call(this, request, parent, isMain);
};

const { StockService } = require('../out/stockService');
const extension = require('../out/extension');

test('registers the watch-list detail command and delegates to StockService', async () => {
  const originalRegisterCommand = vscode.commands.registerCommand;
  const originalActivate = StockService.prototype.activate;
  const originalDispose = StockService.prototype.dispose;
  const originalShowWatchListDetail = StockService.prototype.showWatchListDetail;
  const handlers = new Map();
  let detailCalls = 0;

  vscode.commands.registerCommand = (command, handler) => {
    handlers.set(command, handler);
    return { dispose() {} };
  };
  StockService.prototype.activate = () => undefined;
  StockService.prototype.dispose = () => undefined;
  StockService.prototype.showWatchListDetail = async () => {
    detailCalls += 1;
  };

  try {
    extension.activate({ subscriptions: [] });

    const handler = handlers.get('estock.showWatchListDetail');
    assert.ok(handler);
    await handler();
    assert.equal(detailCalls, 1);
  } finally {
    extension.deactivate();
    vscode.commands.registerCommand = originalRegisterCommand;
    StockService.prototype.activate = originalActivate;
    StockService.prototype.dispose = originalDispose;
    StockService.prototype.showWatchListDetail = originalShowWatchListDetail;
  }
});
