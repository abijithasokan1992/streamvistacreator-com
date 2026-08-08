const SUPABASE_URL = "https://solauojbnazfeutsxrwz.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_NgbkGb54HxLTHXQBuNGLhA_G360DZW2";
const SOURCE_REPO = "abijithasokan1992/StreamVista-Workspace-Portal";
const BACKEND_LABEL = "solauojbnazfeutsxrwz";

const pages = ["Overview","Agents","Departments","Repositories","Duplicates","Architecture","Tools","Connections","Sync"];
const params = new URLSearchParams(location.search);
const requested = params.get("view");
const initialPage = pages.find((p) => p.toLowerCase() === String(requested || "sync").toLowerCase()) || "Sync";
const state = { page: initialPage, data: null, error: null, loadedAt: null };

const $ = (s) => document.querySelector(s);
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]));
const fmt = (v) => v ? new Date(v).toLocaleString(undefined,{dateStyle:"medium",timeStyle:"short"}) : "—";
const ageMinutes = (v) => v ? Math.max(0, Math.round((Date.now()-new Date(v).getTime())/60000)) : null;

function pill(label, tone="neutral"){ return `<span class="pill ${tone}">${esc(label)}</span>`; }
function lifecycleTone(v){ return ({production:"good",tested:"violet",implemented:"info",catalogued:"neutral",legacy_candidate:"warn"})[v] || "neutral"; }
function statusTone(v){ return v==="success"||v==="connected" ? "good" : v==="blocked"||v==="planned" ? "warn" : v==="failed" ? "bad" : "neutral"; }

async function getTable(table, query=""){
  const url = `${SUPABASE_URL}/rest/v1/${table}?select=*${query}`;
  const res = await fetch(url,{headers:{apikey:SUPABASE_PUBLISHABLE_KEY,Accept:"application/json"}});
  if(!res.ok) throw new Error(`${table}: HTTP ${res.status}`);
  return res.json();
}

async function loadData(){
  state.error=null;
  $("#content").innerHTML=`<div class="loading">Loading real control-plane data…</div>`;
  try{
    const [agents,repositories,departments,tools,connections,duplicates,runs,settings] = await Promise.all([
      getTable("agents","&order=display_name.asc"),
      getTable("repositories","&order=name.asc"),
      getTable("departments","&order=sort_order.asc"),
      getTable("agent_tools","&order=tool_name.asc"),
      getTable("app_agent_connections","&order=app_name.asc"),
      getTable("duplicate_groups","&order=title.asc"),
      getTable("sync_runs","&order=started_at.desc&limit=25"),
      getTable("command_center_settings","&order=key.asc")
    ]);
    state.data={agents,repositories,departments,tools,connections,duplicates,runs,settings};
    state.loadedAt=new Date();
    render();
  }catch(err){
    state.error=err;
    $("#health-pill").className="pill bad";
    $("#health-pill").textContent="Backend error";
    $("#content").innerHTML=`<div class="error"><b>Real backend query failed.</b><br>${esc(err.message)}<br><br>This page fails closed: no cached or mock state is substituted.</div>`;
  }
}

function canonicalAgents(){ return (state.data?.agents||[]).filter(a=>a.duplicate_decision==="canonical"); }
function legacyAgents(){ return (state.data?.agents||[]).filter(a=>a.lifecycle_status==="legacy_candidate" || a.duplicate_decision==="superseded"); }
function latestSuccess(){ return (state.data?.runs||[]).find(r=>r.status==="success") || null; }
function latestProblem(){ return (state.data?.runs||[]).find(r=>r.status==="blocked" || r.status==="failed") || null; }
function syncHealth(){
  const s=latestSuccess();
  if(!s) return {label:"Never synced",tone:"bad"};
  const mins=ageMinutes(s.finished_at || s.started_at);
  if(mins!==null && mins <= 180) return {label:"Sync healthy",tone:"good"};
  if(mins!==null && mins <= 1440) return {label:"Sync stale",tone:"warn"};
  return {label:"Sync degraded",tone:"bad"};
}

