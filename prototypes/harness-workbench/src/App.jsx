import { useEffect, useMemo, useRef, useState } from 'react';
import { ChatCircleDotsIcon, FolderOpenIcon, MagnifyingGlassIcon, PlusIcon, PlusSquareIcon, GearIcon, CaretDownIcon, CheckCircleIcon, FileTextIcon, CodeIcon, PaperclipIcon, TerminalIcon, ArrowsOutSimpleIcon, ArrowsInSimpleIcon, XIcon, ListIcon, StopIcon, WarningCircleIcon, ClockCounterClockwiseIcon } from '@phosphor-icons/react';
import { alignedDiff } from './diff.js';
import { blankSession, examples, files, initialSessions } from './sample-data.js';
import { NewSession, SessionHistory, Settings } from './WorkspaceSurfaces.jsx';
import { WorkspaceManager, SessionMenu, RenameSession, SessionFiles } from './WorkbenchTools.jsx';
import s from './Workbench.module.css';

function IconButton({ label, children, ...props }) {
  return <button type="button" className={s.iconButton} title={label} aria-label={label} {...props}>{children}</button>;
}

function Dialog({ title, children, onClose, wide = false, large = false }) {
  const ref = useRef(null);
  useEffect(() => { const el = ref.current; el.showModal(); el.querySelector('input:not([type="checkbox"])')?.focus(); return () => el.close(); }, []);
  return <dialog ref={ref} className={`${s.dialog} ${wide ? s.wideDialog : ''} ${large ? s.largeDialog : ''}`} aria-labelledby="dialog-title" onCancel={e => { e.preventDefault(); onClose(); }} onClick={e => { if (e.target === ref.current) onClose(); }}>
    <header><h2 id="dialog-title">{title}</h2><IconButton label="关闭弹窗" onClick={onClose}><XIcon size={20}/></IconButton></header>{children}
  </dialog>;
}

function Detail({ filename, expanded, onExpand, onClose, closeRef, mobile }) {
  const detail = files[filename];
  const [mobileSide, setMobileSide] = useState('right');
  const rows = useMemo(() => detail ? alignedDiff(detail.before, detail.after) : [], [detail]);
  const codeWidth = Math.max(320, ...[detail.before, detail.after].flatMap(text => text.split('\n').map(line => [...line].reduce((width, char) => width + (char.charCodeAt(0) > 255 ? 14 : 8), 60))));
  const panel = useRef(null);
  const previousMobile = useRef(false);
  useEffect(() => {
    if (mobile && !previousMobile.current) closeRef.current?.focus();
    previousMobile.current = mobile;
  }, [mobile, closeRef]);
  function keyboard(e) {
    if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
    if (mobile && e.key === 'Tab') {
      const items = [...panel.current.querySelectorAll('button, [tabindex="0"]')];
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }
  return <aside ref={panel} className={s.detail} role={mobile ? 'dialog' : 'region'} aria-modal={mobile || undefined} aria-label={`文件对照：${filename}`} onKeyDown={keyboard}>
    <header className={s.detailHeader}><div><h2>{filename}</h2><p>工具详情 · 编辑文件 · 示例</p></div><div className={s.detailActions}>
      {!mobile && <IconButton label={expanded ? '还原对照区域' : '展开对照区域'} onClick={onExpand}>{expanded ? <ArrowsInSimpleIcon size={20}/> : <ArrowsOutSimpleIcon size={20}/>}</IconButton>}
      <button ref={closeRef} className={s.iconButton} aria-label="关闭文件对照" title="关闭文件对照" onClick={onClose}><XIcon size={22}/></button>
    </div></header>
    {mobile && <div className={s.diffTabs} role="tablist" aria-label="对照版本">{['left', 'right'].map(side => <button key={side} role="tab" aria-selected={mobileSide === side} aria-controls="mobile-code-panel" id={`diff-tab-${side}`} tabIndex={mobileSide === side ? 0 : -1} onClick={() => setMobileSide(side)} onKeyDown={e => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); const next = side === 'left' ? 'right' : 'left'; setMobileSide(next); document.getElementById(`diff-tab-${next}`)?.focus(); } }}>{side === 'left' ? '修改前' : '修改后'}</button>)}</div>}
    <div className={s.diffScroll} tabIndex={0} aria-label="文件差异内容，可滚动">
      <div className={s.diffCanvas} style={{ minWidth: mobile ? codeWidth : codeWidth * 2 }}>
      {!mobile && <div className={s.diffLabels}><strong>修改前</strong><strong>修改后</strong></div>}
      <div className={`${s.diffGrid} ${mobile ? s.singleDiff : ''}`}>
        {(mobile ? [mobileSide] : ['left', 'right']).map(side => <div key={side} className={s.codeColumn} aria-label={side === 'left' ? '修改前代码' : '修改后代码'} role={mobile ? 'tabpanel' : undefined} id={mobile ? 'mobile-code-panel' : undefined} aria-labelledby={mobile ? `diff-tab-${side}` : undefined}>
          {rows.filter(row => !mobile || row[side]).map((row, index) => <div key={index} className={`${s.codeLine} ${row[side]?.type ? s[row[side].type] : ''}`}>
            <span className={s.lineNumber} aria-hidden="true">{row[side]?.number}</span><code>{row[side]?.type && <span className={s.diffSign} aria-label={row[side].type === 'added' ? '新增' : '删除'}>{row[side].type === 'added' ? '+' : '−'}</span>}{row[side]?.text || ' '}</code>
          </div>)}
        </div>)}
      </div>
      </div>
    </div>
    <footer className={s.detailFooter}>示例代码，仅用于设计评审。未修改实际文件。</footer>
  </aside>;
}

