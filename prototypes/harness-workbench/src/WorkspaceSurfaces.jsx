import { useState } from 'react';
import { ArrowRightIcon, ArchiveIcon, ArrowCounterClockwiseIcon, ChatCircleDotsIcon, CheckCircleIcon, CodeIcon, FileTextIcon, FolderOpenIcon, GearIcon, MagnifyingGlassIcon, PencilSimpleIcon, PlugsIcon, RobotIcon, SlidersHorizontalIcon, ShieldCheckIcon } from '@phosphor-icons/react';
import s from './WorkspaceSurfaces.module.css';

export const starters = [
  { title: '梳理代码', description: '从结构、依赖和关键入口开始', icon: CodeIcon, prompt: '请先梳理当前工作区的目录结构、主要依赖和关键入口，不修改文件。', mode: '计划模式' },
  { title: '完善界面', description: '把具体需求拆成可检查的修改', icon: SlidersHorizontalIcon, prompt: '请检查当前界面的布局、输入保留和错误状态，先给出改进方案。', mode: '标准模式' },
  { title: '整理验收', description: '明确步骤、预期结果和边界', icon: FileTextIcon, prompt: '请根据当前改动整理验收清单，包含操作步骤、预期结果和异常情况，不自动标记通过。', mode: '计划模式' },
];

export function NewSession({ workspace, onChoose }) {
  return <section className={s.welcome} aria-label="新会话指引">
    <div className={s.workspacePill}><FolderOpenIcon size={17}/><span>{workspace}</span></div>
    <img className={s.welcomeMark} src="/assets/brand/mark.svg" alt=""/>
    <span className={s.eyebrow}>KUNORA WORKBENCH</span>
    <h2>今天，想推进什么工作？</h2>
    <p>从一个问题、一份参考，或一项具体改动开始。</p>
    <div className={s.starters}>{starters.map(({ title, description, icon: Icon, ...item }) => <button key={title} onClick={() => onChoose(item)}><Icon size={24}/><strong>{title}</strong><span>{description}</span><ArrowRightIcon size={18} className={s.starterArrow}/></button>)}</div>
    <div className={s.safetyNote}><ShieldCheckIcon size={17}/><span>当前为本地原型。建议只填入输入区，由你确认后发送。</span></div>
  </section>;
}

