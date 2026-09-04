export const files = {
  'AssociateTask.tsx': {
    before: `async function submit(values) {
  setSaving(true);
  resetForm();
  await saveTask(values);
  setSaving(false);
}
`,
    after: `async function submit(values) {
  setSaving(true);
  try {
    await saveTask(values);
  } catch (error) {
    keepDraft(values);
    showBranchError(error);
  } finally {
    setSaving(false);
  }
}
`,
  },
  'associate-task.css': {
    before: `.form {
  display: grid;
  gap: 12px;
}

.error {
  color: #ff5a7a;
}
`,
    after: `.form {
  display: grid;
  gap: 16px;
}

.error {
  color: #b72d50;
  line-height: 1.6;
}

.field:focus-visible {
  outline: 2px solid #1677ff;
  outline-offset: 3px;
}
`,
  },
  'acceptance.md': {
    before: `# 验收说明

检查任务关联是否成功。
`,
    after: `# 验收说明

## 输入保留
保存失败后，已输入内容仍然存在。

## 重复分支
重复关联时显示原因与返回入口。

## 验收结果
由负责人评审后记录，不自动通过。
`,
  },
};
export const examples = {
  form: { request: '优化任务关联表单，保留输入和重复分支校验。', summary: '已补齐输入保留与分支校验，修改如下。', bullets: ['保存失败时保留已填写内容。', '重复分支显示明确原因与返回入口。'], files: ['AssociateTask.tsx', 'associate-task.css'], read: ['AssociateTask.tsx', 'associate-task.css', 'task-api.ts'] },
  acceptance: { request: '整理任务关联表单的验收说明。', summary: '已整理输入保留与重复分支的检查要点。', bullets: ['按可观察行为编写验收步骤。', '评审结果由负责人记录，不自动通过。'], files: ['acceptance.md'], read: ['AssociateTask.tsx', 'acceptance.md'] },
  repository: { request: '检查工作区结构，不修改任何文件。', summary: '示例工作区结构已整理，没有文件修改。', bullets: ['crates/：服务端代码。', 'docs/：产品定义与界面草稿。'], files: [], read: ['Cargo.toml', 'docs/workbench/'] },
};
export function blankSession(id, title, example = null, workspace = 'kunora-workbench') {
  return { id, title, example, workspace, archived: false, draft: '', attachments: [], messages: [], pending: null, queue: [], error: '' };
}
export const initialSessions = [blankSession('form', '优化任务关联表单', 'form'), blankSession('acceptance', '整理验收说明', 'acceptance'), blankSession('repository', '检查仓库结构', 'repository')];
