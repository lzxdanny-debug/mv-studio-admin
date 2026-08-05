'use client';

import { Image as ImageIcon } from 'lucide-react';
import { DanceTemplateList, type DanceTemplateRow } from '../_components/dance-template-list';

interface DanceSceneRow extends DanceTemplateRow {
  previewImageUrl: string;
  supportedDanceStyles: string[] | null;
  supportsDualCharacter: boolean;
  supportsCrowd: boolean;
  aspectRatios: string[] | null;
  identityRisk: string;
  fullBodyReadability: string;
}

const RISK_LABEL: Record<string, string> = {
  low: '低',
  medium: '中',
  high: '高',
};

export default function AdminDanceScenesPage() {
  return (
    <DanceTemplateList<DanceSceneRow>
      title="舞蹈场景"
      description="场景模板提供环境 Prompt、空间锚点与灯光方案。身份风险与全身可读性用于筛除不利于看清人物和动作的场景。"
      icon={ImageIcon}
      endpoint="/admin/dance/scenes"
      queryKey={['admin', 'dance', 'scenes']}
      editPermission="dance.scenes.edit"
      extraColumns={[
        {
          key: 'preview',
          header: '预览',
          width: 'w-20',
          render: (row) =>
            row.previewImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={row.previewImageUrl}
                alt=""
                className="h-10 w-14 rounded-lg border border-slate-200 object-cover"
              />
            ) : (
              '—'
            ),
        },
        {
          key: 'styles',
          header: '适用舞种',
          width: 'w-36',
          render: (row) => row.supportedDanceStyles?.join(', ') || '不限',
        },
        {
          key: 'ratios',
          header: '画幅',
          width: 'w-28',
          render: (row) => row.aspectRatios?.join(', ') || '不限',
        },
        {
          key: 'capability',
          header: '双人 / 群舞',
          width: 'w-28',
          render: (row) =>
            `${row.supportsDualCharacter ? '支持' : '不支持'} / ${row.supportsCrowd ? '支持' : '不支持'}`,
        },
        {
          key: 'risk',
          header: '身份风险 / 可读性',
          width: 'w-36',
          render: (row) =>
            `${RISK_LABEL[row.identityRisk] ?? (row.identityRisk || '—')} / ${
              RISK_LABEL[row.fullBodyReadability] ?? (row.fullBodyReadability || '—')
            }`,
        },
      ]}
    />
  );
}
