import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://pemhpcgkmuqjucaeqhdy.supabase.co";
const SUPABASE_KEY = "sb_publishable_g7EPoWwXGTZjQBpkW6unTg_FAxKMGfh";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const ADMIN_PASSWORD = "admin2026";

function Toast({ msg, type }) {
  if (!msg) return null;
  return (
    <div style={{
      position: "fixed", bottom: 24, right: 24, zIndex: 9999,
      background: type === "error" ? "#ef4444" : "#22c55e",
      color: "#fff", padding: "12px 20px", borderRadius: 8,
      fontWeight: 600, fontSize: 14, boxShadow: "0 4px 20px rgba(0,0,0,0.3)"
    }}>{msg}</div>
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

  const showToast = (msg, type = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const load = async () => {
    const [{ data: m }, { data: p }, { data: d }, { data: o }] = await Promise.all([
      supabase.from("managers").select("*").order("created_at"),
      supabase.from("platforms").select("*").order("name"),
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

  // Stats per platform
  const platformStats = platforms.map(p => {
    const deps = deposits.filter(d => d.platform_id === p.id);
    const totalCount = deps.reduce((s, d) => s + d.count, 0);
    const totalAmount = deps.reduce((s, d) => s + Number(d.amount), 0);
    const avgCheck = totalCount > 0 ? totalAmount / totalCount : 0;
    const offer = offers.find(o => o.platform_id === p.id);
    return { ...p, totalCount, totalAmount, avgCheck, offer };
  });

  // Stats per manager
  const managerStats = managers.map(m => {
    const deps = deposits.filter(d => d.manager_id === m.id);
    const totalCount = deps.reduce((s, d) => s + d.count, 0);
    const totalAmount = deps.reduce((s, d) => s + Number(d.amount), 0);
    return { ...m, totalCount, totalAmount };
  });

  return (
    <div style={{ minHeight: "100vh", background: "#0f1117", color: "#e2e8f0", fontFamily: "'Inter', sans-serif" }}>
      {toast && <Toast msg={toast.msg} type={toast.type} />}

      {/* Header */}
      <div style={{ background: "#1a1d27", borderBottom: "1px solid #2d3148", padding: "16px 32px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#6366f1" }} />
          <span style={{ fontWeight: 700, fontSize: 16, letterSpacing: "0.05em", color: "#fff" }}>АРБИТРАЖ</span>
          <span style={{ background: "#6366f1", color: "#fff", fontSize: 10, padding: "2px 8px", borderRadius: 4, fontWeight: 700 }}>ADMIN</span>
        </div>
        <button onClick={onLogout} style={{ background: "transparent", border: "1px solid #3d4268", color: "#94a3b8", padding: "6px 14px", borderRadius: 6, cursor: "pointer", fontSize: 13 }}>Выйти</button>
      </div>

      {/* Tabs */}
      <div style={{ background: "#1a1d27", borderBottom: "1px solid #2d3148", padding: "0 32px", display: "flex", gap: 0 }}>
        {[["overview", "Сводка"], ["managers", "Менеджеры"], ["offers", "Офферы"]].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{
            background: "transparent", border: "none", color: tab === key ? "#6366f1" : "#64748b",
            padding: "14px 20px", cursor: "pointer", fontSize: 14, fontWeight: 600,
            borderBottom: tab === key ? "2px solid #6366f1" : "2px solid transparent"
          }}>{label}</button>
        ))}
      </div>

      <div style={{ padding: "32px", maxWidth: 1100, margin: "0 auto" }}>

        {/* OVERVIEW TAB */}
        {tab === "overview" && (
          <div>
            <h2 style={{ color: "#fff", marginBottom: 24, fontSize: 20 }}>Общий СЧ по платформам</h2>
            <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 40 }}>
              <thead>
                <tr style={{ background: "#1e2235" }}>
                  {["Платформа", "Кол-во депов", "Сумма", "СЧ ФАКТ", "СЧ ЦЕЛЬ", "КАПА", "Выполнено"].map(h => (
                    <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", borderBottom: "1px solid #2d3148" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {platformStats.map(p => {
                  const ok = p.avgCheck >= p.target_avg_check;
                  return (
                    <tr key={p.id} style={{ borderBottom: "1px solid #1e2235" }}>
                      <td style={{ padding: "14px 16px", fontWeight: 600, color: "#e2e8f0" }}>{p.name}</td>
                      <td style={{ padding: "14px 16px", color: "#94a3b8" }}>{p.totalCount}</td>
                      <td style={{ padding: "14px 16px", color: "#94a3b8" }}>{p.totalAmount.toFixed(0)}€</td>
                      <td style={{ padding: "14px 16px" }}>
                        <span style={{
                          background: p.totalCount === 0 ? "#1e2235" : ok ? "#166534" : "#7f1d1d",
                          color: p.totalCount === 0 ? "#64748b" : ok ? "#86efac" : "#fca5a5",
                          padding: "4px 10px", borderRadius: 6, fontWeight: 700, fontSize: 13
                        }}>{p.totalCount === 0 ? "—" : p.avgCheck.toFixed(1) + "€"}</span>
                      </td>
                      <td style={{ padding: "14px 16px", color: "#94a3b8" }}>{p.target_avg_check}€</td>
                      <td style={{ padding: "14px 16px", color: "#94a3b8" }}>{p.offer?.cap ?? "—"}</td>
                      <td style={{ padding: "14px 16px" }}>
                        {p.offer ? (
                          <span style={{ color: "#94a3b8", fontSize: 13 }}>
                            {p.totalCount} / {p.offer.cap}
                            {" "}
                            <span style={{ color: p.totalCount >= p.offer.cap ? "#86efac" : "#f59e0b" }}>
                              ({Math.round((p.totalCount / p.offer.cap) * 100)}%)
                            </span>
                          </span>
                        ) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <h2 style={{ color: "#fff", marginBottom: 24, fontSize: 20 }}>По менеджерам</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16 }}>
              {managerStats.map(m => (
                <div key={m.id} style={{ background: "#1a1d27", border: "1px solid #2d3148", borderRadius: 10, padding: 20 }}>
                  <div style={{ color: "#fff", fontWeight: 700, marginBottom: 8 }}>{m.name}</div>
                  <div style={{ color: "#64748b", fontSize: 12, marginBottom: 4 }}>Депозиты: <span style={{ color: "#94a3b8" }}>{m.totalCount}</span></div>
                  <div style={{ color: "#64748b", fontSize: 12 }}>Сумма: <span style={{ color: "#94a3b8" }}>{m.totalAmount.toFixed(0)}€</span></div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* MANAGERS TAB */}
        {tab === "managers" && (
          <div>
            <h2 style={{ color: "#fff", marginBottom: 24, fontSize: 20 }}>Менеджеры</h2>

            {/* Create */}
            <div style={{ background: "#1a1d27", border: "1px solid #2d3148", borderRadius: 10, padding: 24, marginBottom: 32, display: "flex", gap: 12, alignItems: "flex-end" }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: "block", fontSize: 12, color: "#64748b", marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Имя менеджера</label>
                <input
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && createManager()}
                  placeholder="Например: Коля Н"
                  style={{ width: "100%", background: "#0f1117", border: "1px solid #2d3148", color: "#e2e8f0", padding: "10px 14px", borderRadius: 8, fontSize: 14, outline: "none", boxSizing: "border-box" }}
                />
              </div>
              <button onClick={createManager} style={{
                background: "#6366f1", color: "#fff", border: "none", padding: "10px 24px",
                borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 14, whiteSpace: "nowrap"
              }}>+ Создать</button>
            </div>

            {/* List */}
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#1e2235" }}>
                  {["Имя", "Токен", "Статус", "Депозитов", "Действия"].map(h => (
                    <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", borderBottom: "1px solid #2d3148" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {managers.map(m => {
                  const deps = deposits.filter(d => d.manager_id === m.id);
                  const count = deps.reduce((s, d) => s + d.count, 0);
                  return (
                    <tr key={m.id} style={{ borderBottom: "1px solid #1e2235" }}>
                      <td style={{ padding: "14px 16px", fontWeight: 600, color: "#e2e8f0" }}>{m.name}</td>
                      <td style={{ padding: "14px 16px" }}>
                        <code style={{ background: "#0f1117", border: "1px solid #2d3148", padding: "4px 10px", borderRadius: 6, fontSize: 13, color: "#a5b4fc", letterSpacing: "0.1em" }}>{m.token}</code>
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <span style={{ background: m.is_active ? "#14532d" : "#1e2235", color: m.is_active ? "#86efac" : "#64748b", padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                          {m.is_active ? "Активен" : "Отключён"}
                        </span>
                      </td>
                      <td style={{ padding: "14px 16px", color: "#94a3b8" }}>{count}</td>
                      <td style={{ padding: "14px 16px", display: "flex", gap: 8 }}>
                        <button onClick={() => toggleManager(m)} style={{ background: "#1e2235", border: "1px solid #2d3148", color: "#94a3b8", padding: "6px 12px", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>
                          {m.is_active ? "Отключить" : "Включить"}
                        </button>
                        <button onClick={() => deleteManager(m.id)} style={{ background: "#7f1d1d", border: "none", color: "#fca5a5", padding: "6px 12px", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>
                          Удалить
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* OFFERS TAB */}
        {tab === "offers" && (
          <div>
            <h2 style={{ color: "#fff", marginBottom: 24, fontSize: 20 }}>Офферы</h2>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#1e2235" }}>
                  {["Дата", "Платформа", "Капа", "Выполнено", "Статус"].map(h => (
                    <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", borderBottom: "1px solid #2d3148" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {offers.map(o => {
                  const deps = deposits.filter(d => d.platform_id === o.platform_id);
                  const done = deps.reduce((s, d) => s + d.count, 0);
                  const pct = o.cap > 0 ? Math.min(100, Math.round((done / o.cap) * 100)) : 0;
                  return (
                    <tr key={o.id} style={{ borderBottom: "1px solid #1e2235" }}>
                      <td style={{ padding: "14px 16px", color: "#94a3b8" }}>{o.date}</td>
                      <td style={{ padding: "14px 16px", color: "#e2e8f0", fontWeight: 600 }}>{o.platforms?.name}</td>
                      <td style={{ padding: "14px 16px", color: "#94a3b8" }}>{o.cap}</td>
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ flex: 1, background: "#0f1117", borderRadius: 4, height: 6, overflow: "hidden" }}>
                            <div style={{ width: `${pct}%`, height: "100%", background: pct >= 100 ? "#22c55e" : "#6366f1", borderRadius: 4 }} />
                          </div>
                          <span style={{ color: "#94a3b8", fontSize: 13, minWidth: 60 }}>{done} / {o.cap}</span>
                        </div>
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <span style={{ background: o.status === "active" ? "#1e3a5f" : "#1e2235", color: o.status === "active" ? "#93c5fd" : "#64748b", padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                          {o.status === "active" ? "Работает" : "Стоп"}
                        </span>
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
  const [inputs, setInputs] = useState({});
  const [saving, setSaving] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const load = async () => {
    const [{ data: p }, { data: d }] = await Promise.all([
      supabase.from("platforms").select("*").order("name"),
      supabase.from("deposits").select("*").eq("manager_id", manager.id),
    ]);
    setPlatforms(p || []);
    setDeposits(d || []);
  };

  useEffect(() => { load(); }, []);

  const getDeposit = (platformId) => deposits.find(d => d.platform_id === platformId);

  const handleInput = (platformId, field, value) => {
    setInputs(prev => ({ ...prev, [platformId]: { ...prev[platformId], [field]: value } }));
  };

  const saveDeposit = async (platformId) => {
    const inp = inputs[platformId] || {};
    const count = parseInt(inp.count) || 0;
    const amount = parseFloat(inp.amount) || 0;
    if (count <= 0 || amount <= 0) { showToast("Введи кол-во и сумму", "error"); return; }

    setSaving(platformId);
    const existing = getDeposit(platformId);

    if (existing) {
      await supabase.from("deposits").update({
        count: existing.count + count,
        amount: Number(existing.amount) + amount,
      }).eq("id", existing.id);
    } else {
      await supabase.from("deposits").insert({ manager_id: manager.id, platform_id: platformId, count, amount });
    }

    setInputs(prev => ({ ...prev, [platformId]: { count: "", amount: "" } }));
    setSaving(null);
    showToast("Сохранено!");
    load();
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0f1117", color: "#e2e8f0", fontFamily: "'Inter', sans-serif" }}>
      {toast && <Toast msg={toast.msg} type={toast.type} />}

      <div style={{ background: "#1a1d27", borderBottom: "1px solid #2d3148", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#6366f1" }} />
          <span style={{ fontWeight: 700, fontSize: 16, color: "#fff" }}>АРБИТРАЖ</span>
          <span style={{ color: "#64748b", fontSize: 14 }}>/ {manager.name}</span>
        </div>
        <button onClick={onLogout} style={{ background: "transparent", border: "1px solid #3d4268", color: "#94a3b8", padding: "6px 14px", borderRadius: 6, cursor: "pointer", fontSize: 13 }}>Выйти</button>
      </div>

      <div style={{ padding: "32px 24px", maxWidth: 700, margin: "0 auto" }}>
        <p style={{ color: "#64748b", fontSize: 14, marginBottom: 32 }}>Внеси депозиты за сегодня по каждой платформе</p>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {platforms.map(p => {
            const existing = getDeposit(p.id);
            const inp = inputs[p.id] || {};
            const totalCount = existing?.count || 0;
            const totalAmount = existing ? Number(existing.amount) : 0;
            const avgCheck = totalCount > 0 ? totalAmount / totalCount : 0;
            const ok = avgCheck >= p.target_avg_check;

            return (
              <div key={p.id} style={{ background: "#1a1d27", border: "1px solid #2d3148", borderRadius: 12, padding: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <span style={{ fontWeight: 700, color: "#e2e8f0", fontSize: 15 }}>{p.name}</span>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    {totalCount > 0 && (
                      <span style={{
                        background: ok ? "#166534" : "#7f1d1d",
                        color: ok ? "#86efac" : "#fca5a5",
                        padding: "3px 10px", borderRadius: 6, fontWeight: 700, fontSize: 13
                      }}>{avgCheck.toFixed(1)}€</span>
                    )}
                    <span style={{ color: "#64748b", fontSize: 12 }}>цель: {p.target_avg_check}€</span>
                  </div>
                </div>

                {totalCount > 0 && (
                  <div style={{ background: "#0f1117", borderRadius: 8, padding: "10px 14px", marginBottom: 14, display: "flex", gap: 24 }}>
                    <span style={{ color: "#64748b", fontSize: 13 }}>Всего депов: <span style={{ color: "#94a3b8", fontWeight: 600 }}>{totalCount}</span></span>
                    <span style={{ color: "#64748b", fontSize: 13 }}>Сумма: <span style={{ color: "#94a3b8", fontWeight: 600 }}>{totalAmount.toFixed(0)}€</span></span>
                  </div>
                )}

                <div style={{ display: "flex", gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: "block", fontSize: 11, color: "#64748b", marginBottom: 5, fontWeight: 600, textTransform: "uppercase" }}>Кол-во депов</label>
                    <input
                      type="number" min="1"
                      value={inp.count || ""}
                      onChange={e => handleInput(p.id, "count", e.target.value)}
                      placeholder="0"
                      style={{ width: "100%", background: "#0f1117", border: "1px solid #2d3148", color: "#e2e8f0", padding: "10px 12px", borderRadius: 8, fontSize: 15, outline: "none", boxSizing: "border-box" }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: "block", fontSize: 11, color: "#64748b", marginBottom: 5, fontWeight: 600, textTransform: "uppercase" }}>Сумма (€)</label>
                    <input
                      type="number" min="1"
                      value={inp.amount || ""}
                      onChange={e => handleInput(p.id, "amount", e.target.value)}
                      placeholder="0"
                      style={{ width: "100%", background: "#0f1117", border: "1px solid #2d3148", color: "#e2e8f0", padding: "10px 12px", borderRadius: 8, fontSize: 15, outline: "none", boxSizing: "border-box" }}
                    />
                  </div>
                  <div style={{ display: "flex", alignItems: "flex-end" }}>
                    <button
                      onClick={() => saveDeposit(p.id)}
                      disabled={saving === p.id}
                      style={{
                        background: saving === p.id ? "#3730a3" : "#6366f1",
                        color: "#fff", border: "none", padding: "10px 18px",
                        borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 14,
                        whiteSpace: "nowrap"
                      }}
                    >{saving === p.id ? "..." : "Добавить"}</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
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
          {/* Mode toggle */}
          <div style={{ display: "flex", background: "#0f1117", borderRadius: 8, padding: 3, marginBottom: 24 }}>
            {[["manager", "Менеджер"], ["admin", "Админ"]].map(([key, label]) => (
              <button key={key} onClick={() => { setMode(key); setToken(""); setError(""); }} style={{
                flex: 1, background: mode === key ? "#6366f1" : "transparent",
                color: mode === key ? "#fff" : "#64748b",
                border: "none", padding: "8px", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 13
              }}>{label}</button>
            ))}
          </div>

          <label style={{ display: "block", fontSize: 12, color: "#64748b", marginBottom: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            {mode === "admin" ? "Пароль администратора" : "Токен доступа"}
          </label>
          <input
            value={token}
            onChange={e => setToken(e.target.value)}
            onKeyDown={e => e.key === "Enter" && login()}
            placeholder={mode === "admin" ? "Пароль" : "Введи токен"}
            type={mode === "admin" ? "password" : "text"}
            style={{
              width: "100%", background: "#0f1117", border: `1px solid ${error ? "#ef4444" : "#2d3148"}`,
              color: "#e2e8f0", padding: "12px 14px", borderRadius: 8, fontSize: 15,
              outline: "none", marginBottom: 8, boxSizing: "border-box",
              textTransform: mode === "manager" ? "uppercase" : "none", letterSpacing: mode === "manager" ? "0.12em" : "normal"
            }}
          />
          {error && <p style={{ color: "#f87171", fontSize: 13, marginBottom: 12 }}>{error}</p>}

          <button onClick={login} disabled={loading || !token} style={{
            width: "100%", background: loading || !token ? "#3730a3" : "#6366f1",
            color: "#fff", border: "none", padding: "12px", borderRadius: 8,
            cursor: loading || !token ? "not-allowed" : "pointer", fontWeight: 700, fontSize: 15, marginTop: 8
          }}>{loading ? "Проверяем..." : "Войти"}</button>
        </div>
      </div>
    </div>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [session, setSession] = useState(null);

  useEffect(() => {
    const saved = sessionStorage.getItem("arbi_session");
    if (saved) setSession(JSON.parse(saved));
  }, []);

  const handleLogin = (s) => {
    sessionStorage.setItem("arbi_session", JSON.stringify(s));
    setSession(s);
  };

  const handleLogout = () => {
    sessionStorage.removeItem("arbi_session");
    setSession(null);
  };

  if (!session) return <LoginPage onLogin={handleLogin} />;
  if (session.role === "admin") return <AdminPage onLogout={handleLogout} />;
  return <ManagerPage manager={session.manager} onLogout={handleLogout} />;
}