export function SessionHistory({ sessions, workspace, currentId, onOpen, onRename, onArchive, onNew }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('active');
  const [editing, setEditing] = useState(null);
  const [title, setTitle] = useState('');
  const [notice, setNotice] = useState('');
  const scoped = sessions.filter(item => item.workspace === workspace);
  const listed = scoped.filter(item => Boolean(item.archived) === (filter === 'archived') && item.title.toLowerCase().includes(query.trim().toLowerCase()));
  function changeFilter(value) { setFilter(value); setEditing(null); setNotice(''); }
  return <div className={s.history}>
    <p className={s.intro}>找回讨论，接着推进。<span>{workspace}</span></p>
    <label className={s.historySearch}><MagnifyingGlassIcon size={20}/><input autoFocus aria-label="搜索历史会话" placeholder="搜索会话名称…" value={query} onChange={e => setQuery(e.target.value)}/></label>
    <div className={s.historyFilters} role="group" aria-label="历史范围">{[['active', '进行中'], ['archived', '已归档']].map(([value, label]) => <button key={value} aria-pressed={filter === value} onClick={() => changeFilter(value)}>{label}<span>{scoped.filter(item => Boolean(item.archived) === (value === 'archived')).length}</span></button>)}</div>
    <div className={s.historyList} aria-label="历史会话列表">
      {listed.map(item => <article key={item.id} className={`${s.historyItem} ${item.id === currentId ? s.currentItem : ''}`}>
        <ChatCircleDotsIcon className={s.historyIcon} size={23}/>
        {editing === item.id ? <form className={s.renameForm} onSubmit={e => { e.preventDefault(); if (!title.trim()) return; onRename(item.id, title.trim()); setEditing(null); setNotice('会话名称已更新。'); }}><label>会话名称<input autoFocus maxLength={60} value={title} onChange={e => setTitle(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setEditing(null); } }}/></label><div><button className={s.actionPrimary} disabled={!title.trim()}>保存名称</button><button type="button" className={s.actionSecondary} onClick={() => setEditing(null)}>取消</button></div></form> : <>
          <button className={s.historyOpen} onClick={() => onOpen(item)}><strong>{item.title}</strong><span>{item.draft.trim() || item.attachments.length ? '草稿待发送' : item.example ? '示例会话' : '本地会话'} · {item.messages.length + (item.example ? 2 : 0)} 条消息{item.pending ? ' · 演示运行中' : ''}{item.archived ? ' · 恢复并打开' : ''}</span></button>
          <div className={s.historyActions}><button title={`重命名 ${item.title}`} aria-label={`重命名 ${item.title}`} onClick={() => { setEditing(item.id); setTitle(item.title); }}><PencilSimpleIcon size={19}/></button><button title={item.pending ? '请先停止演示再归档' : `${item.archived ? '恢复' : '归档'} ${item.title}`} aria-label={`${item.archived ? '恢复' : '归档'} ${item.title}`} disabled={Boolean(item.pending)} onClick={() => { onArchive(item.id, !item.archived); setNotice(item.archived ? '会话已恢复，可在进行中列表继续讨论。' : '会话已归档，草稿和消息仍然保留。可在已归档中恢复。'); }}>{item.archived ? <ArrowCounterClockwiseIcon size={19}/> : <ArchiveIcon size={19}/>}</button></div>
        </>}
      </article>)}
      {!listed.length && <div className={s.emptyList}><MagnifyingGlassIcon size={30}/><h3>{query ? '没有找到匹配的会话' : filter === 'archived' ? '还没有归档会话' : '从新的讨论开始'}</h3><p>{query ? '试试更短的名称，或切换会话范围。' : filter === 'archived' ? '归档会保留消息和未发送的草稿。' : '新建会话，描述你想完成的工作。'}</p>{query && <button className={s.actionSecondary} onClick={() => setQuery('')}>清除搜索</button>}</div>}
    </div>
    <p className={s.notice} role="status">{notice || '所有记录仅保留在当前页面，刷新后恢复示例。'}</p>
    <footer className={s.historyFooter}><span>归档不删除内容</span><button className={s.actionPrimary} onClick={onNew}>新建会话<ArrowRightIcon size={16}/></button></footer>
  </div>;
}

const settingsTabs = [
  ['general', '通用设置', GearIcon], ['models', '模型', RobotIcon], ['plugins', '插件', PlugsIcon], ['presets', 'Agent 预设', SlidersHorizontalIcon],
];

function SettingRow({ title, description, children }) {
  return <div className={s.settingRow}><div><strong>{title}</strong><p>{description}</p></div>{children}</div>;
}

