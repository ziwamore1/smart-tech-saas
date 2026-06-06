"use client";

import { useState, useMemo } from "react";
import { Search, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Teacher {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  [key: string]: any;
}

interface Props {
  teachers: Teacher[];
  selected: Teacher[];
  onAdd: (teacher: Teacher) => void;
}

export default function TeacherSelector({ teachers, selected, onAdd }: Props) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const available = teachers.filter(
      (t) => !selected.some((s) => s.id === t.id)
    );
    if (!search.trim()) return available;
    const q = search.toLowerCase();
    return available.filter(
      (t) =>
        `${t.firstName} ${t.lastName}`.toLowerCase().includes(q) ||
        (t.email || "").toLowerCase().includes(q)
    );
  }, [teachers, selected, search]);

  if (teachers.length === 0) {
    return (
      <div className="border rounded-xl p-6 bg-muted/30 text-center text-muted-foreground">
        <p>No teachers in database. Create one first.</p>
      </div>
    );
  }

  return (
    <div className="border rounded-xl p-4 bg-card">
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search teacher..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="max-h-48 overflow-y-auto space-y-2">
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            {search ? "No teachers match your search" : "All teachers have been added"}
          </p>
        ) : (
          filtered.map((t) => (
            <div
              key={t.id}
              className="flex justify-between items-center border rounded-lg p-2.5 hover:bg-muted/50 transition-colors"
            >
              <div>
                <div className="font-medium text-sm">
                  {t.firstName} {t.lastName}
                </div>
                <div className="text-xs text-muted-foreground">
                  {t.email || "No email"}
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onAdd(t)}
                className="shrink-0 gap-1"
              >
                <UserPlus className="w-3.5 h-3.5" />
                Add
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
