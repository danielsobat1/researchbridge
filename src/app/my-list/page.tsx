
"use client";

import { useEffect, useState } from "react";
import { opportunities } from "../opportunities/opportunities";
import { ubcUndergradResearchers } from "../professors/ubcUndergradResearchers";

type List = {
  id: string;
  name: string;
  items: string[];
};

export default function MyListsPage() {
  const [lists, setLists] = useState<List[]>([]);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  useEffect(() => {
    loadLists();
  }, []);

  const loadLists = () => {
    try {
      const stored = localStorage.getItem("rb_lists");
      if (stored) {
        const parsed = JSON.parse(stored);
        setLists(parsed);
        if (parsed.length > 0 && !selectedListId) {
          setSelectedListId(parsed[0].id);
        }
      }
    } catch {}
  };

  const saveLists = (updatedLists: List[]) => {
    try {
      localStorage.setItem("rb_lists", JSON.stringify(updatedLists));
      setLists(updatedLists);
    } catch {}
  };

  const deleteList = (listId: string) => {
    const updated = lists.filter(l => l.id !== listId);
    saveLists(updated);
    if (selectedListId === listId) {
      setSelectedListId(updated.length > 0 ? updated[0].id : null);
    }
  };

  const renameList = (listId: string, newName: string) => {
    const updated = lists.map(l => 
      l.id === listId ? { ...l, name: newName } : l
    );
    saveLists(updated);
    setEditingId(null);
    setEditName("");
  };

  const removeItem = (listId: string, itemKey: string) => {
    const updated = lists.map(l => 
      l.id === listId 
        ? { ...l, items: l.items.filter(item => item !== itemKey) }
        : l
    );
    saveLists(updated);
  };

  const selectedList = lists.find(l => l.id === selectedListId);

  const getItemDetails = (itemKey: string) => {
    const colonIndex = itemKey.indexOf(":");
    const type = itemKey.substring(0, colonIndex);
    const id = itemKey.substring(colonIndex + 1);
    
    if (type === "opportunity") {
      const opp = opportunities.find(o => o.id === id);
      return opp ? { type, data: opp } : null;
    } else if (type === "professor") {
      const prof = ubcUndergradResearchers.find(p => p.id === id);
      return prof ? { type, data: prof } : null;
    } else if (type === "researcher") {
      try {
        const stored = localStorage.getItem("rb_researchers") || "{}";
        const researchers = JSON.parse(stored);
        const researcher = researchers[id];
        return researcher ? { type, data: researcher } : null;
      } catch {}
    }
    return null;
  };

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">My Lists</h1>
            <p className="mt-2 text-white/70">
              Manage your saved opportunities, professors, and researchers
            </p>
          </div>

          <div className="flex gap-2">
            <a
              href="/opportunities"
              className="rounded-xl border border-white/20 px-4 py-2 text-sm hover:bg-white/10"
            >
              Opportunities
            </a>
            <a
              href="/professors"
              className="rounded-xl border border-white/20 px-4 py-2 text-sm hover:bg-white/10"
            >
              Professors
            </a>
          </div>
        </div>

        {lists.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
            <div className="text-lg font-medium">No lists yet</div>
            <p className="mt-2 text-sm text-white/70">
              Start adding items to create your first list
            </p>
          </div>
        ) : (
          <div className="mt-8 grid gap-6 md:grid-cols-[250px_1fr]">
            {/* Sidebar with list names */}
            <div className="space-y-2">
              {lists.map((list) => (
                <div
                  key={list.id}
                  className={`rounded-xl border p-3 cursor-pointer transition-colors ${
                    selectedListId === list.id
                      ? "border-white/40 bg-white/10"
                      : "border-white/10 bg-white/5 hover:bg-white/10"
                  }`}
                  onClick={() => setSelectedListId(list.id)}
                >
                  {editingId === list.id ? (
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onBlur={() => {
                        if (editName.trim()) {
                          renameList(list.id, editName.trim());
                        } else {
                          setEditingId(null);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && editName.trim()) {
                          renameList(list.id, editName.trim());
                        } else if (e.key === "Escape") {
                          setEditingId(null);
                          setEditName("");
                        }
                      }}
                      className="w-full bg-transparent border-none outline-none text-sm font-medium"
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="text-sm font-medium">{list.name}</div>
                        <div className="text-xs text-white/70 mt-1">
                          {list.items.length} item{list.items.length !== 1 ? "s" : ""}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingId(list.id);
                            setEditName(list.name);
                          }}
                          className="p-1 hover:bg-white/10 rounded"
                          title="Rename"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`Delete "${list.name}"?`)) {
                              deleteList(list.id);
                            }
                          }}
                          className="p-1 hover:bg-white/10 rounded"
                          title="Delete"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* List items */}
            <div>
              {selectedList && (
                <>
                  <div className="mb-4">
                    <h2 className="text-xl font-semibold">{selectedList.name}</h2>
                    <p className="text-sm text-white/70 mt-1">
                      {selectedList.items.length} item{selectedList.items.length !== 1 ? "s" : ""}
                    </p>
                  </div>

                  {selectedList.items.length === 0 ? (
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-white/70">
                      This list is empty
                    </div>
                  ) : (
                    <div className="grid gap-4">
                      {selectedList.items.map((itemKey) => {
                        const item = getItemDetails(itemKey);
                        if (!item) return null;

                        if (item.type === "opportunity") {
                          const opp = item.data as any;
                          return (
                            <div key={itemKey} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                              <div className="flex items-start justify-between gap-4">
                                <div>
                                  <div className="text-lg font-medium">{opp.title}</div>
                                  <div className="mt-1 text-sm text-white/70">
                                    {opp.lab} · {opp.dept}
                                  </div>
                                  <p className="mt-3 text-sm text-white/70">{opp.description}</p>
                                </div>
                                <button
                                  onClick={() => removeItem(selectedList.id, itemKey)}
                                  className="rounded-xl border border-white/20 px-3 py-2 text-sm hover:bg-white/10"
                                  title="Remove"
                                >
                                  🗑️
                                </button>
                              </div>
                            </div>
                          );
                        } else if (item.type === "professor") {
                          const prof = item.data as any;
                          return (
                            <div key={itemKey} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                              <div className="flex items-start justify-between gap-4">
                                <div>
                                  <a
                                    href={prof.profileUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-lg font-medium underline decoration-white/40 underline-offset-4 hover:decoration-white"
                                  >
                                    {prof.firstName} {prof.lastName}
                                  </a>
                                  <div className="mt-1 text-sm text-white/70">
                                    {prof.faculty}
                                    {prof.departments?.length ? ` · ${prof.departments.join(", ")}` : ""}
                                  </div>
                                  {prof.interests && prof.interests.length > 0 && (
                                    <div className="mt-3 flex flex-wrap gap-2">
                                      {prof.interests.slice(0, 5).map((interest: string) => (
                                        <span
                                          key={interest}
                                          className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-white/70"
                                        >
                                          {interest}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                <button
                                  onClick={() => removeItem(selectedList.id, itemKey)}
                                  className="rounded-xl border border-white/20 px-3 py-2 text-sm hover:bg-white/10"
                                  title="Remove"
                                >
                                  🗑️
                                </button>
                              </div>
                            </div>
                          );
                        } else if (item.type === "researcher") {
                          const researcher = item.data as any;
                          return (
                            <div key={itemKey} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                              <div className="flex items-start justify-between gap-4">
                                <div>
                                  <a
                                    href={researcher.id}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-lg font-medium underline decoration-white/40 underline-offset-4 hover:decoration-white"
                                  >
                                    {researcher.name}
                                  </a>
                                  {researcher.lastKnownInstitution?.name && (
                                    <div className="mt-1 text-sm text-white/70">
                                      {researcher.lastKnownInstitution.name}
                                      {researcher.lastKnownInstitution.country
                                        ? ` (${researcher.lastKnownInstitution.country})`
                                        : ""}
                                    </div>
                                  )}
                                  <div className="mt-2 text-sm text-white/70">
                                    {researcher.worksCount != null && <div>{researcher.worksCount} total works</div>}
                                    {researcher.citedByCount != null && <div>{researcher.citedByCount} citations</div>}
                                  </div>
                                </div>
                                <button
                                  onClick={() => removeItem(selectedList.id, itemKey)}
                                  className="rounded-xl border border-white/20 px-3 py-2 text-sm hover:bg-white/10"
                                  title="Remove"
                                >
                                  🗑️
                                </button>
                              </div>
                            </div>
                          );
                        }

                        return null;
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
