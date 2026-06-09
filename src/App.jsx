import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://pemhpcgkmuqjucaeqhdy.supabase.co";
const SUPABASE_KEY = "sb_publishable_g7EPoWwXGTZjQBpkW6unTg_FAxKMGfh";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const ADMIN_PASSWORD = "admin2026";

function Toast({ msg, type, onUndo }) {
  if (!msg) return null;
  return (
    <div style={{
      position: "fixed", bottom: 24, right: 24, zIndex: 9999,
      background: type === "error" ? "#ef4444" : "#1e2235",
      border: "1px solid " + (type === "error" ? "#ef4444" : "#3d4268"),
      color: "#fff", padding: "12px 20px", borderRadius: 10,
      fontWeight: 600, fontSize: 14, boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
      display: "flex", alignItems: "center", gap: 14
    }}>
      <span>{msg}</span>
      {onUndo && (
        <button onClick={onUndo} style={{ background: "#6366f1", border: "none", color: "#fff", padding: "4px 12px", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 700 }}>
          Отменить
        </button>
      )}
    </div>
  );
}

// ─── ADMIN PAGE ───────────────────────────────────────────────────────────────
function AdminPage({ onLogout }) {
  const [managers, setManagers] = useState([]);
  const [platforms, setPlatforms] = useState([]);
  const [deposits, setDeposits] = useState([]);
  const [offers, setOffers] = useState([]);
  const [newName, setNewName] = useState("");
  const [toast, setToast] = useState(null);
  const [tab, setTab] = useState("overview");
  const [showPlatformForm, setShowPlatformForm] = useState(false);
  const [editingPlatform, setEditingPlatform] = useState(null);
  const [pForm, setPForm] = useState({ name: "", target_avg_check: "", date_added: "", is_active: true, kapa: "" });
  const [dragIdx, setDragIdx] = useState(null);

  const showToast = (msg, type = "ok", onUndo = null) => {
    setToast({ msg, type, onUndo });
    setTimeout(() => setToast(null), 4000);
  };

  const load = async () => {
    const [{ data: m }, { data: p }, { data: d }, { data: o }] = await Promise.all([
      supabase.from("managers").select("*").order("created_at"),
      supabase.from("platforms").select("*").order("sort_order", { ascending: true, nullsFirst: false }).order("name"),
      supabase.from("deposits").select("*"),
      supabase.from("offers").select("*, platforms(name)").order("date"),
    ]);
    setManagers(m || []);
    setPlatforms(p || []);
    setDeposits(d || []);
    setOffers(o || []);
  };

  useEffect(() => { load(); }, []);

  const createManager = async () => {
    if (!newName.trim()) return;
    const token = Math.random().toString(36).substring(2, 10).toUpperCase();
    const { error } = await supabase.from("managers").insert({ name: newName.trim(), token });
    if (error) { showToast("Ошибка создания", "error"); return; }
    showToast(`Менеджер создан! Токен: ${token}`);
    setNewName("");
    load();
  };

  const toggleManager = async (m) => {
    await supabase.from("managers").update({ is_active: !m.is_active }).eq("id", m.id);
    load();
  };

  const deleteManager = async (id) => {
    if (!confirm("Удалить менеджера и все его данные?")) return;
    await supabase.from("managers").delete().eq("id", id);
    load();
  };

  const openPlatformForm = (p = null) => {
    if (p) {
      setEditingPlatform(p);
      const offer = offers.find(o => o.platform_id === p.id);
      setPForm({ name: p.name, target_avg_check: p.target_avg_check, date_added: p.date_added || "", is_active: p.is_active !== false, kapa: offer?.cap ?? "" });
    } else {
      setEditingPlatform(null);
      setPForm({ name: "", target_avg_check: "", date_added: new Date().toISOString().slice(0,10), is_active: true, kapa: "" });
    }
    setShowPlatformForm(true);
  };

  const savePlatform = async () => {
    if (!pForm.name.trim() || !pForm.target_avg_check) { showToast("Заполни все поля", "error"); return; }
    const maxOrder = platforms.length > 0 ? Math.max(...platforms.map(p => p.sort_order || 0)) : 0;
    const data = { name: pForm.name.trim(), target_avg_check: Number(pForm.target_avg_check), date_added: pForm.date_added || null, is_active: pForm.is_active };
    let platformId = editingPlatform?.id;
    if (editingPlatform) {
      await supabase.from("platforms").update(data).eq("id", editingPlatform.id);
      showToast("Платформа обновлена!");
    } else {
      const { data: newP } = await supabase.from("platforms").insert({ ...data, sort_order: maxOrder + 1 }).select().single();
      platformId = newP?.id;
      showToast("Платформа добавлена!");
    }
    // Handle kapa/offer
    if (platformId) {
      const existingOffer = offers.find(o => o.platform_id === platformId);
      const kapa = pForm.kapa ? parseInt(pForm.kapa) : null;
      if (kapa && existingOffer) {
        await supabase.from("offers").update({ cap: kapa }).eq("id", existingOffer.id);
      } else if (kapa && !existingOffer) {
        await supabase.from("offers").insert({ platform_id: platformId, date: pForm.date_added || new Date().toISOString().slice(0,10), cap: kapa, status: "active" });
      } else if (!kapa && existingOffer) {
        await supabase.from("offers").delete().eq("id", existingOffer.id);
      }
    }
    setShowPlatformForm(false);
    load();
  };

  const togglePlatform = async (p) => {
    await supabase.from("platforms").update({ is_active: !(p.is_active !== false) }).eq("id", p.id);
    load();
  };

  const deletePlatform = async (id) => {
    if (!confirm("Удалить платформу и все её данные?")) return;
    await supabase.from("platforms").delete().eq("id", id);
    load();
  };

  const handleDragStart = (idx) => setDragIdx(idx);
  const handleDragOver = (e, idx) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) return;
    const reordered = [...platforms];
    const [moved] = reordered.splice(dragIdx, 1);
    reordered.splice(idx, 0, moved);
    setPlatforms(reordered);
    setDragIdx(idx);
  };
  const handleDragEnd = async () => {
    setDragIdx(null);
    // Save new order to DB
    await Promise.all(platforms.map((p, i) =>
      supabase.from("platforms").update({ sort_order: i }).eq("id", p.id)
    ));
  };

  const activePlatforms = platforms.filter(p => p.is_active !== false);

  const platformStats = platforms.map(p => {
    const deps = deposits.filter(d => d.platform_id === p.id);
    const totalCount = deps.reduce((s, d) => s + d.count, 0);
    const totalAmount = deps.reduce((s, d) => s + Number(d.amount), 0);
    const avgCheck = totalCount > 0 ? totalAmount / totalCount : 0;
    const offer = offers.find(o => o.platform_id === p.id);
    return { ...p, totalCount, totalAmount, avgCheck, offer };
  });

  const managerStats = managers.map(m => {
    const deps = deposits.filter(d => d.manager_id === m.id);
    const totalCount = deps.reduce((s, d) => s + d.count, 0);
    const totalAmount = deps.reduce((s, d) => s + Number(d.amount), 0);
    const byPlatform = activePlatforms.map(p => {
      const pd = deps.filter(d => d.platform_id === p.id);
      const cnt = pd.reduce((s, d) => s + d.count, 0);
      const amt = pd.reduce((s, d) => s + Number(d.amount), 0);
      const avg = cnt > 0 ? amt / cnt : 0;
      return { ...p, cnt, amt, avg };
    }).filter(p => p.cnt > 0);
    return { ...m, totalCount, totalAmount, byPlatform };
  });

  const S = {
    th: { padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", borderBottom: "1px solid #2d3148" },
    td: { padding: "13px 14px", borderBottom: "1px solid #1a1d27" },
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0f1117", color: "#e2e8f0", fontFamily: "'Inter', sans-serif" }}>
      {toast && <Toast msg={toast.msg} type={toast.type} onUndo={toast.onUndo} />}

      {showPlatformForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#1a1d27", border: "1px solid #2d3148", borderRadius: 14, padding: 28, width: 400 }}>
            <h3 style={{ color: "#fff", marginBottom: 20, fontSize: 16 }}>{editingPlatform ? "Редактировать платформу" : "Добавить платформу"}</h3>
            {[["Название", "name", "text", "PL ClickID XON"], ["Целевой СЧ (€)", "target_avg_check", "number", "50"], ["Капа (кол-во депозитов)", "kapa", "number", "20"], ["Дата добавления", "date_added", "date", ""]].map(([label, key, type, ph]) => (
              <div key={key} style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 11, color: "#64748b", marginBottom: 5, fontWeight: 600, textTransform: "uppercase" }}>{label}</label>
                <input type={type} value={pForm[key]} placeholder={ph}
                  onChange={e => setPForm(f => ({ ...f, [key]: e.target.value }))}
                  style={{ width: "100%", background: "#0f1117", border: "1px solid #2d3148", color: "#e2e8f0", padding: "10px 12px", borderRadius: 8, fontSize: 14, outline: "none", boxSizing: "border-box" }} />
              </div>
            ))}
            <div style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
              <input type="checkbox" id="isActive" checked={pForm.is_active} onChange={e => setPForm(f => ({ ...f, is_active: e.target.checked }))} />
              <label htmlFor="isActive" style={{ color: "#94a3b8", fontSize: 14 }}>Платформа активна</label>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={savePlatform} style={{ flex: 1, background: "#6366f1", color: "#fff", border: "none", padding: "10px", borderRadius: 8, cursor: "pointer", fontWeight: 700 }}>Сохранить</button>
              <button onClick={() => setShowPlatformForm(false)} style={{ flex: 1, background: "#1e2235", color: "#94a3b8", border: "1px solid #2d3148", padding: "10px", borderRadius: 8, cursor: "pointer" }}>Отмена</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ background: "#1a1d27", borderBottom: "1px solid #2d3148", padding: "16px 32px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#6366f1" }} />
          <span style={{ fontWeight: 700, fontSize: 16, letterSpacing: "0.05em", color: "#fff" }}>АРБИТРАЖ</span>
          <span style={{ background: "#6366f1", color: "#fff", fontSize: 10, padding: "2px 8px", borderRadius: 4, fontWeight: 700 }}>ADMIN</span>
        </div>
        <button onClick={onLogout} style={{ background: "transparent", border: "1px solid #3d4268", color: "#94a3b8", padding: "6px 14px", borderRadius: 6, cursor: "pointer", fontSize: 13 }}>Выйти</button>
      </div>

      <div style={{ background: "#1a1d27", borderBottom: "1px solid #2d3148", padding: "0 32px", display: "flex" }}>
        {[["overview", "Сводка"], ["managers", "Менеджеры"], ["platforms", "Платформы и офферы"]].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{
            background: "transparent", border: "none", color: tab === key ? "#6366f1" : "#64748b",
            padding: "14px 20px", cursor: "pointer", fontSize: 14, fontWeight: 600,
            borderBottom: tab === key ? "2px solid #6366f1" : "2px solid transparent"
          }}>{label}</button>
        ))}
      </div>

      <div style={{ padding: "32px", maxWidth: 1200, margin: "0 auto" }}>

        {tab === "overview" && (
          <div>
            <h2 style={{ color: "#fff", marginBottom: 24, fontSize: 20 }}>Общий СЧ по платформам</h2>
            <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 40 }}>
              <thead>
                <tr style={{ background: "#1e2235" }}>
                  {["Платформа", "Кол-во депов", "Сумма", "СЧ ФАКТ", "СЧ ЦЕЛЬ", "КАПА", "Выполнено", "Статус"].map(h => <th key={h} style={S.th}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {platformStats.map(p => {
                  const ok = p.avgCheck >= p.target_avg_check;
                  const isActive = p.is_active !== false;
                  return (
                    <tr key={p.id} style={{ borderBottom: "1px solid #1e2235", opacity: isActive ? 1 : 0.45 }}>
                      <td style={S.td}>
                        <span style={{ fontWeight: 600, color: "#e2e8f0" }}>{p.name}</span>
                        {p.date_added && <span style={{ display: "block", fontSize: 11, color: "#475569", marginTop: 2 }}>{p.date_added}</span>}
                      </td>
                      <td style={{ ...S.td, color: "#94a3b8" }}>{p.totalCount}</td>
                      <td style={{ ...S.td, color: "#94a3b8" }}>{p.totalAmount.toFixed(0)}€</td>
                      <td style={S.td}>
                        <span style={{ background: p.totalCount === 0 ? "#1e2235" : ok ? "#166534" : "#7f1d1d", color: p.totalCount === 0 ? "#64748b" : ok ? "#86efac" : "#fca5a5", padding: "4px 10px", borderRadius: 6, fontWeight: 700, fontSize: 13 }}>
                          {p.totalCount === 0 ? "—" : p.avgCheck.toFixed(1) + "€"}
                        </span>
                      </td>
                      <td style={{ ...S.td, color: "#94a3b8" }}>{p.target_avg_check}€</td>
                      <td style={{ ...S.td, color: "#94a3b8" }}>{p.offer?.cap ?? "—"}</td>
                      <td style={S.td}>
                        {p.offer ? <span style={{ color: "#94a3b8", fontSize: 13 }}>{p.totalCount} / {p.offer.cap} <span style={{ color: p.totalCount >= p.offer.cap ? "#86efac" : "#f59e0b" }}>({Math.round((p.totalCount / p.offer.cap) * 100)}%)</span></span> : "—"}
                      </td>
                      <td style={S.td}>
                        <span style={{ background: isActive ? "#14532d" : "#1e2235", color: isActive ? "#86efac" : "#64748b", padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600 }}>
                          {isActive ? "Активна" : "Скрыта"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <h2 style={{ color: "#fff", marginBottom: 24, fontSize: 20 }}>По менеджерам</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {managerStats.map(m => (
                <div key={m.id} style={{ background: "#1a1d27", border: "1px solid #2d3148", borderRadius: 12, overflow: "hidden" }}>
                  <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: m.byPlatform.length > 0 ? "1px solid #2d3148" : "none" }}>
                    <span style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>{m.name}</span>
                    <div style={{ display: "flex", gap: 20 }}>
                      <span style={{ color: "#64748b", fontSize: 13 }}>Депозитов: <span style={{ color: "#94a3b8", fontWeight: 600 }}>{m.totalCount}</span></span>
                      <span style={{ color: "#64748b", fontSize: 13 }}>Сумма: <span style={{ color: "#94a3b8", fontWeight: 600 }}>{m.totalAmount.toFixed(0)}€</span></span>
                    </div>
                  </div>
                  {m.byPlatform.length > 0 && (
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ background: "#151824" }}>
                          {["Платформа", "Депи", "Сумма", "СЧ цель", "СЧ факт"].map(h => <th key={h} style={{ ...S.th, padding: "8px 20px" }}>{h}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {m.byPlatform.map(p => {
                          const ok = p.avg >= p.target_avg_check;
                          return (
                            <tr key={p.id}>
                              <td style={{ padding: "10px 20px", color: "#cbd5e1", fontSize: 13 }}>{p.name}</td>
                              <td style={{ padding: "10px 20px", color: "#94a3b8", fontSize: 13 }}>{p.cnt}</td>
                              <td style={{ padding: "10px 20px", color: "#94a3b8", fontSize: 13 }}>{p.amt.toFixed(0)}€</td>
                              <td style={{ padding: "10px 20px", color: "#94a3b8", fontSize: 13 }}>{p.target_avg_check}€</td>
                              <td style={{ padding: "10px 20px" }}>
                                <span style={{ background: ok ? "#166534" : "#7f1d1d", color: ok ? "#86efac" : "#fca5a5", padding: "3px 10px", borderRadius: 6, fontWeight: 700, fontSize: 13 }}>{p.avg.toFixed(1)}€</span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                  {m.byPlatform.length === 0 && <div style={{ padding: "12px 20px", color: "#475569", fontSize: 13 }}>Нет данных</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "managers" && (
          <div>
            <h2 style={{ color: "#fff", marginBottom: 24, fontSize: 20 }}>Менеджеры</h2>
            <div style={{ background: "#1a1d27", border: "1px solid #2d3148", borderRadius: 10, padding: 24, marginBottom: 32, display: "flex", gap: 12, alignItems: "flex-end" }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: "block", fontSize: 12, color: "#64748b", marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Имя менеджера</label>
                <input value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === "Enter" && createManager()} placeholder="Например: Коля Н"
                  style={{ width: "100%", background: "#0f1117", border: "1px solid #2d3148", color: "#e2e8f0", padding: "10px 14px", borderRadius: 8, fontSize: 14, outline: "none", boxSizing: "border-box" }} />
              </div>
              <button onClick={createManager} style={{ background: "#6366f1", color: "#fff", border: "none", padding: "10px 24px", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 14, whiteSpace: "nowrap" }}>+ Создать</button>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#1e2235" }}>
                  {["Имя", "Токен", "Статус", "Депозитов", "Действия"].map(h => <th key={h} style={S.th}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {managers.map(m => {
                  const deps = deposits.filter(d => d.manager_id === m.id);
                  const count = deps.reduce((s, d) => s + d.count, 0);
                  return (
                    <tr key={m.id} style={{ borderBottom: "1px solid #1e2235" }}>
                      <td style={{ ...S.td, fontWeight: 600, color: "#e2e8f0" }}>{m.name}</td>
                      <td style={S.td}><code style={{ background: "#0f1117", border: "1px solid #2d3148", padding: "4px 10px", borderRadius: 6, fontSize: 13, color: "#a5b4fc", letterSpacing: "0.1em" }}>{m.token}</code></td>
                      <td style={S.td}><span style={{ background: m.is_active ? "#14532d" : "#1e2235", color: m.is_active ? "#86efac" : "#64748b", padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600 }}>{m.is_active ? "Активен" : "Отключён"}</span></td>
                      <td style={{ ...S.td, color: "#94a3b8" }}>{count}</td>
                      <td style={{ ...S.td, display: "flex", gap: 8 }}>
                        <button onClick={() => toggleManager(m)} style={{ background: "#1e2235", border: "1px solid #2d3148", color: "#94a3b8", padding: "6px 12px", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>{m.is_active ? "Отключить" : "Включить"}</button>
                        <button onClick={() => deleteManager(m.id)} style={{ background: "#7f1d1d", border: "none", color: "#fca5a5", padding: "6px 12px", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>Удалить</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {tab === "platforms" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <h2 style={{ color: "#fff", fontSize: 20, margin: 0 }}>Платформы и офферы</h2>
              <button onClick={() => openPlatformForm()} style={{ background: "#6366f1", color: "#fff", border: "none", padding: "10px 20px", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}>+ Добавить</button>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#1e2235" }}>
                  {["Платформа", "Дата", "Цель СЧ", "Капа", "Выполнено", "Статус", "Действия"].map(h => <th key={h} style={S.th}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {platforms.map(p => {
                  const isActive = p.is_active !== false;
                  const deps = deposits.filter(d => d.platform_id === p.id);
                  const done = deps.reduce((s, d) => s + d.count, 0);
                  const offer = offers.find(o => o.platform_id === p.id);
                  const kapa = offer?.cap ?? null;
                  const pct = kapa ? Math.min(100, Math.round((done / kapa) * 100)) : 0;
                  return (
                    <tr key={p.id} draggable onDragStart={() => handleDragStart(platforms.indexOf(p))} onDragOver={(e) => handleDragOver(e, platforms.indexOf(p))} onDragEnd={handleDragEnd} style={{ borderBottom: "1px solid #1e2235", opacity: isActive ? 1 : 0.5, cursor: "grab" }}>
                      <td style={{ ...S.td, fontWeight: 600, color: "#e2e8f0" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ color: "#3d4268", fontSize: 14, cursor: "grab", userSelect: "none" }}>⠿</span>
                          {p.name}
                        </div>
                      </td>
                      <td style={{ ...S.td, color: "#94a3b8" }}>{p.date_added || "—"}</td>
                      <td style={{ ...S.td, color: "#94a3b8" }}>{p.target_avg_check}€</td>
                      <td style={{ ...S.td, color: "#94a3b8" }}>{kapa ?? "—"}</td>
                      <td style={S.td}>
                        {kapa ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ width: 50, background: "#0f1117", borderRadius: 4, height: 5, overflow: "hidden" }}>
                              <div style={{ width: `${pct}%`, height: "100%", background: "#6366f1", borderRadius: 4 }} />
                            </div>
                            <span style={{ color: "#94a3b8", fontSize: 12 }}>{done}/{kapa}</span>
                          </div>
                        ) : <span style={{ color: "#475569" }}>—</span>}
                      </td>
                      <td style={S.td}><span style={{ background: isActive ? "#14532d" : "#1e2235", color: isActive ? "#86efac" : "#64748b", padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600 }}>{isActive ? "Активна" : "Скрыта"}</span></td>
                      <td style={S.td}>
                        <div style={{ display: "flex", flexDirection: "row", gap: 4, alignItems: "center" }}>
                          <button onClick={() => openPlatformForm(p)} title="Изменить" style={{ background: "transparent", border: "1px solid #2d3148", color: "#94a3b8", width: 30, height: 30, borderRadius: 6, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                          </button>
                          <button onClick={() => togglePlatform(p)} title={isActive ? "Скрыть" : "Показать"} style={{ background: "transparent", border: "1px solid #2d3148", color: isActive ? "#94a3b8" : "#6366f1", width: 30, height: 30, borderRadius: 6, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            {isActive ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg> : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>}
                          </button>
                          <button onClick={() => deletePlatform(p.id)} title="Удалить" style={{ background: "transparent", border: "1px solid #7f1d1d", color: "#fca5a5", width: 30, height: 30, borderRadius: 6, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── MANAGER PAGE ─────────────────────────────────────────────────────────────
function ManagerPage({ manager, onLogout }) {
  const [platforms, setPlatforms] = useState([]);
  const [deposits, setDeposits] = useState([]);
  const [offers, setOffers] = useState([]);
  const [inputs, setInputs] = useState({});
  const [saving, setSaving] = useState(null);
  const [toast, setToast] = useState(null);
  const [managerTab, setManagerTab] = useState("deposit");
  const [editingDeposit, setEditingDeposit] = useState(null); // { platformId, count, amount }
  const [lastAction, setLastAction] = useState(null); // for undo

  const showToast = (msg, type = "ok", onUndo = null) => {
    setToast({ msg, type, onUndo });
    setTimeout(() => setToast(null), 5000);
  };

  const load = async () => {
    const [{ data: p }, { data: d }, { data: o }] = await Promise.all([
      supabase.from("platforms").select("*").eq("is_active", true).order("name"),
      supabase.from("deposits").select("*").eq("manager_id", manager.id),
      supabase.from("offers").select("*, platforms(name)").order("date"),
    ]);
    setPlatforms(p || []);
    setDeposits(d || []);
    setOffers(o || []);
  };

  useEffect(() => { load(); }, []);

  const getDeposit = (platformId) => deposits.find(d => d.platform_id === platformId);

  const handleInput = (platformId, field, value) => {
    setInputs(prev => ({ ...prev, [platformId]: { ...prev[platformId], [field]: value } }));
  };

  const setType = (platformId, type) => {
    setInputs(prev => ({ ...prev, [platformId]: { ...prev[platformId], type } }));
  };

  const saveDeposit = async (platformId) => {
    const inp = inputs[platformId] || {};
    const type = inp.type || "deposit";
    const amount = parseFloat(inp.amount) || 0;
    if (amount <= 0) { showToast("Введи сумму", "error"); return; }

    setSaving(platformId);
    const existing = getDeposit(platformId);
    const prevState = existing ? {
      count: existing.count,
      amount: Number(existing.amount),
      redeposit_amount: Number(existing.redeposit_amount || 0)
    } : null;

    if (existing) {
      const updates = {
        amount: Number(existing.amount) + (type === "deposit" ? amount : 0),
        redeposit_amount: Number(existing.redeposit_amount || 0) + (type === "redeposit" ? amount : 0),
        count: existing.count + (type === "deposit" ? 1 : 0),
      };
      await supabase.from("deposits").update(updates).eq("id", existing.id);
    } else {
      await supabase.from("deposits").insert({
        manager_id: manager.id,
        platform_id: platformId,
        count: type === "deposit" ? 1 : 0,
        amount: type === "deposit" ? amount : 0,
        redeposit_amount: type === "redeposit" ? amount : 0,
      });
    }

    setInputs(prev => ({ ...prev, [platformId]: { type, amount: "" } }));
    setSaving(null);
    showToast(type === "deposit" ? "Депозит добавлен!" : "Редепозит добавлен!", "ok", async () => {
      if (existing && prevState) {
        await supabase.from("deposits").update(prevState).eq("id", existing.id);
      } else {
        const dep = deposits.find(d => d.platform_id === platformId);
        if (dep) await supabase.from("deposits").delete().eq("id", dep.id);
      }
      setToast(null);
      showToast("Действие отменено");
      load();
    });
    load();
  };

  const startEdit = (platformId) => {
    const dep = getDeposit(platformId);
    if (!dep) return;
    setEditingDeposit({
      platformId,
      count: dep.count,
      amount: Number(dep.amount),
      redeposit_amount: Number(dep.redeposit_amount || 0)
    });
  };

  const saveEdit = async () => {
    if (!editingDeposit) return;
    const { platformId, count, amount, redeposit_amount } = editingDeposit;
    const cnt = parseInt(count) ?? 0;
    const amt = parseFloat(amount) ?? 0;
    const redep = parseFloat(redeposit_amount) ?? 0;
    if (cnt < 0 || amt < 0 || redep < 0) { showToast("Введи корректные значения", "error"); return; }
    const dep = getDeposit(platformId);
    if (!dep) return;
    const prevState = { count: dep.count, amount: Number(dep.amount), redeposit_amount: Number(dep.redeposit_amount || 0) };
    await supabase.from("deposits").update({ count: cnt, amount: amt, redeposit_amount: redep }).eq("id", dep.id);
    setEditingDeposit(null);
    showToast("Данные обновлены!", "ok", async () => {
      await supabase.from("deposits").update(prevState).eq("id", dep.id);
      setToast(null);
      showToast("Изменение отменено");
      load();
    });
    load();
  };

  const resetDeposit = async (platformId) => {
    const dep = getDeposit(platformId);
    if (!dep) return;
    const prevState = { count: dep.count, amount: Number(dep.amount), redeposit_amount: Number(dep.redeposit_amount || 0) };
    await supabase.from("deposits").update({ count: 0, amount: 0, redeposit_amount: 0 }).eq("id", dep.id);
    setEditingDeposit(null);
    showToast("Данные сброшены", "ok", async () => {
      await supabase.from("deposits").update(prevState).eq("id", dep.id);
      setToast(null);
      showToast("Сброс отменён");
      load();
    });
    load();
  };

  const myPlatformStats = platforms.map(p => {
    const dep = getDeposit(p.id);
    const cnt = dep?.count || 0;
    const depAmt = dep ? Number(dep.amount) : 0;
    const redepAmt = dep ? Number(dep.redeposit_amount || 0) : 0;
    const totalAmt = depAmt + redepAmt;
    const avg = cnt > 0 ? totalAmt / cnt : 0;
    const offer = offers.find(o => o.platform_id === p.id);
    return { ...p, cnt, depAmt, redepAmt, totalAmt, avg, offer };
  });

  return (
    <div style={{ minHeight: "100vh", background: "#0f1117", color: "#e2e8f0", fontFamily: "'Inter', sans-serif" }}>
      {toast && <Toast msg={toast.msg} type={toast.type} onUndo={toast.onUndo} />}

      {/* Edit modal */}
      {editingDeposit && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#1a1d27", border: "1px solid #2d3148", borderRadius: 14, padding: 28, width: 380 }}>
            <h3 style={{ color: "#fff", marginBottom: 6, fontSize: 16 }}>Редактировать данные</h3>
            <p style={{ color: "#64748b", fontSize: 13, marginBottom: 20 }}>
              {platforms.find(p => p.id === editingDeposit.platformId)?.name}
            </p>
            {[["Кол-во депозитов (Депи)", "count", "number"], ["Сумма депозитов (€)", "amount", "number"], ["Сумма редепозитов (€)", "redeposit_amount", "number"]].map(([label, key, type]) => (
              <div key={key} style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 11, color: "#64748b", marginBottom: 5, fontWeight: 600, textTransform: "uppercase" }}>{label}</label>
                <input type={type} value={editingDeposit[key] ?? 0}
                  onChange={e => setEditingDeposit(prev => ({ ...prev, [key]: e.target.value }))}
                  style={{ width: "100%", background: "#0f1117", border: "1px solid #2d3148", color: "#e2e8f0", padding: "10px 12px", borderRadius: 8, fontSize: 15, outline: "none", boxSizing: "border-box" }} />
              </div>
            ))}
            <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
              <button onClick={saveEdit} style={{ flex: 1, background: "#6366f1", color: "#fff", border: "none", padding: "11px", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 14 }}>Сохранить</button>
              <button onClick={() => resetDeposit(editingDeposit.platformId)} style={{ background: "#7f1d1d", border: "none", color: "#fca5a5", padding: "11px 16px", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 14 }}>Сбросить</button>
              <button onClick={() => setEditingDeposit(null)} style={{ flex: 1, background: "#1e2235", color: "#94a3b8", border: "1px solid #2d3148", padding: "11px", borderRadius: 8, cursor: "pointer" }}>Отмена</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ background: "#1a1d27", borderBottom: "1px solid #2d3148", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#6366f1" }} />
          <span style={{ fontWeight: 700, fontSize: 16, color: "#fff" }}>АРБИТРАЖ</span>
          <span style={{ color: "#64748b", fontSize: 14 }}>/ {manager.name}</span>
        </div>
        <button onClick={onLogout} style={{ background: "transparent", border: "1px solid #3d4268", color: "#94a3b8", padding: "6px 14px", borderRadius: 6, cursor: "pointer", fontSize: 13 }}>Выйти</button>
      </div>

      <div style={{ background: "#1a1d27", borderBottom: "1px solid #2d3148", padding: "0 24px", display: "flex" }}>
        {[["deposit", "Внести депозиты"], ["stats", "Мои результаты"], ["info", "Платформы"]].map(([key, label]) => (
          <button key={key} onClick={() => setManagerTab(key)} style={{
            background: "transparent", border: "none", color: managerTab === key ? "#6366f1" : "#64748b",
            padding: "14px 18px", cursor: "pointer", fontSize: 14, fontWeight: 600,
            borderBottom: managerTab === key ? "2px solid #6366f1" : "2px solid transparent"
          }}>{label}</button>
        ))}
      </div>

      <div style={{ padding: "28px 24px", maxWidth: 720, margin: "0 auto" }}>

        {managerTab === "deposit" && (
          <div>
            <p style={{ color: "#64748b", fontSize: 14, marginBottom: 24 }}>Добавь депозиты по каждой платформе</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {platforms.map(p => {
                const dep = getDeposit(p.id);
                const totalCount = dep?.count || 0;
                const totalDepAmount = dep ? Number(dep.amount) : 0;
                const totalRedepAmount = dep ? Number(dep.redeposit_amount || 0) : 0;
                const totalAmount = totalDepAmount + totalRedepAmount;
                const avgCheck = totalCount > 0 ? totalAmount / totalCount : 0;
                const ok = avgCheck >= p.target_avg_check;
                const inp = inputs[p.id] || {};

                return (
                  <div key={p.id} style={{ background: "#1a1d27", border: "1px solid #2d3148", borderRadius: 12, overflow: "hidden" }}>
                    <div style={{ padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #2d3148" }}>
                      <div>
                        <span style={{ fontWeight: 700, color: "#e2e8f0", fontSize: 15 }}>{p.name}</span>
                        {p.date_added && <span style={{ display: "block", fontSize: 11, color: "#475569", marginTop: 2 }}>с {p.date_added}</span>}
                      </div>
                      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        {totalCount > 0 && (
                          <span style={{ background: ok ? "#166534" : "#7f1d1d", color: ok ? "#86efac" : "#fca5a5", padding: "4px 12px", borderRadius: 6, fontWeight: 700, fontSize: 14 }}>
                            {avgCheck.toFixed(1)}€
                          </span>
                        )}
                        <span style={{ color: "#475569", fontSize: 12 }}>цель {p.target_avg_check}€</span>
                      </div>
                    </div>

                    {totalCount > 0 && (
                      <div style={{ padding: "10px 18px", background: "#151824", display: "flex", gap: 16, alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #2d3148", flexWrap: "wrap" }}>
                        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                          <span style={{ color: "#64748b", fontSize: 13 }}>Депи: <strong style={{ color: "#a5b4fc" }}>{totalCount}</strong></span>
                          <span style={{ color: "#64748b", fontSize: 13 }}>Деп: <strong style={{ color: "#cbd5e1" }}>{totalDepAmount.toFixed(0)}€</strong></span>
                          <span style={{ color: "#64748b", fontSize: 13 }}>Редеп: <strong style={{ color: "#5eead4" }}>{totalRedepAmount.toFixed(0)}€</strong></span>
                          <span style={{ color: "#64748b", fontSize: 13 }}>Итого: <strong style={{ color: "#cbd5e1" }}>{totalAmount.toFixed(0)}€</strong></span>
                        </div>
                        <button onClick={() => startEdit(p.id)} style={{ background: "transparent", border: "1px solid #3d4268", color: "#94a3b8", padding: "4px 12px", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>
                          Изменить
                        </button>
                      </div>
                    )}

                    <div style={{ padding: "14px 18px" }}>
                      <div style={{ display: "flex", background: "#0f1117", borderRadius: 8, padding: 3, marginBottom: 12 }}>
                        {[["deposit", "Депозит"], ["redeposit", "Редепозит"]].map(([t, label]) => (
                          <button key={t} onClick={() => setType(p.id, t)} style={{
                            flex: 1, background: (inp.type || "deposit") === t ? (t === "deposit" ? "#6366f1" : "#0f766e") : "transparent",
                            color: (inp.type || "deposit") === t ? "#fff" : "#64748b",
                            border: "none", padding: "8px", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 13
                          }}>{label}</button>
                        ))}
                      </div>
                      <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
                        <div style={{ flex: 1 }}>
                          <label style={{ display: "block", fontSize: 11, color: "#64748b", marginBottom: 5, fontWeight: 600, textTransform: "uppercase" }}>
                            {(inp.type || "deposit") === "deposit" ? "Сумма депозита (€)" : "Сумма редепозита (€)"}
                          </label>
                          <input type="number" min="0" value={inp.amount || ""} onChange={e => handleInput(p.id, "amount", e.target.value)}
                            placeholder="Например: 55"
                            style={{ width: "100%", background: "#0f1117", border: "1px solid #2d3148", color: "#e2e8f0", padding: "11px 14px", borderRadius: 8, fontSize: 15, outline: "none", boxSizing: "border-box" }} />
                        </div>
                        <button onClick={() => saveDeposit(p.id)} disabled={saving === p.id} style={{
                          background: saving === p.id ? "#374151" : (inp.type || "deposit") === "deposit" ? "#6366f1" : "#0f766e",
                          color: "#fff", border: "none", padding: "11px 22px", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 14, whiteSpace: "nowrap"
                        }}>{saving === p.id ? "..." : "Добавить"}</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {managerTab === "stats" && (
          <div>
            <h3 style={{ color: "#fff", marginBottom: 20, fontSize: 18 }}>Мои результаты</h3>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#1e2235" }}>
                  {["Платформа", "Депи", "Сумма", "СЧ цель", "СЧ факт"].map(h => (
                    <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", borderBottom: "1px solid #2d3148" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {myPlatformStats.map(p => {
                  const ok = p.avg >= p.target_avg_check;
                  return (
                    <tr key={p.id} style={{ borderBottom: "1px solid #1e2235" }}>
                      <td style={{ padding: "13px 16px", color: "#e2e8f0", fontWeight: 600 }}>{p.name}</td>
                      <td style={{ padding: "13px 16px", color: "#94a3b8" }}>{p.cnt || "—"}</td>
                      <td style={{ padding: "13px 16px", color: "#94a3b8" }}>{p.cnt > 0 ? p.amt.toFixed(0) + "€" : "—"}</td>
                      <td style={{ padding: "13px 16px", color: "#94a3b8" }}>{p.target_avg_check}€</td>
                      <td style={{ padding: "13px 16px" }}>
                        {p.cnt > 0 ? (
                          <span style={{ background: ok ? "#166534" : "#7f1d1d", color: ok ? "#86efac" : "#fca5a5", padding: "4px 12px", borderRadius: 6, fontWeight: 700, fontSize: 13 }}>
                            {p.avg.toFixed(1)}€
                          </span>
                        ) : <span style={{ color: "#475569" }}>—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {managerTab === "info" && (
          <div>
            <h3 style={{ color: "#fff", marginBottom: 20, fontSize: 18 }}>Информация о платформах</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {myPlatformStats.map(p => (
                <div key={p.id} style={{ background: "#1a1d27", border: "1px solid #2d3148", borderRadius: 12, padding: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                    <div>
                      <span style={{ fontWeight: 700, color: "#e2e8f0", fontSize: 15 }}>{p.name}</span>
                      {p.date_added && <span style={{ display: "block", fontSize: 12, color: "#475569", marginTop: 3 }}>Добавлена: {p.date_added}</span>}
                    </div>
                    <span style={{ background: "#1e3a5f", color: "#93c5fd", padding: "4px 12px", borderRadius: 6, fontWeight: 700, fontSize: 14 }}>цель {p.target_avg_check}€</span>
                  </div>
                  {p.offer && (
                    <div style={{ background: "#0f1117", borderRadius: 8, padding: "12px 16px", display: "flex", gap: 24 }}>
                      <span style={{ color: "#64748b", fontSize: 13 }}>Капа: <strong style={{ color: "#cbd5e1" }}>{p.offer.cap}</strong></span>
                      <span style={{ color: "#64748b", fontSize: 13 }}>Статус: <strong style={{ color: p.offer.status === "active" ? "#86efac" : "#f87171" }}>{p.offer.status === "active" ? "Работает" : "Стоп"}</strong></span>
                      <span style={{ color: "#64748b", fontSize: 13 }}>Дата: <strong style={{ color: "#cbd5e1" }}>{p.offer.date}</strong></span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── LOGIN PAGE ───────────────────────────────────────────────────────────────
function LoginPage({ onLogin }) {
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState("manager");

  const login = async () => {
    setError(""); setLoading(true);
    if (mode === "admin") {
      if (token === ADMIN_PASSWORD) { onLogin({ role: "admin" }); }
      else { setError("Неверный пароль"); }
      setLoading(false); return;
    }
    const { data, error: err } = await supabase.from("managers").select("*").eq("token", token.toUpperCase()).eq("is_active", true).single();
    setLoading(false);
    if (err || !data) { setError("Токен не найден или менеджер отключён"); return; }
    onLogin({ role: "manager", manager: data });
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0f1117", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ width: "100%", maxWidth: 400, padding: 24 }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ display: "inline-flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#6366f1" }} />
            <span style={{ fontWeight: 800, fontSize: 22, color: "#fff", letterSpacing: "0.08em" }}>АРБИТРАЖ</span>
          </div>
          <p style={{ color: "#64748b", fontSize: 14 }}>Трекер депозитов</p>
        </div>
        <div style={{ background: "#1a1d27", border: "1px solid #2d3148", borderRadius: 14, padding: 28 }}>
          <div style={{ display: "flex", background: "#0f1117", borderRadius: 8, padding: 3, marginBottom: 24 }}>
            {[["manager", "Менеджер"], ["admin", "Админ"]].map(([key, label]) => (
              <button key={key} onClick={() => { setMode(key); setToken(""); setError(""); }} style={{
                flex: 1, background: mode === key ? "#6366f1" : "transparent", color: mode === key ? "#fff" : "#64748b",
                border: "none", padding: "8px", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 13
              }}>{label}</button>
            ))}
          </div>
          <label style={{ display: "block", fontSize: 12, color: "#64748b", marginBottom: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            {mode === "admin" ? "Пароль администратора" : "Токен доступа"}
          </label>
          <input value={token} onChange={e => setToken(e.target.value)} onKeyDown={e => e.key === "Enter" && login()}
            placeholder={mode === "admin" ? "Пароль" : "Введи токен"} type={mode === "admin" ? "password" : "text"}
            style={{ width: "100%", background: "#0f1117", border: `1px solid ${error ? "#ef4444" : "#2d3148"}`, color: "#e2e8f0", padding: "12px 14px", borderRadius: 8, fontSize: 15, outline: "none", marginBottom: 8, boxSizing: "border-box", textTransform: mode === "manager" ? "uppercase" : "none", letterSpacing: mode === "manager" ? "0.12em" : "normal" }} />
          {error && <p style={{ color: "#f87171", fontSize: 13, marginBottom: 12 }}>{error}</p>}
          <button onClick={login} disabled={loading || !token} style={{ width: "100%", background: loading || !token ? "#3730a3" : "#6366f1", color: "#fff", border: "none", padding: "12px", borderRadius: 8, cursor: loading || !token ? "not-allowed" : "pointer", fontWeight: 700, fontSize: 15, marginTop: 8 }}>
            {loading ? "Проверяем..." : "Войти"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [session, setSession] = useState(null);
  useEffect(() => {
    const saved = localStorage.getItem("arbi_session");
    if (saved) setSession(JSON.parse(saved));
  }, []);
  const handleLogin = (s) => { localStorage.setItem("arbi_session", JSON.stringify(s)); setSession(s); };
  const handleLogout = () => { localStorage.removeItem("arbi_session"); setSession(null); };
  if (!session) return <LoginPage onLogin={handleLogin} />;
  if (session.role === "admin") return <AdminPage onLogout={handleLogout} />;
  return <ManagerPage manager={session.manager} onLogout={handleLogout} />;
}