export function App() {
  const [sessions, setSessions] = useState(initialSessions);
  const [currentId, setCurrentId] = useState('form');
  const [selectedFile, setSelectedFile] = useState('AssociateTask.tsx');
  const [detailOpen, setDetailOpen] = useState(() => window.innerWidth >= 1180);
  const [expanded, setExpanded] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [workspaceOpen, setWorkspaceOpen] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [narrow, setNarrow] = useState(() => window.innerWidth < 1180);
  const [dialog, setDialog] = useState(null);
  const [workspaces, setWorkspaces] = useState(['kunora-workbench']);
  const [activeWorkspace, setActiveWorkspace] = useState('kunora-workbench');
  const [mode, setMode] = useState('标准模式');
  const [fontSize, setFontSize] = useState(16);
  const [sendKey, setSendKey] = useState('enter');
  const [failNext, setFailNext] = useState(false);
  const [commandsOpen, setCommandsOpen] = useState(false);
  const [readOpen, setReadOpen] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const [toast, setToast] = useState(null);
  const timers = useRef(new Map());
  const editor = useRef(null);
  const scroll = useRef(null);
  const attachmentInput = useRef(null);
  const closeDetailButton = useRef(null);
  const detailTrigger = useRef(null);
  const menuTrigger = useRef(null);
  const dialogTrigger = useRef(null);
  const filesTrigger = useRef(null);
  const sidebar = useRef(null);
  const current = sessions.find(session => session.id === currentId);
  const example = examples[current.example];
  const visibleSessions = sessions.filter(session => !session.archived && session.workspace === activeWorkspace && session.title.toLowerCase().includes(query.toLowerCase()));
  const hasInput = Boolean(current.draft.trim() || current.attachments.length);
  const shownDetail = detailOpen && files[selectedFile] && !sidebarOpen;

  function update(id, change) { setSessions(list => list.map(session => session.id === id ? { ...session, ...(typeof change === 'function' ? change(session) : change) } : session)); }
  function openDialog(name, target) { dialogTrigger.current = target; setDialog(name); }
  function closeDialog() {
    setDialog(null);
    setTimeout(() => { const origin = dialogTrigger.current; const target = origin?.getClientRects().length && !origin.closest('[inert]') ? origin : menuTrigger.current; if (target?.isConnected) target.focus(); }, 0);
  }
  function addWorkspace(name) {
    setWorkspaces(list => [...list, name]); switchWorkspace(name); setDialog(null);
    setTimeout(() => editor.current?.focus(), 0);
  }
  function renameWorkspace(previous, name) {
    setWorkspaces(list => list.map(item => item === previous ? name : item));
    setSessions(list => list.map(session => session.workspace === previous ? { ...session, workspace: name } : session));
    if (activeWorkspace === previous) setActiveWorkspace(name);
  }
  function duplicateSession() {
    if (current.pending) return;
    const copy = { ...structuredClone(current), id: crypto.randomUUID(), title: `${current.title.slice(0, 54)} · 副本`, sourceTitle: current.title, archived: false, pending: null, queue: [], error: '' };
    setSessions(list => [copy, ...list]); selectSession(copy); setQuery(''); setWorkspaceOpen(true);
    setToast({ text: '已创建独立副本，原会话与草稿保持不变。' });
    setTimeout(() => editor.current?.focus(), 0);
  }
  function archiveCurrent() {
    if (current.pending) return;
    archiveSession(current.id, true);
    setToast({ text: `已归档“${current.title}”，草稿和消息已保留。`, undoId: current.id });
  }
  function referenceFile(filename) {
    update(currentId, session => ({ draft: [session.draft, `请检查 @${filename} 的内容。`].filter(Boolean).join('\n\n') }));
    setDialog(null); setDetailOpen(false);
    setToast({ text: `已将 ${filename} 引用追加到输入区，尚未发送。` });
    setTimeout(() => editor.current?.focus(), 0);
  }

  useEffect(() => {
    const media = window.matchMedia('(max-width: 1179px)');
    const resize = () => { setNarrow(media.matches); if (media.matches) setDetailOpen(false); else setSidebarOpen(false); };
    if (media.matches) setDetailOpen(false);
    media.addEventListener('change', resize);
    return () => media.removeEventListener('change', resize);
  }, []);

  useEffect(() => {
    for (const session of sessions) {
      if (!session.pending || timers.current.has(session.id)) continue;
      const pending = session.pending;
      const timer = window.setTimeout(() => {
        timers.current.delete(session.id);
        update(session.id, latest => {
          if (latest.pending?.id !== pending.id) return {};
          if (pending.fail) {
            const recovery = [pending, ...latest.queue];
            return { pending: null, queue: [], draft: [...recovery.map(item => item.text).filter(Boolean), latest.draft].filter(Boolean).join('\n\n'), attachments: [...recovery.flatMap(item => item.attachments), ...latest.attachments], error: '模拟发送失败，内容与附件已恢复。请重试。', messages: [...latest.messages, { role: 'assistant', text: '本次为失败状态演示，没有发送到模型。' }] };
          }
          const [next, ...rest] = latest.queue;
          return { pending: next || null, queue: rest, messages: [...latest.messages, { role: 'assistant', text: `原型演示：已收到${pending.mode === '计划模式' ? '计划要求' : '这条消息'}。当前没有调用模型，也没有修改文件。` }, ...(next ? [{ role: 'user', text: next.text, attachments: next.attachments }] : [])] };
        });
      }, 1800);
      timers.current.set(session.id, timer);
    }
  }, [sessions]);
  useEffect(() => () => { for (const timer of timers.current.values()) clearTimeout(timer); timers.current.clear(); }, []);
  useEffect(() => { if (current.messages.length || current.pending) scroll.current?.scrollTo({ top: scroll.current.scrollHeight }); }, [current.messages.length, current.pending, currentId]);
  useEffect(() => {
    if (sidebarOpen) sidebar.current?.querySelector('button')?.focus();
  }, [sidebarOpen]);

  function selectSession(session) {
    setCurrentId(session.id); setReadOpen(false); setCommandsOpen(false); setSidebarOpen(false);
    const firstFile = examples[session.example]?.files[0];
    setSelectedFile(firstFile || ''); setDetailOpen(Boolean(firstFile) && !narrow); setExpanded(false);
  }
  function newSession(preset = null) {
    const session = blankSession(crypto.randomUUID(), '新会话', null, activeWorkspace);
    if (preset?.prompt) { session.draft = preset.prompt; setMode(preset.mode); }
    setSessions(list => [session, ...list]); selectSession(session); setQuery(''); setWorkspaceOpen(true);
    setDialog(null);
    setTimeout(() => editor.current?.focus(), 0);
  }
  function chooseStarter(preset) {
    update(currentId, session => ({ draft: [session.draft, preset.prompt].filter(Boolean).join('\n\n') }));
    setMode(preset.mode); editor.current?.focus();
  }
  function archiveSession(id, archived) {
    const target = sessions.find(session => session.id === id);
    if (!target || target.pending) return;
    update(id, { archived });
    if (archived && id === currentId) {
      const next = sessions.find(session => session.id !== id && !session.archived && session.workspace === activeWorkspace);
      if (next) selectSession(next);
      else {
        const session = blankSession(crypto.randomUUID(), '新会话', null, activeWorkspace);
        setSessions(list => [session, ...list]); selectSession(session);
      }
    }
  }
  function openHistorySession(session) {
    if (session.archived) update(session.id, { archived: false });
    selectSession(session); setDialog(null);
    setTimeout(() => editor.current?.focus(), 0);
  }
  function switchWorkspace(name) {
    setActiveWorkspace(name); setQuery(''); setWorkspaceOpen(true);
    const existing = sessions.find(session => !session.archived && session.workspace === name);
    if (existing) selectSession(existing);
    else { const session = blankSession(crypto.randomUUID(), '新会话', null, name); setSessions(list => [session, ...list]); selectSession(session); }
  }
  function openFile(filename, target) { detailTrigger.current = target; setSelectedFile(filename); setDetailOpen(true); setExpanded(false); }
  function closeDetail() { setDetailOpen(false); setExpanded(false); setTimeout(() => detailTrigger.current?.isConnected && detailTrigger.current.focus(), 0); }
  function closeSidebar() { setSidebarOpen(false); setTimeout(() => menuTrigger.current?.focus(), 0); }
  function submit(e) {
    e?.preventDefault();
    if (!hasInput) return;
    const pending = { id: crypto.randomUUID(), text: current.draft.trim(), attachments: current.attachments, fail: failNext, mode };
    setFailNext(false); setCommandsOpen(false);
    update(currentId, session => ({ draft: '', attachments: [], error: '', title: session.title === '新会话' ? (pending.text.slice(0, 22) || '附件讨论') : session.title, ...(session.pending ? { queue: [...session.queue, pending] } : { pending, messages: [...session.messages, { role: 'user', text: pending.text, attachments: pending.attachments }] }) }));
    editor.current?.focus();
  }
  function stop() {
    clearTimeout(timers.current.get(currentId)); timers.current.delete(currentId);
    update(currentId, session => ({ pending: null, queue: [], draft: [...session.queue.map(item => item.text).filter(Boolean), session.draft].filter(Boolean).join('\n\n'), attachments: [...session.queue.flatMap(item => item.attachments), ...session.attachments], messages: [...session.messages, { role: 'assistant', text: '演示已停止。未执行模型请求或文件操作；排队内容已保留在输入区。' }] }));
  }
  function sidebarKeys(e) {
    if (!sidebarOpen) return;
    if (e.key === 'Escape') { e.stopPropagation(); closeSidebar(); }
    if (e.key === 'Tab') {
      const nodes = [...sidebar.current.querySelectorAll('button, input, select')].filter(el => el.getClientRects().length);
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }

  return <div className={s.app} style={{ '--content-font': `${fontSize}px` }} onKeyDown={e => { if (e.key === 'Escape' && !dialog) { if (commandsOpen) setCommandsOpen(false); else if (shownDetail) closeDetail(); } }}>
    <aside ref={sidebar} className={`${s.sidebar} ${sidebarOpen ? s.sidebarVisible : ''}`} aria-label="会话导航" role={sidebarOpen ? 'dialog' : undefined} aria-modal={sidebarOpen || undefined} inert={narrow && !sidebarOpen ? true : undefined} onKeyDown={sidebarKeys}>
      <div className={s.brand}><img src="/assets/brand/mark.svg" alt="" className={s.brandMark}/><span className={s.brandName}>Kunora <span>Workbench</span></span><button className={`${s.iconButton} ${s.sidebarClose}`} aria-label="关闭导航" onClick={closeSidebar}><XIcon size={20}/></button></div>
      <button className={s.newSession} onClick={() => newSession()}><PlusIcon size={20}/>新建会话</button>
      <div className={s.workspaceToolbar}><span>工作区</span><div><IconButton label="搜索会话" onClick={() => { setSearchOpen(!searchOpen); setQuery(''); }} aria-expanded={searchOpen}><MagnifyingGlassIcon size={21}/></IconButton><IconButton label="管理工作区" onClick={e => openDialog('workspace', e.currentTarget)}><PlusSquareIcon size={21}/></IconButton></div></div>
      {searchOpen && <div className={s.search}><input autoFocus aria-label="搜索会话" placeholder="搜索会话…" value={query} onChange={e => setQuery(e.target.value)}/></div>}
      {workspaces.length > 1 && <select className={s.workspaceSelect} aria-label="当前工作区" value={activeWorkspace} onChange={e => switchWorkspace(e.target.value)} >{workspaces.map(name => <option key={name}>{name}</option>)}</select>}
      <button className={s.workspaceHeading} aria-expanded={workspaceOpen} onClick={() => setWorkspaceOpen(!workspaceOpen)}><FolderOpenIcon size={22}/><span title={activeWorkspace}>{activeWorkspace}</span><CaretDownIcon size={15} className={!workspaceOpen ? s.rotated : ''}/></button>
      <nav className={s.sessionList} aria-label="会话">{workspaceOpen && <>{visibleSessions.map(session => <button key={session.id} className={`${s.sessionItem} ${session.id === currentId ? s.activeSession : ''}`} aria-current={session.id === currentId ? 'page' : undefined} onClick={() => selectSession(session)} title={session.title}><ChatCircleDotsIcon size={22}/><span>{session.title}</span>{session.pending && <span className={s.runningIndicator} aria-label="演示运行中"/>}</button>)}{!visibleSessions.length && <p className={s.noSessions}>{query ? '没有匹配的会话' : '暂无会话，点击新建会话开始。'}</p>}</>}</nav>
      <button className={s.historyButton} onClick={e => openDialog('history', e.currentTarget)}><ClockCounterClockwiseIcon size={22}/>会话历史</button>
      <button className={s.settingsButton} onClick={e => openDialog('settings', e.currentTarget)}><GearIcon size={22}/>设置</button>
    </aside>
    {sidebarOpen && <div className={s.scrim} onClick={closeSidebar} aria-hidden="true"/>}
    <div className={s.shell} inert={sidebarOpen ? true : undefined}>
      <header className={s.topbar}><button ref={menuTrigger} className={`${s.iconButton} ${s.mobileMenu}`} aria-label="打开导航" onClick={() => setSidebarOpen(true)}><ListIcon size={22}/></button><div className={s.pageTitle}><h1>Kunora Workbench</h1><p title={current.title}>{current.title}</p></div><span className={s.previewLabel} title="本地原型，无模型调用；刷新将重置演示">设计预览 · 示例数据</span><div className={s.topbarActions}><button ref={filesTrigger} className={s.browseFiles} aria-label={`浏览会话文件，${example?.files.length || 0} 个`} onClick={e => openDialog('files', e.currentTarget)}><FolderOpenIcon size={20}/><span>会话文件</span><small>{example?.files.length || 0}</small></button><SessionMenu key={currentId} pending={current.pending} onRename={target => openDialog('rename', target)} onDuplicate={duplicateSession} onArchive={archiveCurrent}/></div></header>
      <div className={`${s.workArea} ${shownDetail ? s.withDetail : ''} ${expanded ? s.expandedDetail : ''}`}>
        <section className={s.conversation} aria-label="当前会话" inert={shownDetail && narrow ? true : undefined}>
          <div ref={scroll} className={s.transcript}>
            {current.sourceTitle && <div className={s.copyOrigin}><ChatCircleDotsIcon size={17}/><span>副本来源：{current.sourceTitle}。后续讨论与原会话独立。</span></div>}
            {example ? <>
              <div className={s.message}><span className={s.avatar} aria-hidden="true">你</span><div className={s.bubble}>{example.request}</div></div>
              <div className={s.tools}><button className={s.toolRow} aria-expanded={readOpen} onClick={() => setReadOpen(!readOpen)}><CheckCircleIcon size={21} weight="fill" className={s.check}/><span>读取文件 · {example.read.length} 个文件</span><CaretDownIcon size={17} className={readOpen ? s.rotated : ''}/></button>
                {readOpen && <div className={s.toolFiles}><span className={s.smallLabel}>已完成 · 示例记录</span>{example.read.map(file => <span key={file}>{file}</span>)}</div>}
                {example.files.length > 0 && <button className={s.toolRow} onClick={e => openFile(example.files[0], e.currentTarget)} aria-label={`查看编辑详情 ${example.files[0]}`}><CheckCircleIcon size={21} weight="fill" className={s.check}/><span>编辑文件 · {example.files[0]}</span><CaretDownIcon size={17}/></button>}
              </div>
              <div className={s.message}><span className={s.avatar} aria-hidden="true">K</span><div className={s.bubble}><p>{example.summary}</p><ul>{example.bullets.map(text => <li key={text}>{text}</li>)}</ul></div></div>
              {example.files.length > 0 && <section className={s.producedFiles} aria-label="产出文件"><h2>产出文件</h2>{example.files.map(filename => <button key={filename} aria-pressed={shownDetail && selectedFile === filename} className={`${s.fileButton} ${shownDetail && selectedFile === filename ? s.selectedFile : ''}`} onClick={e => openFile(filename, e.currentTarget)}>{filename.endsWith('.css') ? <CodeIcon size={23}/> : <FileTextIcon size={23}/>}<span>{filename}</span></button>)}</section>}
            </> : !current.messages.length && <NewSession workspace={activeWorkspace} onChoose={chooseStarter}/>}
            {current.messages.map((message, index) => <div key={index} className={s.message}><span className={s.avatar} aria-hidden="true">{message.role === 'user' ? '你' : 'K'}</span><div className={s.bubble}>{message.text}{message.attachments?.map(item => <span key={item.id} className={s.sentAttachment}><PaperclipIcon size={16}/>{item.name}</span>)}</div></div>)}
            {current.pending && <div className={s.runStatus} role="status"><span className={s.runningIndicator}/>正在演示回复…{current.queue.length > 0 && <span>已排队 {current.queue.length} 条</span>}</div>}
          </div>
          <div className={s.composerDock}>
            {current.error && <div className={s.error} role="alert"><WarningCircleIcon size={20}/><span>{current.error}</span></div>}
            <form className={s.composer} onSubmit={submit}>
              {current.attachments.length > 0 && <div className={s.attachments}>{current.attachments.map(file => <span key={file.id}><PaperclipIcon size={16}/><span>{file.name}</span><IconButton label={`移除附件 ${file.name}`} onClick={() => update(currentId, session => ({ attachments: session.attachments.filter(item => item.id !== file.id) }))}><XIcon size={14}/></IconButton></span>)}</div>}
              <textarea ref={editor} aria-label="消息内容" placeholder={current.example || current.messages.length ? '继续讨论或输入新要求…' : '描述你的目标，或选择上方建议开始…'} value={current.draft} onChange={e => update(currentId, { draft: e.target.value })} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && (sendKey === 'enter' || e.ctrlKey || e.metaKey)) { e.preventDefault(); submit(); } }}/>
              <div className={s.composerBar}><div className={s.composerTools}>
                <input ref={attachmentInput} type="file" multiple className={s.hiddenInput} aria-label="选择参考附件" onChange={e => { const attachments = [...e.target.files].map(file => ({ id: crypto.randomUUID(), name: file.name, size: file.size })); update(currentId, session => ({ attachments: [...session.attachments, ...attachments] })); e.target.value = ''; setAnnouncement('附件仅保留名称，不读取内容、不上传。'); }}/>
                <button type="button" className={s.textButton} aria-label="添加附件" onClick={() => attachmentInput.current.click()} title="附件仅保留名称，不上传"><PaperclipIcon size={23}/><span>附件</span></button>
                <div className={s.commandAnchor}><button type="button" className={s.textButton} aria-label="快捷指令" aria-expanded={commandsOpen} onClick={() => setCommandsOpen(!commandsOpen)}><TerminalIcon size={22}/><span>指令</span></button>{commandsOpen && <div className={s.commandMenu} aria-label="快捷指令列表">{['解释当前文件的变更。', '补充需要检查的项目。', '整理下一步工作计划。'].map(text => <button type="button" key={text} onClick={() => { update(currentId, session => ({ draft: [session.draft, text].filter(Boolean).join('\n') })); setCommandsOpen(false); editor.current.focus(); }}>{text}</button>)}</div>}</div>
              </div><div className={s.sendTools}><select aria-label="会话模式" value={mode} onChange={e => setMode(e.target.value)}><option>标准模式</option><option>计划模式</option></select>{current.pending && !hasInput ? <button type="button" className={s.primary} onClick={stop}><StopIcon weight="fill" size={16}/>停止</button> : <button type="submit" className={s.primary} disabled={!hasInput}>{current.pending ? '排队发送' : '发送'}</button>}</div></div>
            </form>
            <span className={s.composerHint}>{sendKey === 'enter' ? 'Enter 发送 · Shift + Enter 换行' : 'Ctrl / ⌘ + Enter 发送 · Enter 换行'} · 仅本地演示</span>
          </div>
        </section>
        {shownDetail && <Detail key={selectedFile} filename={selectedFile} expanded={expanded} onExpand={() => setExpanded(!expanded)} onClose={closeDetail} closeRef={closeDetailButton} mobile={narrow}/>}
      </div>
    </div>
    {dialog === 'settings' && <Dialog title="设置" wide onClose={closeDialog}><Settings fontSize={fontSize} setFontSize={setFontSize} sendKey={sendKey} setSendKey={setSendKey} failNext={failNext} setFailNext={setFailNext} onPreset={newSession}/></Dialog>}
    {dialog === 'history' && <Dialog title="会话历史" wide onClose={closeDialog}><SessionHistory sessions={sessions} workspace={activeWorkspace} currentId={currentId} onOpen={openHistorySession} onRename={(id, title) => update(id, { title })} onArchive={archiveSession} onNew={() => newSession()}/></Dialog>}
    {dialog === 'workspace' && <Dialog title="工作区管理" wide onClose={closeDialog}><WorkspaceManager workspaces={workspaces} sessions={sessions} activeWorkspace={activeWorkspace} onOpen={name => { switchWorkspace(name); setDialog(null); setTimeout(() => editor.current?.focus(), 0); }} onAdd={addWorkspace} onRename={renameWorkspace}/></Dialog>}
    {dialog === 'rename' && <Dialog title="重命名会话" onClose={closeDialog}><RenameSession title={current.title} onCancel={closeDialog} onSave={title => { update(currentId, { title }); closeDialog(); }}/></Dialog>}
    {dialog === 'files' && <Dialog title="会话文件" wide large onClose={closeDialog}><SessionFiles names={example?.files || []} sessionTitle={current.title} onClose={closeDialog} onCompare={filename => { setDialog(null); openFile(filename, filesTrigger.current); if (narrow) setTimeout(() => closeDetailButton.current?.focus(), 0); }} onReference={referenceFile}/></Dialog>}
    {toast && <div className={s.toast} role="status"><CheckCircleIcon size={20}/><span>{toast.text}</span>{toast.undoId && <button onClick={() => { const session = sessions.find(item => item.id === toast.undoId); if (session) { setActiveWorkspace(session.workspace); openHistorySession(session); } setToast(null); }}>撤销归档</button>}<IconButton label="关闭提示" onClick={() => setToast(null)}><XIcon size={18}/></IconButton></div>}
    <div className={s.srOnly} role="status" aria-live="polite">{announcement}</div>
  </div>;
}
