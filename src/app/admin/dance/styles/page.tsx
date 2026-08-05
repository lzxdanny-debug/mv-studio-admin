'use client';

import { useState } from 'react';
import { Palette } from 'lucide-react';
import { DanceTemplateList, type DanceTemplateRow } from '../_components/dance-template-list';
import {
  DanceStyleActionEditor,
  type DanceStyleActionRow,
} from './_components/dance-style-action-editor';

interface DanceStyleRow extends DanceTemplateRow, DanceStyleActionRow {
  coverUrl: string;
  bpmRange: { min: number; max: number } | null;
  movementVocabulary: string[] | null;
  avoidMoves: string[] | null;
  phraseBank: Record<string, string> | null;
  recommendedModels: string[] | null;
}

export default function AdminDanceStylesPage() {
  const [editingStyle, setEditingStyle] = useState<DanceStyleRow | null>(null);

  return (
    <>
      <DanceTemplateList<DanceStyleRow>
        title="舞种"
        description="维护 Dance Agent 实际使用的身体质感、动作词、禁用动作与 Phrase Bank。模型选择统一由 AI Router 管理。"
        icon={Palette}
        endpoint="/admin/dance/styles"
        queryKey={['admin', 'dance', 'styles']}
        editPermission="dance.styles.edit"
        onEdit={setEditingStyle}
        extraColumns={[
          {
            key: 'bpm',
            header: 'BPM',
            width: 'w-24',
            render: (row) => (row.bpmRange ? `${row.bpmRange.min}-${row.bpmRange.max}` : '—'),
          },
          {
            key: 'vocabulary',
            header: '动作 / 禁用',
            width: 'w-28',
            render: (row) =>
              `${row.movementVocabulary?.length ?? 0} / ${row.avoidMoves?.length ?? 0}`,
          },
          {
            key: 'phrases',
            header: '动作短语',
            width: 'w-24',
            render: (row) =>
              `${Object.values(row.phraseBank ?? {}).filter(Boolean).length} 条`,
          },
        ]}
      />
      <DanceStyleActionEditor
        style={editingStyle}
        onClose={() => setEditingStyle(null)}
      />
    </>
  );
}
