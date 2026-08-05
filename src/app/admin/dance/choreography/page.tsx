'use client';

import { ListOrdered } from 'lucide-react';
import { DanceTemplateList, type DanceTemplateRow } from '../_components/dance-template-list';

interface DanceChoreographyRow extends DanceTemplateRow {
  supportedDanceStyles: string[] | null;
  durationRange: { min: number; max: number } | null;
  bpmRange: { min: number; max: number } | null;
  sectionBlueprint: unknown[] | null;
  cameraArc: unknown[] | null;
}

export default function AdminDanceChoreographyPage() {
  return (
    <DanceTemplateList<DanceChoreographyRow>
      title="编舞模板"
      description="编舞模板决定段落蓝图、能量曲线与镜头弧线。用户不选模板时由 AI 依据音乐自动编排；段落蓝图编辑器随编排能力上线后开放。"
      icon={ListOrdered}
      endpoint="/admin/dance/choreography"
      queryKey={['admin', 'dance', 'choreography']}
      editPermission="dance.choreography.edit"
      extraColumns={[
        {
          key: 'styles',
          header: '适用舞种',
          width: 'w-40',
          render: (row) => row.supportedDanceStyles?.join(', ') || '不限',
        },
        {
          key: 'duration',
          header: '时长区间',
          width: 'w-28',
          render: (row) =>
            row.durationRange ? `${row.durationRange.min}-${row.durationRange.max}s` : '—',
        },
        {
          key: 'bpm',
          header: 'BPM',
          width: 'w-24',
          render: (row) => (row.bpmRange ? `${row.bpmRange.min}-${row.bpmRange.max}` : '—'),
        },
        {
          key: 'blueprint',
          header: '段落 / 镜头',
          width: 'w-28',
          render: (row) => `${row.sectionBlueprint?.length ?? 0} / ${row.cameraArc?.length ?? 0}`,
        },
      ]}
    />
  );
}
