"use client";

import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { MatchScoreBadge } from "@/components/ui/badge";
import { PIPELINE_STAGES } from "@/lib/constants/pipeline";
import { cn } from "@/lib/utils";
import type { PipelineStage } from "@prisma/client";

interface KanbanItem {
  id: string;
  candidateName: string;
  currentRole?: string | null;
  location?: string | null;
  updatedLabel?: string | null;
  score?: number;
}

interface KanbanColumn {
  stage: PipelineStage;
  items: KanbanItem[];
}

function SortableCard({ item }: { item: KanbanItem }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="rounded-lg border border-border bg-card p-3 shadow-sm cursor-grab active:cursor-grabbing"
    >
      <div className="flex items-center gap-2">
        <Avatar name={item.candidateName} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium truncate">{item.candidateName}</div>
          {item.currentRole && (
            <div className="text-[10px] text-muted-foreground truncate">{item.currentRole}</div>
          )}
          {item.location && (
            <div className="text-[10px] text-muted-foreground truncate">{item.location}</div>
          )}
          {item.updatedLabel && (
            <div className="text-[10px] text-muted-foreground/80">{item.updatedLabel}</div>
          )}
        </div>
        {item.score !== undefined && <MatchScoreBadge score={item.score} />}
      </div>
    </div>
  );
}

function DroppableColumn({
  stage,
  children,
}: {
  stage: PipelineStage;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "space-y-2 min-h-[200px] rounded-lg bg-muted/30 p-2 transition-colors",
        isOver && "ring-2 ring-brand-700/50 bg-brand-700/5"
      )}
    >
      {children}
    </div>
  );
}

export function KanbanBoard({
  columns,
  onMove,
}: {
  columns: KanbanColumn[];
  onMove: (applicationId: string, toStage: PipelineStage) => void;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  const activeItem = columns
    .flatMap((c) => c.items)
    .find((i) => i.id === activeId);

  function resolveStage(overId: string): PipelineStage | null {
    if (PIPELINE_STAGES.some((s) => s.key === overId)) {
      return overId as PipelineStage;
    }
    const col = columns.find((c) => c.items.some((i) => i.id === overId));
    return col?.stage ?? null;
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const toStage = resolveStage(over.id as string);
    const item = columns.flatMap((c) => c.items).find((i) => i.id === active.id);
    if (item && toStage && item.id) {
      const fromCol = columns.find((c) => c.items.some((i) => i.id === item.id));
      if (fromCol?.stage !== toStage) {
        onMove(item.id, toStage);
      }
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map((col) => (
          <div key={col.stage} className="min-w-[220px] flex-1">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold">
                {PIPELINE_STAGES.find((s) => s.key === col.stage)?.label}
              </span>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px]">{col.items.length}</span>
            </div>
            <SortableContext items={col.items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
              <DroppableColumn stage={col.stage}>
                {col.items.length === 0 ? (
                  <p className="text-[10px] text-muted-foreground text-center py-8">Drop here</p>
                ) : (
                  col.items.map((item) => <SortableCard key={item.id} item={item} />)
                )}
              </DroppableColumn>
            </SortableContext>
          </div>
        ))}
      </div>
      <DragOverlay>
        {activeItem && (
          <div className="rounded-lg border border-border bg-card p-3 shadow-lg opacity-90">
            <div className="text-xs font-medium">{activeItem.candidateName}</div>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