function setPage(page){
  state.page=page;
  const url = new URL(location.href);
  if(page === "Sync") url.searchParams.delete("view"); else url.searchParams.set("view",page.toLowerCase());
  history.replaceState(null,"",url.pathname + url.search);
  render();
}

function nav(){
  $("#nav").innerHTML=pages.map(p=>`<button class="nav-btn ${state.page===p?"active":""}" data-page="${p}">${p}</button>`).join("");
  document.querySelectorAll(".nav-btn").forEach(b=>b.onclick=()=>setPage(b.dataset.page));
}

function render(){
  nav();
  $("#page-title").textContent=state.page;
  const health=syncHealth();
  $("#health-pill").className=`pill ${health.tone}`;
  $("#health-pill").textContent=health.label;
  const map={Overview:renderOverview,Agents:renderAgents,Departments:renderDepartments,Repositories:renderRepositories,Duplicates:renderDuplicates,Architecture:renderArchitecture,Tools:renderTools,Connections:renderConnections,Sync:renderSync};
  $("#content").innerHTML=map[state.page]();
}

function stat(label,value,hint){ return `<div class="card stat"><span>${esc(label)}</span><strong>${esc(value)}</strong><small>${esc(hint)}</small></div>`; }
function section(title,desc){ return `<div class="section-title"><h2>${esc(title)}</h2><p>${esc(desc||"")}</p></div>`; }

function renderOverview(){
  const d=state.data, canonical=canonicalAgents(), legacy=legacyAgents(), success=latestSuccess();
  const tested=canonical.filter(a=>a.lifecycle_status==="tested").length;
  const production=canonical.filter(a=>a.lifecycle_status==="production").length;
  const connected=d.connections.filter(c=>c.status==="connected").length;
  const planned=d.connections.filter(c=>c.status==="planned").length;
  return `
    <div class="grid stats">
      ${stat("Repositories",d.repositories.length,"Control-plane inventory rows")}
      ${stat("Canonical agents",canonical.length,"Active canonical definitions")}
      ${stat("Tested",tested,"Verified lifecycle state")}
      ${stat("Production",production,"Requires deployed runtime evidence")}
      ${stat("Legacy candidates",legacy.length,"Retained audit history")}
      ${stat("Connected routes",connected,"Authenticated runtime evidence only")}
      ${stat("Planned routes",planned,"Not connected yet")}
      ${stat("Last successful sync",success?fmt(success.finished_at||success.started_at):"—","Primary sync health signal")}
    </div>
    <div class="notice good" style="margin-top:14px"><b>Real backend wire verified.</b> This page reads the Command Center Supabase control-plane directly. No mock fallback is used.</div>
    ${section("Production reality","Fail-closed lifecycle summary")}
    <div class="grid two">
      <div class="card"><b>What is verified</b><div class="meta-row">${pill(`${canonical.length} canonical agents`,"violet")}${pill(`${tested} tested`,"good")}${pill(`${d.repositories.length} repositories`,"info")}</div><p class="sub">Inventory, sync evidence and tested lifecycle are separate from deployment evidence.</p></div>
      <div class="card"><b>What is not promoted</b><div class="meta-row">${pill(`${connected}/${d.connections.length} routes connected`,connected?"good":"warn")}${pill(`${production} production agents`,production?"good":"warn")}</div><p class="sub">No route or agent is promoted to production without deployed, authenticated, app-scoped invocation evidence.</p></div>
    </div>
    ${section("Latest sync evidence","Newest control-plane events")}
    ${timeline(d.runs.slice(0,6))}
  `;
}

