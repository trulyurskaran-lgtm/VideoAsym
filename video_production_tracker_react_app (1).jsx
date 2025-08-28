"use client";
// FIX: Removed dynamic import of "./VideoProductionTrackerApp" (file not found)
// This page now inlines the full app so you can run it without any extra files.
// If you later extract the component into its own file, update the import path accordingly.

import React, { useEffect, useMemo, useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts";

// -----------------------------
// Types
// -----------------------------
type TaskStatus = "Not Started" | "In Progress" | "Blocked" | "On Hold" | "Done";
type Stage = "Pre-Production" | "Production" | "Post-Production" | "Delivery";
type Priority = "Low" | "Medium" | "High" | "Critical";

type Task = {
  id: string;
  projectId: string;
  projectName: string;
  stage: Stage;
  name: string;
  dependsOn?: string; // Task ID
  assignee: string;
  priority: Priority;
  status: TaskStatus;
  startDate?: string; // yyyy-mm-dd
  dueDate?: string;   // yyyy-mm-dd
  actualEnd?: string; // yyyy-mm-dd
  manualPct?: number; // 0-100
  notes?: string;
};

type Project = {
  id: string;
  name: string;
  client: string;
  producer: string;
  startDate?: string;
  endDate?: string;
};

// -----------------------------
// Constants / Lookups
// -----------------------------
const TEAM = [
  "Karan",
  "Rumi",
  "Somya",
  "Tushar",
  "Ravi",
  "Avinash",
  "Editor 1",
  "Editor 2",
  "Graphics",
  "Audio",
  "Client",
];
const STAGES: Stage[] = ["Pre-Production", "Production", "Post-Production", "Delivery"];
const STATUSES: TaskStatus[] = ["Not Started", "In Progress", "Blocked", "On Hold", "Done"];
const PRIORITIES: Priority[] = ["Low", "Medium", "High", "Critical"];
const COLORS = ["#4F46E5", "#22C55E", "#F59E0B", "#EF4444", "#0EA5E9", "#14B8A6", "#A855F7"];
const LS_KEY = "video-prod-tracker-v1";

// -----------------------------
// Helper logic
// -----------------------------
export function autoPctFromStatus(status: TaskStatus): number {
  switch (status) {
    case "Done":
      return 100;
    case "In Progress":
      return 50;
    case "Blocked":
    case "On Hold":
      return 25;
    default:
      return 0;
  }
}

export function dependencyReady(
  depId: string | undefined,
  tasksIndex: Record<string, Task>
): "Ready" | "Wait" {
  if (!depId) return "Ready";
  const dep = tasksIndex[depId];
  return dep && dep.status === "Done" ? "Ready" : "Wait";
}

function saveToStorage(projects: Project[], tasks: Task[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(LS_KEY, JSON.stringify({ projects, tasks }));
}

function loadFromStorage(): { projects: Project[]; tasks: Task[] } | null {
  try {
    if (typeof window === "undefined") return null;
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// -----------------------------
// Seed data (for first run)
// -----------------------------
const seedProjects: Project[] = [
  { id: "P-001", name: "Tata MF — Sahi Investment Plan", client: "Tata Mutual Fund", producer: "Karan" },
  { id: "P-002", name: "Dlecta — Recipe Shorts", client: "Dlecta", producer: "Somya" },
  { id: "P-003", name: "Equal Two — Skincare Launch", client: "Equal Two", producer: "Ravi" },
];

const seedTasks: Task[] = [
  { id: "T-001", projectId: "P-001", projectName: "Tata MF — Sahi Investment Plan", stage: "Pre-Production", name: "Script Finalization", assignee: "Ravi", priority: "High", status: "Done", startDate: "2025-08-15", dueDate: "2025-08-16", actualEnd: "2025-08-16", manualPct: 100, notes: "Approved by client" },
  { id: "T-002", projectId: "P-001", projectName: "Tata MF — Sahi Investment Plan", stage: "Pre-Production", name: "Casting", dependsOn: "T-001", assignee: "Somya", priority: "Medium", status: "In Progress", startDate: "2025-08-18", dueDate: "2025-08-26", notes: "2 actors locked" },
  { id: "T-003", projectId: "P-001", projectName: "Tata MF — Sahi Investment Plan", stage: "Production", name: "Shoot Day 1", dependsOn: "T-002", assignee: "Tushar", priority: "High", status: "Not Started", startDate: "2025-08-29", dueDate: "2025-08-29" },
  { id: "T-004", projectId: "P-001", projectName: "Tata MF — Sahi Investment Plan", stage: "Post-Production", name: "Rough Cut", dependsOn: "T-003", assignee: "Editor 1", priority: "High", status: "Not Started", startDate: "2025-08-30", dueDate: "2025-09-01" },
  { id: "T-005", projectId: "P-002", projectName: "Dlecta — Recipe Shorts", stage: "Production", name: "Shoot Day 1", assignee: "Tushar", priority: "High", status: "Blocked", startDate: "2025-08-27", dueDate: "2025-08-29", notes: "Rain delay" },
  { id: "T-006", projectId: "P-003", projectName: "Equal Two — Skincare Launch", stage: "Pre-Production", name: "Storyboard", assignee: "Avinash", priority: "Medium", status: "On Hold", startDate: "2025-08-30", dueDate: "2025-09-03", notes: "Awaiting brand assets" },
];

// -----------------------------
// Dev-time sanity tests (run once in dev only)
// -----------------------------
function runDevTests() {
  if (typeof window === "undefined") return;
  // Basic unit tests for helpers
  console.assert(autoPctFromStatus("Not Started") === 0, "Not Started → 0%");
  console.assert(autoPctFromStatus("In Progress") === 50, "In Progress → 50%");
  console.assert(autoPctFromStatus("Done") === 100, "Done → 100%");
  const t: Record<string, Task> = { A: { ...seedTasks[0], id: "A", status: "Done" }, B: { ...seedTasks[0], id: "B", status: "Blocked" } };
  console.assert(dependencyReady(undefined, t) === "Ready", "No dependency → Ready");
  console.assert(dependencyReady("A", t) === "Ready", "Dep Done → Ready");
  console.assert(dependencyReady("B", t) === "Wait", "Dep not Done → Wait");
}

// -----------------------------
// Page (inlined app)
// -----------------------------
export default function Page() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterProject, setFilterProject] = useState<string>("all");

  useEffect(() => {
    const data = loadFromStorage();
    if (data) {
      setProjects(data.projects);
      setTasks(data.tasks);
    } else {
      setProjects(seedProjects);
      setTasks(seedTasks);
    }
    setLoading(false);
    runDevTests();
  }, []);

  useEffect(() => {
    if (!loading) saveToStorage(projects, tasks);
  }, [projects, tasks, loading]);

  const tasksIndex = useMemo(() => Object.fromEntries(tasks.map((t) => [t.id, t])), [tasks]);
  const tasksFiltered = useMemo(
    () => (filterProject === "all" ? tasks : tasks.filter((t) => t.projectId === filterProject)),
    [tasks, filterProject]
  );

  const statusCounts = useMemo(() => {
    const acc: Record<TaskStatus, number> = {
      "Not Started": 0,
      "In Progress": 0,
      Blocked: 0,
      "On Hold": 0,
      Done: 0,
    };
    tasksFiltered.forEach((t) => acc[t.status]++);
    return Object.entries(acc).map(([name, value]) => ({ name, value }));
  }, [tasksFiltered]);

  const stageCounts = useMemo(() => {
    const acc: Record<Stage, number> = {
      "Pre-Production": 0,
      Production: 0,
      "Post-Production": 0,
      Delivery: 0,
    };
    tasksFiltered.forEach((t) => acc[t.stage]++);
    return Object.entries(acc).map(([name, value]) => ({ name, value }));
  }, [tasksFiltered]);

  const assigneeCounts = useMemo(() => {
    const acc: Record<string, number> = {};
    tasksFiltered.forEach((t) => {
      acc[t.assignee] = (acc[t.assignee] || 0) + 1;
    });
    return Object.entries(acc).map(([name, value]) => ({ name, value }));
  }, [tasksFiltered]);

  const onTimeRate = useMemo(() => {
    const done = tasksFiltered.filter((t) => t.status === "Done");
    if (done.length === 0) return 0;
    const ontime = done.filter((t) => t.actualEnd && t.dueDate && t.actualEnd <= t.dueDate).length;
    return Math.round((ontime / done.length) * 100);
  }, [tasksFiltered]);

  const overdueCount = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return tasksFiltered.filter((t) => t.status !== "Done" && t.dueDate && t.dueDate < today).length;
  }, [tasksFiltered]);

  const overallPctByProject = useMemo(() => {
    const acc: Record<string, number> = {};
    projects.forEach((p) => {
      const list = tasks.filter((t) => t.projectId === p.id);
      const avg = list.length
        ? Math.round(
            list.reduce((s, t) => s + (t.manualPct ?? autoPctFromStatus(t.status)), 0) / list.length
          )
        : 0;
      acc[p.id] = avg;
    });
    return acc;
  }, [projects, tasks]);

  function addTask() {
    const nid = `T-${(tasks.length + 1).toString().padStart(3, "0")}`;
    const p = projects[0];
    const t: Task = {
      id: nid,
      projectId: p?.id ?? "P-001",
      projectName: p?.name ?? "Project",
      stage: "Pre-Production",
      name: "New Task",
      assignee: TEAM[0],
      priority: "Medium",
      status: "Not Started",
    };
    setTasks([t, ...tasks]);
  }

  function removeTask(id: string) {
    setTasks(tasks.filter((t) => t.id !== id));
  }

  function updateTask<K extends keyof Task>(id: string, key: K, value: Task[K]) {
    setTasks(tasks.map((t) => (t.id === id ? { ...t, [key]: value } : t)));
  }

  function addProject() {
    const nid = `P-${(projects.length + 1).toString().padStart(3, "0")}`;
    setProjects([{ id: nid, name: "New Project", client: "Client", producer: TEAM[0] }, ...projects]);
  }

  function exportJSON() {
    const blob = new Blob([JSON.stringify({ projects, tasks }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "tracker-data.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading)
    return (
      <div className="w-full h-[80vh] flex items-center justify-center">Loading…</div>
    );

  return (
    <main className="min-h-screen bg-gray-50 p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header & Actions */}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Video Production Delivery Tracker — App</h1>
          <p className="text-sm text-gray-600">Dependencies • Ownership • % Complete • Visual Dashboard • Local Save</p>
        </div>
        <div className="flex gap-2">
          <button onClick={addProject} className="rounded-2xl border px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200">+ Project</button>
          <button onClick={addTask} className="rounded-2xl border px-3 py-2 text-sm bg-black text-white hover:bg-gray-800">+ Task</button>
          <button onClick={exportJSON} className="rounded-2xl border px-3 py-2 text-sm bg-white hover:bg-gray-50">Export JSON</button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid md:grid-cols-5 gap-4">
        <div className="rounded-2xl border bg-white p-4"><div className="text-xs text-gray-500">Total Projects</div><div className="text-3xl font-semibold">{projects.length}</div></div>
        <div className="rounded-2xl border bg-white p-4"><div className="text-xs text-gray-500">Total Tasks</div><div className="text-3xl font-semibold">{tasksFiltered.length}</div></div>
        <div className="rounded-2xl border bg-white p-4"><div className="text-xs text-gray-500">Completed</div><div className="text-3xl font-semibold">{tasksFiltered.filter(t=>t.status==="Done").length}</div></div>
        <div className="rounded-2xl border bg-white p-4"><div className="text-xs text-gray-500">Overdue</div><div className="text-3xl font-semibold text-red-600">{overdueCount}</div></div>
        <div className="rounded-2xl border bg-white p-4"><div className="text-xs text-gray-500">On-time Delivery</div><div className="text-3xl font-semibold">{onTimeRate}%</div></div>
      </div>

      {/* Filter */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="text-sm">Filter by Project:</div>
        <select
          className="rounded-xl border px-3 py-2 text-sm"
          value={filterProject}
          onChange={(e) => setFilterProject(e.target.value)}
        >
          <option value="all">All Projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.id} — {p.name}
            </option>
          ))}
        </select>
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="rounded-2xl border bg-white p-4">
          <div className="text-base font-semibold mb-2">Tasks by Status</div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie dataKey="value" data={statusCounts} innerRadius={60} outerRadius={100} paddingAngle={2}>
                  {statusCounts.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-2xl border bg-white p-4">
          <div className="text-base font-semibold mb-2">Tasks by Stage</div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie dataKey="value" data={stageCounts} outerRadius={110} paddingAngle={2}>
                  {stageCounts.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-2xl border bg-white p-4 lg:col-span-2">
          <div className="text-base font-semibold mb-2">Tasks per Assignee</div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={assigneeCounts}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Tabs (Tasks / Projects / Help) – simple implementation */}
      <div className="w-full">
        <div className="mb-3 flex gap-2">
          <a href="#tab-tasks" className="rounded-xl border px-3 py-1 text-sm">Tasks</a>
          <a href="#tab-projects" className="rounded-xl border px-3 py-1 text-sm">Projects</a>
          <a href="#tab-help" className="rounded-xl border px-3 py-1 text-sm">Help</a>
        </div>

        {/* Tasks */}
        <section id="tab-tasks" className="rounded-2xl border bg-white p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="text-base font-semibold">Tasks</div>
            <button onClick={addTask} className="rounded-2xl border px-3 py-2 text-sm bg-black text-white hover:bg-gray-800">Add Task</button>
          </div>
          <div className="grid grid-cols-12 gap-2 text-xs font-medium text-gray-500 mb-2">
            <div>ID</div>
            <div>Project</div>
            <div className="col-span-2">Task</div>
            <div>Stage</div>
            <div>Depends</div>
            <div>Assignee</div>
            <div>Priority</div>
            <div>Status</div>
            <div>Start</div>
            <div>Due</div>
            <div>Done</div>
            <div>%</div>
          </div>
          {tasksFiltered.map((t) => {
            const ready = dependencyReady(t.dependsOn, tasksIndex);
            const finalPct = Math.round(t.manualPct ?? autoPctFromStatus(t.status));
            const overdue = t.status !== "Done" && t.dueDate && t.dueDate < new Date().toISOString().slice(0, 10);
            return (
              <div
                key={t.id}
                className={`grid grid-cols-12 gap-2 items-center p-2 rounded-xl border mb-2 ${
                  overdue ? "border-red-300 bg-red-50" : ""
                }`}
              >
                <div className="font-mono">{t.id}</div>
                <div className="min-w-[180px]">
                  <select
                    className="w-full rounded-xl border px-2 py-1 text-sm"
                    value={t.projectId}
                    onChange={(e) => updateTask(t.id, "projectId", e.target.value)}
                  >
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.id} — {p.name}
                      </option>
                    ))}
                  </select>
                  <div className="text-[10px] text-gray-500 truncate">
                    {projects.find((p) => p.id === t.projectId)?.name ?? t.projectName}
                  </div>
                </div>
                <div className="col-span-2">
                  <input
                    className="w-full rounded-xl border px-2 py-1 text-sm"
                    value={t.name}
                    onChange={(e) => updateTask(t.id, "name", e.target.value)}
                  />
                </div>
                <div>
                  <select
                    className="w-full rounded-xl border px-2 py-1 text-sm"
                    value={t.stage}
                    onChange={(e) => updateTask(t.id, "stage", e.target.value as Stage)}
                  >
                    {STAGES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <input
                    className="w-full rounded-xl border px-2 py-1 text-sm"
                    placeholder="Task ID"
                    value={t.dependsOn ?? ""}
                    onChange={(e) => updateTask(t.id, "dependsOn", e.target.value as any)}
                  />
                  <div
                    className={`text-[10px] mt-1 inline-block px-2 py-0.5 rounded-full ${
                      ready === "Ready"
                        ? "bg-green-100 text-green-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {ready}
                  </div>
                </div>
                <div>
                  <select
                    className="w-full rounded-xl border px-2 py-1 text-sm"
                    value={t.assignee}
                    onChange={(e) => updateTask(t.id, "assignee", e.target.value)}
                  >
                    {TEAM.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <select
                    className="w-full rounded-xl border px-2 py-1 text-sm"
                    value={t.priority}
                    onChange={(e) => updateTask(t.id, "priority", e.target.value as Priority)}
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <select
                    className="w-full rounded-xl border px-2 py-1 text-sm"
                    value={t.status}
                    onChange={(e) => updateTask(t.id, "status", e.target.value as TaskStatus)}
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <input
                    type="date"
                    className="w-full rounded-xl border px-2 py-1 text-sm"
                    value={t.startDate ?? ""}
                    onChange={(e) => updateTask(t.id, "startDate", e.target.value)}
                  />
                </div>
                <div>
                  <input
                    type="date"
                    className="w-full rounded-xl border px-2 py-1 text-sm"
                    value={t.dueDate ?? ""}
                    onChange={(e) => updateTask(t.id, "dueDate", e.target.value)}
                  />
                </div>
                <div>
                  <input
                    type="date"
                    className="w-full rounded-xl border px-2 py-1 text-sm"
                    value={t.actualEnd ?? ""}
                    onChange={(e) => updateTask(t.id, "actualEnd", e.target.value)}
                  />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      className="w-20 rounded-xl border px-2 py-1 text-sm"
                      value={t.manualPct ?? ""}
                      placeholder={String(finalPct)}
                      onChange={(e) =>
                        updateTask(
                          t.id,
                          "manualPct",
                          e.target.value === ""
                            ? undefined
                            : Math.max(0, Math.min(100, Number(e.target.value)))
                        )
                      }
                    />
                    <div className="h-2 w-24 rounded-full bg-gray-200 overflow-hidden">
                      <div
                        className="h-full bg-black transition-all"
                        style={{ width: `${finalPct}%` }}
                      />
                    </div>
                  </div>
                </div>
                <div className="col-span-12">
                  <textarea
                    className="w-full rounded-xl border px-2 py-1 text-sm"
                    placeholder="Notes"
                    value={t.notes ?? ""}
                    onChange={(e) => updateTask(t.id, "notes", e.target.value)}
                  />
                </div>
                <div className="col-span-12 flex justify-end">
                  {t.status === "Done" ? (
                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800">Done</span>
                  ) : overdue ? (
                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-red-100 text-red-800">Overdue</span>
                  ) : (
                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-800">{finalPct}%</span>
                  )}
                  <button
                    className="ml-2 text-sm text-red-600"
                    onClick={() => removeTask(t.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </section>

        {/* Projects */}
        <section id="tab-projects" className="rounded-2xl border bg-white p-4 mb-6">
          <div className="text-base font-semibold mb-3">Projects</div>
          <button onClick={addProject} className="mb-3 rounded-2xl border px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200">+ Add Project</button>
          {projects.map((p) => {
            const pct = overallPctByProject[p.id] ?? 0;
            return (
              <div key={p.id} className="border rounded-2xl p-4 grid md:grid-cols-4 gap-3 mb-3">
                <div>
                  <div className="text-xs text-gray-500">Project ID</div>
                  <input
                    className="w-full rounded-xl border px-2 py-1 text-sm"
                    value={p.id}
                    onChange={(e) =>
                      setProjects(
                        projects.map((x) => (x.id === p.id ? { ...x, id: e.target.value } : x))
                      )
                    }
                  />
                </div>
                <div>
                  <div className="text-xs text-gray-500">Name</div>
                  <input
                    className="w-full rounded-xl border px-2 py-1 text-sm"
                    value={p.name}
                    onChange={(e) =>
                      setProjects(
                        projects.map((x) => (x.id === p.id ? { ...x, name: e.target.value } : x))
                      )
                    }
                  />
                </div>
                <div>
                  <div className="text-xs text-gray-500">Client</div>
                  <input
                    className="w-full rounded-xl border px-2 py-1 text-sm"
                    value={p.client}
                    onChange={(e) =>
                      setProjects(
                        projects.map((x) => (x.id === p.id ? { ...x, client: e.target.value } : x))
                      )
                    }
                  />
                </div>
                <div>
                  <div className="text-xs text-gray-500">Producer</div>
                  <select
                    className="w-full rounded-xl border px-2 py-1 text-sm"
                    value={p.producer}
                    onChange={(e) =>
                      setProjects(
                        projects.map((x) => (x.id === p.id ? { ...x, producer: e.target.value } : x))
                      )
                    }
                  >
                    {TEAM.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-4">
                  <div className="text-xs text-gray-500 mb-1">Overall Progress</div>
                  <div className="h-2 w-full rounded-full bg-gray-200 overflow-hidden">
                    <div className="h-full bg-black" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              </div>
            );
          })}
        </section>

        {/* Help */}
        <section id="tab-help" className="rounded-2xl border bg-white p-4">
          <div className="text-base font-semibold mb-2">How this works</div>
          <ul className="list-disc pl-5 text-sm text-gray-700 space-y-1">
            <li>No separate component file required — the full app is inlined here to avoid path errors.</li>
            <li>Data is saved in your browser (localStorage). Use <b>Export JSON</b> for backups.</li>
            <li>Set dependencies by Task ID; the Ready/Wait pill reflects the dependency status.</li>
            <li>Manual % overrides auto % (derived from Status).</li>
            <li>Overdue = Due Date in the past and Status ≠ Done.</li>
          </ul>
        </section>
      </div>
    </main>
  );
}
