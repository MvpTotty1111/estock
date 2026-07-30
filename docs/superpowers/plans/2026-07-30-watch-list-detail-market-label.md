# 股票池详情市场标识 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让股票池详情表格的股票名称展示 A/H 市场标识，并移除该表格中港股更新时间后的延迟提示。

**Architecture:** 复用 `nameWithMarket(name, symbol)` 生成与状态栏一致的名称。批量表格只输出 `Quote.time`，不改变 `Quote.delayed`、单股详情或状态栏 tooltip。

**Tech Stack:** TypeScript、VS Code Extension API、Node.js `node:test`、VSCE。

## Global Constraints

- 批量表格名称展示为 `中国平安(A)`、`腾讯控股(H)`。
- 批量表格的更新时间不追加港股延迟提示。
- 单股详情和状态栏 tooltip 的延迟提示保持不变。
- 不修改行情 Provider、`Quote` 数据结构或配置格式。
- 完成后将版本从 `0.9.3` 升至 `0.9.4` 并生成 VSIX。

---

### Task 1: 调整批量详情表格显示

**Files:**
- Modify: `src/stockService.ts`
- Test: `test/switchStock.test.js`

**Interfaces:**
- Consumes: `nameWithMarket(name: string, symbol: string): string`
- Produces: `showWatchListDetail()` 的名称和更新时间显示规则

- [ ] **Step 1: 写失败测试**

在 `showWatchListDetail outputs every stock with complete detail columns` 中将名称断言改为：

```javascript
assert.match(output[0], /港股创新药ETF\(A\).*513120/);
assert.match(output[0], /阅文集团\(H\).*00772/);
```

将港股时间断言改为只接受原始时间，并增加：

```javascript
assert.doesNotMatch(output[0], /延迟约15分钟/);
```

- [ ] **Step 2: 运行测试并确认失败**

Run:

```bash
npm run compile && node --test --test-name-pattern='showWatchListDetail outputs every stock with complete detail columns' test/switchStock.test.js
```

Expected: FAIL，实际名称没有 `(A)` / `(H)`，且仍包含延迟提示。

- [ ] **Step 3: 实现最小修改**

在 `src/stockService.ts` 中从 `symbolParser` 导入 `nameWithMarket`，并修改两列：

```typescript
{ title: '名称', value: quote => nameWithMarket(quote.name, quote.symbol) },
```

```typescript
{
  title: '更新时间',
  value: quote => quote.time || '--',
},
```

- [ ] **Step 4: 运行聚焦和完整测试**

Run:

```bash
npm run compile && node --test --test-name-pattern='showWatchListDetail' test/switchStock.test.js
npm test
git diff --check
```

Expected: 聚焦测试和完整测试均通过，`git diff --check` 无输出。

- [ ] **Step 5: 提交显示调整**

```bash
git add src/stockService.ts test/switchStock.test.js
git commit -m "调整股票池详情表格显示。"
```

---

### Task 2: 升级版本并打包

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Verify: `.vscodeignore`
- Produce: `estock-watcher-0.9.4.vsix`

**Interfaces:**
- Consumes: Task 1 的已验证编译产物
- Produces: 版本 `0.9.4` 的 VSIX

- [ ] **Step 1: 同步版本清单**

将 `package.json`、`package-lock.json` 根版本和锁文件主包版本从 `0.9.3` 修改为 `0.9.4`。

- [ ] **Step 2: 运行发布前验证**

Run:

```bash
npm test
git diff --check
```

Expected: 全部测试通过，差异检查无输出。

- [ ] **Step 3: 生成并检查 VSIX**

Run:

```bash
npx @vscode/vsce package --no-dependencies
unzip -p estock-watcher-0.9.4.vsix extension/package.json
unzip -l estock-watcher-0.9.4.vsix
```

Expected: 包内版本为 `0.9.4`，不包含测试、`.superpowers` 或 `docs/superpowers`。

- [ ] **Step 4: 提交版本更新**

```bash
git add package.json package-lock.json
git commit -m "更新版本号到0.9.4。"
```
