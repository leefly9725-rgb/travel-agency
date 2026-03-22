---
name: lds-acceptance-check
description: 当本轮开发任务宣告完成、需要验收截图核对、PDF 打印预览核对、供应商导入数据核对、字段显示规则核对、页面交互核对、npm test 结果核对、交付前最终检查时触发此 Skill
---

# lds-acceptance-check — 验收检查规范

## 触发条件（任一满足即触发）

- 开发任务说"已完成"，需要走验收
- 需要确认 PDF 打印预览符合目标结构
- 需要确认供应商数据正确导入 seed.json
- 需要核对字段显示规则（如 nights 仅 hotel 显示）
- 交付前最终 checklist 确认

## 验收前提条件

```bash
# 先确认服务可以正常启动
npm start
# 确认测试通过
npm test
```

## 验收清单

### A. web/quotes.html 列表页
- [ ] 整张卡片可点击（不仅标题），cursor 为 pointer
- [ ] 点击后跳转到正确的报价详情页
- [ ] hover 有视觉反馈（border 变色或 shadow）
- [ ] 列表加载完成后 loading 态消失
- [ ] 列表默认按 updatedAt 倒序（最新在上）

### B. web/quote-project.html 报价页
- [ ] 新建时直接进入 project 界面（无闪烁）
- [ ] hotel 类型行：nights 输入框显示且可编辑
- [ ] 其他类型行（vehicle/guide/dining）：nights 列完全不可见
- [ ] label/input 对齐一致（同一页面的 label 宽度统一）
- [ ] 表格列宽固定，不随内容变化

### C. 从库选（供应商价格库）
- [ ] 弹窗打开后展示真实 supplier 数据（来自 seed.json 或 API）
- [ ] 选中条目后数据填入对应报价行字段

### D. PDF 打印预览验收
- [ ] Cover page 独占第 1 页（不溢出）
- [ ] 明细表格行不在页面中间截断
- [ ] 条款页与签字区在同一页（或签字区整体不被截断）
- [ ] 总页数在 4~5 页范围
- [ ] screen 与打印预览视觉基本一致

### E. 供应商数据导入验收
- [ ] 运行导入脚本后 seed.json 中 suppliers 条数符合预期
- [ ] 抽查 3 条供应商数据，字段与源数据一致
- [ ] 重复运行导入脚本，条数不变（幂等）
- [ ] `node scripts/import-sanity-check.js` 无报错

### F. 字段规则核对
- [ ] hotel 行：有 nights 输入，hotel_details 存在
- [ ] vehicle 行：无 nights，无服务日期
- [ ] guide 和 interpreter 作为独立类型区分，不混用
- [ ] 新增字段有默认值，旧记录不报错

### G. 测试与交付格式
- [ ] `npm test` 全部通过
- [ ] 已输出本轮交付说明（参考 .claude/CLAUDE.md 交付格式）
- [ ] 本地 server / 线上 api 同步状态已说明

## 验收流程

1. 对照清单逐项执行，打勾
2. 无法自行验证的项目（如 PDF 页数），请求用户截图确认
3. 全部通过后填写 `templates/acceptance-report-template.md`
4. 将任务从 `tasks/active/` 移入 `tasks/done/`

## 参考文件

- `templates/acceptance-report-template.md` — 验收报告模板
- `templates/acceptance-checklist.md` — 可复用清单（与本文同步）
- `references/verification-queries.md` — seed.json 验证查询（Node.js 脚本形式）
- `scripts/run-acceptance.md` — 手动验收操作步骤
