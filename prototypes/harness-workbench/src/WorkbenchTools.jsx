import { useEffect, useRef, useState } from 'react';
import { ArchiveIcon, ArrowRightIcon, ArrowsLeftRightIcon, CheckCircleIcon, CopyIcon, DotsThreeIcon, FileCodeIcon, FileTextIcon, FolderOpenIcon, LinkSimpleIcon, MagnifyingGlassIcon, PencilSimpleIcon, PlusIcon, ShieldCheckIcon, XIcon } from '@phosphor-icons/react';
import { files } from './sample-data.js';
import s from './WorkbenchTools.module.css';

export function WorkspaceManager({ workspaces, sessions, activeWorkspace, onOpen, onAdd, onRename }) {
  const [edit, setEdit] = useState(null);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const addButton = useRef(null);
  const renameTrigger = useRef(null);
  function begin(kind, original = '', target = null) { setEdit({ kind, original }); setName(original); setError(''); renameTrigger.current = target; }
  function cancel() { setEdit(null); setError(''); setTimeout(() => (renameTrigger.current?.isConnected ? renameTrigger.current : addButton.current)?.focus(), 0); }
  function save(e) {
    e.preventDefault();
    const clean = name.trim();
    if (!clean) { setError('请填写工作区名称。'); return; }
    if (workspaces.some(item => item.toLowerCase() === clean.toLowerCase() && item !== edit.original)) { setError('已有同名工作区，请换一个名称。'); return; }
    if (edit.kind === 'add') onAdd(clean);
    else { onRename(edit.original, clean); setNotice(`工作区已更名为 ${clean}，会话与草稿已保留。`); cancel(); }
  }
  return <div>
    <div className={s.sectionIntro}><div><h3>让每段讨论有自己的位置</h3><p>管理会话分组，切换工作时保留未完成的内容。</p></div><span className={s.badge}>本地原型</span></div>
    <div className={s.workspaceList} aria-label="工作区列表">
      {workspaces.map(workspace => {
        const records = sessions.filter(item => item.workspace === workspace);
        return <article key={workspace} className={`${s.workspaceCard} ${workspace === activeWorkspace ? s.currentWorkspace : ''}`}>
          <span className={s.workspaceIcon}><FolderOpenIcon size={26}/></span>
          <div className={s.workspaceInfo}><h4>{workspace}</h4><p><span>{records.filter(item => !item.archived).length} 个会话</span><span>{records.filter(item => item.draft.trim() || item.attachments.length).length} 份草稿</span><span>{records.filter(item => item.archived).length} 个归档</span></p><small>示例分组 · 未连接目录</small></div>
          <div className={s.workspaceActions}><button className={s.iconButton} aria-label={`重命名工作区 ${workspace}`} title="重命名工作区" onClick={e => begin('rename', workspace, e.currentTarget)}><PencilSimpleIcon size={19}/></button>{workspace === activeWorkspace ? <span className={s.currentBadge}><CheckCircleIcon size={17}/>当前</span> : <button className={s.secondary} onClick={() => onOpen(workspace)}>打开<ArrowRightIcon size={16}/></button>}</div>
        </article>;
      })}
    </div>
    {edit ? <form className={s.workspaceForm} onSubmit={save}>
      <div className={s.formHeading}><h4>{edit.kind === 'add' ? '添加示例工作区' : '重命名工作区'}</h4><button type="button" className={s.iconButton} aria-label="取消编辑工作区" onClick={cancel}><XIcon size={18}/></button></div>
      <label className={s.field}>工作区名称<input autoFocus maxLength={60} value={name} aria-invalid={Boolean(error)} aria-describedby={error ? 'workspace-name-error' : 'workspace-name-help'} onChange={e => { setName(e.target.value); setError(''); }} placeholder="例如：design-review" onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cancel(); } }}/></label>
      <p id="workspace-name-help" className={s.help}>仅用于会话分组，不创建目录、不连接 Git 仓库。</p>
      {error && <p className={s.error} id="workspace-name-error" role="alert">{error}</p>}
      <div className={s.formActions}><button type="button" className={s.secondary} onClick={cancel}>取消</button><button className={s.primary} disabled={!name.trim()}>{edit.kind === 'add' ? '添加并打开' : '保存名称'}</button></div>
    </form> : <button ref={addButton} className={s.addWorkspace} onClick={() => begin('add')}><PlusIcon size={20}/><span>添加示例工作区</span><ArrowRightIcon size={18}/></button>}
    <div className={s.boundary}><ShieldCheckIcon size={20}/><p>这不会改变实际工作目录或 Git 配置。所有分组与草稿仅保留在当前页面，刷新后恢复示例。</p></div>
    <p className={s.srOnly} role="status">{notice}</p>
  </div>;
}

export function SessionMenu({ pending, onRename, onDuplicate, onArchive }) {
  const [open, setOpen] = useState(false);
  const trigger = useRef(null);
  const root = useRef(null);
  const menu = useRef(null);
  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector('button')?.focus();
    const outside = e => { if (!root.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  function close() { setOpen(false); trigger.current?.focus(); }
  function action(callback) { setOpen(false); callback(trigger.current); }
  function keys(e) {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
    else if (e.key === 'Tab') { close(); }
    else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) {
      e.preventDefault(); const items = [...menu.current.querySelectorAll('button:not(:disabled)')];
      const current = items.indexOf(document.activeElement);
      const index = e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : (current + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      items[index]?.focus();
    }
  }
  return <div ref={root} className={s.menuAnchor} onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false); }}>
    <button ref={trigger} className={s.iconButton} aria-label="会话操作" title="会话操作" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)} onKeyDown={e => { if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); } }}><DotsThreeIcon size={26} weight="bold"/></button>
    {open && <div ref={menu} role="menu" aria-label="会话操作" className={s.sessionMenu} onKeyDown={keys}>
      <button role="menuitem" tabIndex={-1} onClick={() => action(onRename)}><PencilSimpleIcon size={19}/><span>重命名会话</span></button>
      <button role="menuitem" tabIndex={-1} disabled={Boolean(pending)} onClick={() => action(onDuplicate)}><CopyIcon size={19}/><span>创建会话副本<small>保留消息与草稿，独立继续</small></span></button>
      <button role="menuitem" tabIndex={-1} disabled={Boolean(pending)} onClick={() => action(onArchive)}><ArchiveIcon size={19}/><span>归档会话<small>可在会话历史中恢复</small></span></button>
      {pending && <p>请先停止演示，再复制或归档。</p>}
    </div>}
  </div>;
}