function renderAgents(){
  const rows=(state.data.agents||[]);
  return `${section("Agent registry",`${canonicalAgents().length} canonical · ${legacyAgents().length} legacy candidates`)}
  <div class="panel"><table><thead><tr><th>Agent</th><th>Lifecycle</th><th>Department</th><th>Risk</th><th>Source</th></tr></thead><tbody>
  ${rows.map(a=>`<tr><td><span class="name">${esc(a.display_name)}</span><span class="sub mono">${esc(a.canonical_id)}</span></td><td>${pill(a.lifecycle_status,lifecycleTone(a.lifecycle_status))}<span class="sub">${esc(a.duplicate_decision)}</span></td><td>${esc(a.department_slug)}</td><td>${pill(a.risk_level,a.risk_level==="high"?"bad":a.risk_level==="medium"?"warn":"neutral")}</td><td><span class="mono">${esc(a.source_repository)}</span><span class="sub mono">${esc(a.source_path)}</span></td></tr>`).join("")}
  </tbody></table></div>`;
}

function renderDepartments(){
  const canonical=canonicalAgents();
  return `${section("Departments","Canonical agent ownership")}
  <div class="grid dept-grid">${state.data.departments.map(d=>{const n=canonical.filter(a=>a.department_slug===d.slug).length;return `<div class="card dept-card"><b>${esc(d.name)}</b><p>${esc(d.description)}</p><strong>${n}</strong><span class="sub">canonical agents</span></div>`}).join("")}</div>`;
}

function renderRepositories(){
  return `${section("Repositories","GitHub remains source of truth")}
  <div class="panel"><table><thead><tr><th>Repository</th><th>Visibility</th><th>Agent state</th><th>Agents</th><th>Action</th><th>Last scan</th></tr></thead><tbody>
  ${state.data.repositories.map(r=>`<tr><td class="name">${esc(r.name)}</td><td>${pill(r.visibility,r.visibility==="private"?"violet":"info")}</td><td>${pill(r.agent_state,lifecycleTone(r.agent_state))}</td><td>${esc(r.agent_count)}</td><td>${esc(r.action_needed)}</td><td>${fmt(r.last_scan_at)}</td></tr>`).join("")}
  </tbody></table></div>`;
}

function renderDuplicates(){
  const ds=state.data.duplicates;
  if(!ds.length) return `<div class="empty">No duplicate groups are currently recorded in the real backend.</div>`;
  return `${section("Duplicate groups","Canonicalization decisions")}
  <div class="grid two">${ds.map(x=>`<div class="card"><div class="meta-row">${pill(x.duplicate_type,"warn")}${pill(x.canonical_decision||"pending","neutral")}</div><h3>${esc(x.title)}</h3><p class="sub">${esc(x.rationale)}</p><div class="mono sub">${(x.candidate_sources||[]).map(esc).join("<br>")}</div></div>`).join("")}</div>`;
}

function renderArchitecture(){
  const c=canonicalAgents().length, routes=state.data.connections.length;
  return `${section("Architecture","GitHub-first, evidence-gated runtime")}
  <div class="architecture">
    ${layer("Products",`${new Set(state.data.connections.map(x=>x.app_key)).size} registered apps`,`Applications consume agents only through verified app-scoped routes.`)}
    ${layer("Command Center","Read-only control plane",`Supabase ${BACKEND_LABEL} registry + audit timeline. No production promotion from UI state.`)}
    ${layer("Agent runtime",`${c} canonical agents`,"Canonical registry is tested; production status requires deployed runtime evidence.")}
    ${layer("Connections",`${routes} app-agent routes`,"Current statuses remain planned/not_connected until authenticated evidence exists.")}
    ${layer("GitHub",SOURCE_REPO,"GitHub is the source of truth for maintained code and canonical inventory.")}
  </div>`;
}
function layer(label,title,desc){return `<div class="layer"><div class="layer-label">${esc(label)}</div><div class="layer-body"><b>${esc(title)}</b><span>${esc(desc)}</span></div></div>`;}