export function Settings({ fontSize, setFontSize, sendKey, setSendKey, failNext, setFailNext, onPreset }) {
  const [tab, setTab] = useState('general');
  return <div className={s.settingsLayout}>
    <div className={s.settingsNav} role="tablist" aria-label="设置分类">{settingsTabs.map(([value, label, Icon], index) => <button key={value} id={`settings-tab-${value}`} role="tab" aria-selected={tab === value} tabIndex={tab === value ? 0 : -1} aria-controls={`settings-panel-${value}`} onClick={() => setTab(value)} onKeyDown={e => { let next; if (['ArrowRight', 'ArrowDown'].includes(e.key)) next = (index + 1) % settingsTabs.length; else if (['ArrowLeft', 'ArrowUp'].includes(e.key)) next = (index + 3) % settingsTabs.length; else if (e.key === 'Home') next = 0; else if (e.key === 'End') next = 3; else return; e.preventDefault(); const value = settingsTabs[next][0]; setTab(value); document.getElementById(`settings-tab-${value}`)?.focus(); }}><Icon size={20}/>{label}</button>)}</div>
    <section className={s.settingsContent} id={`settings-panel-${tab}`} role="tabpanel" aria-labelledby={`settings-tab-${tab}`} tabIndex={0}>
      {tab === 'general' && <><div className={s.sectionHeading}><h3>让工作台适合你的习惯</h3><p>修改即时生效，仅保留在当前页面。</p></div>
        <SettingRow title="会话字号" description="调整消息和桌面输入区的文字大小。"><select aria-label="会话字号" value={fontSize} onChange={e => setFontSize(Number(e.target.value))}><option value={14}>14 px</option><option value={16}>16 px</option><option value={17}>17 px</option></select></SettingRow>
        <SettingRow title="发送快捷键" description={sendKey === 'enter' ? 'Shift + Enter 换行。' : 'Enter 换行，Ctrl / ⌘ + Enter 发送。'}><select aria-label="发送快捷键" value={sendKey} onChange={e => setSendKey(e.target.value)}><option value="enter">Enter</option><option value="modifier">Ctrl / ⌘ + Enter</option></select></SettingRow>
        <SettingRow title="外观" description="沿用 Kunora 内网基础视觉规范。"><span className={s.themeBadge}><CheckCircleIcon size={17}/>浅色 · 鲲蓝</span></SettingRow>
        <div className={s.previewSetting}><label><span><strong>演示一次发送失败</strong><small>下次发送后恢复草稿和附件，便于检查错误状态。</small></span><input type="checkbox" checked={failNext} onChange={e => setFailNext(e.target.checked)}/></label></div>
        <p className={s.finePrint}>中文优先 MiSans，未安装时使用系统字体；英文使用 Manrope。MiSans 字体知识产权归小米科技有限责任公司所有。</p>
      </>}
      {tab === 'models' && <><div className={s.sectionHeading}><h3>模型连接</h3><p>接入状态与运行方式始终清晰可见。</p></div><div className={s.connectionCard}><RobotIcon size={32}/><div><strong>尚未连接模型</strong><p>当前回复来自本地演示，不会发出网络请求。</p></div><span className={s.statusBadge}>未连接</span></div><dl className={s.detailsList}><div><dt>当前运行方式</dt><dd>本地交互模拟</dd></div><div><dt>API 凭证</dt><dd>未设置 · 原型不收集密钥</dd></div><div><dt>文件访问</dt><dd>仅示例内容 · 不读取工作目录</dd></div></dl><div className={s.infoNote}><ShieldCheckIcon size={21}/><p>真实连接需要后续接入后端，并验证密钥存储、权限确认与错误恢复流程。</p></div></>}
      {tab === 'plugins' && <><div className={s.sectionHeading}><h3>工具与插件</h3><p>区分可预览的界面与真实可执行的能力。</p></div>{[[FileTextIcon, '文件读取与编辑', '展示示例工具记录和文件差异，不操作实际文件。'], [PlugsIcon, '外部插件', '尚未接入外部服务，也不会自动安装插件。']].map(([Icon, title, description]) => <div key={title} className={s.pluginRow}><Icon size={25}/><div><strong>{title}</strong><p>{description}</p></div><span className={s.statusBadge}>{title === '外部插件' ? '未接入' : '示例'}</span></div>)}<div className={s.infoNote}><ShieldCheckIcon size={21}/><p>后续工具执行需要明确展示访问范围和授权状态，不能仅凭界面开关获得权限。</p></div></>}
      {tab === 'presets' && <><div className={s.sectionHeading}><h3>从合适的工作方式开始</h3><p>选择后新建会话并填入建议，不会自动发送。</p></div><div className={s.presetList}>{starters.map(({ title, description, icon: Icon, ...item }) => <button key={title} onClick={() => onPreset(item)}><Icon size={25}/><span><strong>{title}</strong><small>{description}</small></span><span className={s.presetMode}>{item.mode}</span><ArrowRightIcon size={18}/></button>)}</div><p className={s.finePrint}>预设仅提供起步提示，不包含隐藏指令或额外权限。原会话草稿会保留。</p></>}
    </section>
  </div>;
}