export function RenameSession({ title, onSave, onCancel }) {
  const [name, setName] = useState(title);
  return <form onSubmit={e => { e.preventDefault(); if (name.trim()) onSave(name.trim()); }}><p className={s.help}>用容易找回的名称记录这段讨论，消息和草稿保持不变。</p><label className={s.field}>会话名称<input autoFocus maxLength={60} value={name} onChange={e => setName(e.target.value)}/></label><div className={s.formActions}><button type="button" className={s.secondary} onClick={onCancel}>取消</button><button className={s.primary} disabled={!name.trim()}>保存名称</button></div></form>;
}

export function SessionFiles({ names, sessionTitle, onCompare, onReference, onClose }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [chosen, setChosen] = useState(names[0] || '');
  const [version, setVersion] = useState('after');
  const [mobilePreview, setMobilePreview] = useState(false);
  const fileButtons = useRef(new Map());
  const previewTitle = useRef(null);
  const listed = names.filter(name => name.toLowerCase().includes(query.trim().toLowerCase()) && (filter === 'all' || (filter === 'docs' ? name.endsWith('.md') : !name.endsWith('.md'))));
  const selected = listed.includes(chosen) ? chosen : listed[0];
  const detail = files[selected];
  function pick(name) { setChosen(name); setVersion('after'); setMobilePreview(true); setTimeout(() => previewTitle.current?.focus(), 0); }
  function back() { setMobilePreview(false); setTimeout(() => fileButtons.current.get(selected)?.focus(), 0); }
  if (!names.length) return <div className={s.noFiles}><FileTextIcon size={40}/><h3>这段会话还没有产出文件</h3><p>文件会按会话整理在这里。当前是本地演示，发送消息不会自动生成真实文件。</p><button className={s.primary} onClick={onClose}>返回会话</button></div>;
  return <div className={s.fileBrowser}>
    <p className={s.fileIntro}><span title={sessionTitle}>{sessionTitle}</span><span>{names.length} 个示例文件 · 只读预览</span></p>
    <div className={`${s.fileLayout} ${mobilePreview ? s.showPreview : ''}`}>
      <aside className={s.fileListPane} aria-label="会话文件列表">
        <label className={s.fileSearch}><MagnifyingGlassIcon size={18}/><input aria-label="搜索会话文件" value={query} placeholder="搜索文件…" onChange={e => setQuery(e.target.value)}/></label>
        <div className={s.filters} role="group" aria-label="文件类型">{[['all', '全部'], ['code', '代码'], ['docs', '文档']].map(([value, label]) => <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}</div>
        <nav aria-label="文件列表">{listed.map(name => <button key={name} ref={el => { if (el) fileButtons.current.set(name, el); else fileButtons.current.delete(name); }} aria-current={selected === name ? 'true' : undefined} onClick={() => pick(name)} title={name}>{name.endsWith('.md') ? <FileTextIcon size={21}/> : <FileCodeIcon size={21}/>}<span>{name}<small>{name.endsWith('.md') ? 'Markdown 文档' : name.endsWith('.css') ? 'CSS 样式' : 'TypeScript 组件'}</small></span></button>)}</nav>
        {!listed.length && <div className={s.noMatches}><p>没有匹配的文件</p><button className={s.secondary} onClick={() => { setQuery(''); setFilter('all'); }}>清除筛选</button></div>}
        <p className={s.listFoot}>仅列出当前会话的示例产出，不扫描你的工作目录。</p>
      </aside>
      <section className={s.filePreview} aria-label="文件只读预览">
        {detail ? <><div className={s.previewHeader}><button className={`${s.secondary} ${s.backToFiles}`} onClick={back}>返回文件列表</button><h3 ref={previewTitle} tabIndex={-1}>{selected}</h3><div className={s.versionControls}><label>版本<select aria-label="预览版本" value={version} onChange={e => setVersion(e.target.value)}><option value="before">修改前</option><option value="after">修改后</option></select></label><span>{detail[version].trimEnd().split('\n').length} 行</span></div></div>
          <div className={s.codePreview} tabIndex={0} aria-label={`${selected} ${version === 'after' ? '修改后' : '修改前'}内容`}><pre><code>{detail[version]}</code></pre></div>
          <div className={s.previewActions}><button className={s.secondary} onClick={() => onCompare(selected)}><ArrowsLeftRightIcon size={18}/>打开文件对照</button><button className={s.primary} onClick={() => onReference(selected)}><LinkSimpleIcon size={18}/>引用到输入区</button></div>
        </> : <div className={s.previewEmpty}><FileTextIcon size={32}/><h3>选择一个文件查看内容</h3><p>清除筛选后，可以继续浏览会话产出。</p></div>}
      </section>
    </div>
    <p className={s.fileDisclaimer}><ShieldCheckIcon size={16}/>引用只追加文件名，不上传、不发送，也不会修改文件。</p>
  </div>;
}
