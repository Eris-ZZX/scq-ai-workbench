<!-- VIBE-TRACKER-START -->
## Vibe Tracker — 过程追踪

如果工具列表中有 list_projects，说明 MCP 运行在 workspace 模式：
  1. 新会话开始先调用 list_projects，选择当前项目。
  2. 后续每次调用 Vibe Tracker 工具都带上 projectId，例如 get_context({projectId})、get_plan({projectId})、add_log({projectId, ...})、update_state({projectId, ...})。
  3. 只处理 list_projects 返回的已登记项目；不要把普通当前目录或未登记文件夹当作 VibeTracker 项目。
  4. 如果当前项目不在列表中，先提醒用户在 VibeTracker 中创建或登记项目，不要继续调用项目工具。
如果没有 list_projects，说明 MCP 运行在单项目模式，工具调用不需要 projectId。

选定项目后（或单项目模式下会话开始时）调 get_context，了解项目状态。
如首次运行或需要完整规划，调用 get_plan 读取 plan.md 模板。

六种 add_log type 及其触发时机：
  action   -> 完成了一个任务或操作
  decision -> 做了技术/架构决策，必须带 reason
  problem  -> 发现 bug 或障碍，必须带 cause，resolved 默认 false；修复后填 resolution 说明如何解决
  next     -> 下一步计划（通常会话结束时调用一次）
  status   -> Feature 或 Step 状态变更，e.g. "F2: in_progress -> done" 或 "F1.S2: todo -> done"，每次状态流转必记
  change   -> 需求/功能新增、修改或取消，必须带 reason，e.g. "新增 F5: 数据导出"

每完成一个功能后：
  1. 打开 plan.md，勾选对应 checkbox
  2. add_log(type="status", action="F2: in_progress -> done")
  3. update_state 传该功能的 features + steps（只传变更项即可，支持增量合并）

发现 bug 时：add_log(type="problem", action="xxx", cause="xxx", resolved=false)
修复 bug 后：
  1. add_log(type="status", action="Bug #xxx 已修复")
  2. 追加一条 add_log(type="problem", action="[已修复] xxx", cause="xxx", resolved=true)
  Bug 未解决列表只统计 resolved!=true 的最近记录，旧记录随日志滚动自然沉底。
需求或功能变更（新增/修改/取消）时：add_log(type="change", action="新增 F5: 数据导出", reason="用户需要")
遇到经验或坑调 add_finding：{type: "good"|"pit", tag, title, body, consequence?}

首次生成或大幅修改 plan.md 后，必须立刻将所有 checkbox 功能一次性全量同步到 state.json，同时把每个功能的执行步骤拆成 steps：
  update_state({features: [{id:"F1", title:"xxx", status:"todo", steps: [{id:"S1", title:"具体步骤1", status:"todo"}, {id:"S2", title:"具体步骤2", status:"todo"}]}, ...]})
  Step 由 agent 根据功能复杂度自行拆解，粒度建议 2-6 步/功能；后续每个 Step 状态变更同样调 add_log(type="status", action="F1.S1: todo -> done")

会话结束前：
  add_log(type="next", action="下一步做什么")
  update_state({status, features, currentTask, blocker, lastAction, nextStep})
  check_consistency。如有 warning，修正后重新 update_state。
可用标签：@frontend @backend @devops @database @npm @bug @config @deploy @general
<!-- VIBE-TRACKER-END -->