function renderTools(){
  const by=new Map();
  state.data.tools.forEach(t=>{const k=t.tool_key||t.tool_name;if(!by.has(k))by.set(k,{...t,agents:[]});by.get(k).agents.push(t.agent_canonical_id)});
  return `${section("Tool registry",`${by.size} unique tools mapped to agents`)}
  <div class="grid tools-grid">${[...by.values()].map(t=>`<div class="card tool-card"><h3>${esc(t.tool_name)}</h3><p>${esc(t.description)}</p><footer><span>${esc(t.category)}</span><span>${esc(t.agents.length)} agent mappings</span></footer></div>`).join("")}</div>`;
}

function renderConnections(){
  const cs=state.data.connections, agents=canonicalAgents().map(a=>a.canonical_id), apps=[...new Map(cs.map(c=>[c.app_key,c.app_name])).entries()];
  const lookup=new Map(cs.map(c=>[`${c.app_key}|${c.agent_canonical_id}`,c.status]));
  return `${section("App × agent matrix","Planned is not connected")}
  <div class="notice warn"><b>${cs.filter(c=>c.status==="connected").length} connected · ${cs.filter(c=>c.status==="planned").length} planned.</b> A route becomes connected only after deployed, authenticated, app-scoped invocation evidence exists.</div>
  <div class="panel matrix-wrap" style="margin-top:14px"><table class="matrix"><thead><tr><th>App</th>${agents.map(a=>`<th title="${esc(a)}">${esc(a.replace("-agent",""))}</th>`).join("")}</tr></thead><tbody>
  ${apps.map(([key,name])=>`<tr><td><span class="name">${esc(name)}</span><span class="sub mono">${esc(key)}</span></td>${agents.map(a=>{const s=lookup.get(`${key}|${a}`)||"not_connected";return `<td title="${esc(s)}"><span class="cell ${esc(s)}"></span></td>`}).join("")}</tr>`).join("")}
  </tbody></table></div>`;
}

function renderSync(){
  const s=latestSuccess(), latest=state.data.runs[0], problem=latestProblem(), health=syncHealth();
  const privateRefreshBlocked = Boolean(problem && /private|credential|token/i.test(problem.message||""));
  return `${section("GitHub sync","Connector/database sync is primary; private autonomous refresh is a separate capability")}
  <div class="grid stats">
    ${stat("Sync health",health.label,"Based on latest successful control-plane sync")}
    ${stat("Backend","Real",`Supabase ${BACKEND_LABEL}`)}
    ${stat("Last success",s?fmt(s.finished_at||s.started_at):"—",s?`${s.repositories_synced} repos · ${s.agents_synced} agents`:"No success")}
    ${stat("Dashboard refresh","60s","Direct read from real control-plane tables")}
  </div>
  <div class="notice good" style="margin-top:14px"><b>Core wire:</b> authenticated connector/database sync evidence can be valid without exposing or storing a GitHub token in this browser. This public page never receives a private GitHub credential.</div>
  ${privateRefreshBlocked ? `<div class="notice warn" style="margin-top:12px"><b>Autonomous private-repository refresh is blocked.</b> ${esc(problem.message)} This does not promote stale private data to current; preserved snapshots remain historical evidence only.</div>`:""}
  ${latest && latest.status==="blocked" && !privateRefreshBlocked ? `<div class="notice warn" style="margin-top:12px"><b>Newest blocked event:</b> ${esc(latest.message)}</div>`:""}
  ${section("Audit timeline","Newest 25 sync attempts from the real backend")}
  ${timeline(state.data.runs)}
  `;
}

function timeline(runs){
  if(!runs.length) return `<div class="empty">No sync runs.</div>`;
  return `<div class="panel timeline">${runs.map(r=>`<div class="event"><time>${fmt(r.started_at)}</time><div>${pill(r.status,statusTone(r.status))}<span class="sub">${esc(r.trigger_source)}</span></div><p>${esc(r.message)}<span class="sub">${esc(r.repositories_synced)} repositories · ${esc(r.agents_synced)} agents</span></p></div>`).join("")}</div>`;
}

$("#refresh-button").onclick=loadData;
nav();
loadData();
setInterval(loadData,60000);
