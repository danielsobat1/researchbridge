"use client";

import { useState, useEffect } from "react";

type List = {
  id: string;
  name: string;
  items: string[];
};

type AddToListModalProps = {
  isOpen: boolean;
  onClose: () => void;
  itemId: string;
  itemType: "opportunity" | "professor" | "researcher";
  itemData?: any;
};

export default function AddToListModal({ isOpen, onClose, itemId, itemType, itemData }: AddToListModalProps) {
  const [lists, setLists] = useState<List[]>([]);
  const [showNewList, setShowNewList] = useState(false);
  const [newListName, setNewListName] = useState("");

  useEffect(() => {
    if (isOpen) {
      loadLists();
    }
  }, [isOpen]);

  const loadLists = () => {
    try {
      const stored = localStorage.getItem("rb_lists");
      if (stored) {
        setLists(JSON.parse(stored));
      }
    } catch {}
  };

  const saveLists = (updatedLists: List[]) => {
    try {
      localStorage.setItem("rb_lists", JSON.stringify(updatedLists));
      setLists(updatedLists);
    } catch {}
  };

  const addToList = (listId: string) => {
    // Store researcher data if provided
    if (itemType === "researcher" && itemData) {
      try {
        const stored = localStorage.getItem("rb_researchers") || "{}";
        const researchers = JSON.parse(stored);
        researchers[itemId] = itemData;
        localStorage.setItem("rb_researchers", JSON.stringify(researchers));
      } catch {}
    }

    const updatedLists = lists.map(list => {
      if (list.id === listId) {
        const key = `${itemType}:${itemId}`;
        if (!list.items.includes(key)) {
          return { ...list, items: [...list.items, key] };
        }
      }
      return list;
    });
    saveLists(updatedLists);
    onClose();
  };

  const removeFromList = (listId: string) => {
    const updatedLists = lists.map(list => {
      if (list.id === listId) {
        const key = `${itemType}:${itemId}`;
        return { ...list, items: list.items.filter(item => item !== key) };
      }
      return list;
    });
    saveLists(updatedLists);
  };

  const createNewList = () => {
    if (!newListName.trim()) return;

    // Store researcher data if provided
    if (itemType === "researcher" && itemData) {
      try {
        const stored = localStorage.getItem("rb_researchers") || "{}";
        const researchers = JSON.parse(stored);
        researchers[itemId] = itemData;
        localStorage.setItem("rb_researchers", JSON.stringify(researchers));
      } catch {}
    }

    const newList: List = {
      id: Date.now().toString(),
      name: newListName.trim(),
      items: [`${itemType}:${itemId}`],
    };

    saveLists([...lists, newList]);
    setNewListName("");
    setShowNewList(false);
    onClose();
  };

  const isInList = (listId: string) => {
    const list = lists.find(l => l.id === listId);
    return list?.items.includes(`${itemType}:${itemId}`) || false;
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "var(--background)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: 20,
          maxWidth: 400,
          width: "90%",
          maxHeight: "80vh",
          overflow: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 18, color: "var(--foreground)" }}>Add to List</h3>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: 24,
              cursor: "pointer",
              color: "var(--foreground)",
              padding: 0,
            }}
          >
            ×
          </button>
        </div>

        {lists.length === 0 && !showNewList ? (
          <div style={{ color: "color-mix(in srgb, var(--foreground) 70%, transparent)", marginBottom: 16 }}>
            No lists yet. Create your first list!
          </div>
        ) : (
          <div style={{ marginBottom: 16 }}>
            {lists.map((list) => {
              const inList = isInList(list.id);
              return (
                <div
                  key={list.id}
                  style={{
                    padding: "10px 12px",
                    marginBottom: 8,
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    backgroundColor: "var(--card-bg)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span style={{ color: "var(--foreground)", fontSize: 14 }}>
                    {list.name} ({list.items.length})
                  </span>
                  <button
                    onClick={() => (inList ? removeFromList(list.id) : addToList(list.id))}
                    style={{
                      padding: "6px 12px",
                      fontSize: 13,
                      borderRadius: 6,
                      border: "none",
                      cursor: "pointer",
                      backgroundColor: inList ? "var(--accent)" : "var(--input-bg)",
                      color: inList ? "var(--background)" : "var(--foreground)",
                      fontWeight: inList ? 600 : 400,
                    }}
                  >
                    {inList ? "✓ Added" : "+ Add"}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {!showNewList ? (
          <button
            onClick={() => setShowNewList(true)}
            style={{
              width: "100%",
              padding: "10px",
              fontSize: 14,
              borderRadius: 8,
              border: "1px solid var(--border)",
              backgroundColor: "var(--input-bg)",
              color: "var(--foreground)",
              cursor: "pointer",
              fontWeight: 500,
            }}
          >
            + Create New List
          </button>
        ) : (
          <div>
            <input
              type="text"
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              placeholder="List name..."
              style={{
                width: "100%",
                padding: "10px",
                fontSize: 14,
                borderRadius: 8,
                border: "1px solid var(--border)",
                backgroundColor: "var(--input-bg)",
                color: "var(--foreground)",
                marginBottom: 8,
                outline: "none",
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") createNewList();
                if (e.key === "Escape") setShowNewList(false);
              }}
              autoFocus
            />
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={createNewList}
                disabled={!newListName.trim()}
                style={{
                  flex: 1,
                  padding: "8px",
                  fontSize: 13,
                  borderRadius: 6,
                  border: "none",
                  backgroundColor: "var(--accent)",
                  color: "var(--background)",
                  cursor: "pointer",
                  fontWeight: 600,
                  opacity: newListName.trim() ? 1 : 0.5,
                }}
              >
                Create
              </button>
              <button
                onClick={() => {
                  setShowNewList(false);
                  setNewListName("");
                }}
                style={{
                  flex: 1,
                  padding: "8px",
                  fontSize: 13,
                  borderRadius: 6,
                  border: "1px solid var(--border)",
                  backgroundColor: "transparent",
                  color: "var(--foreground)",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
