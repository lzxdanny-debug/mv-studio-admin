'use client';

import { ImageOff } from 'lucide-react';
import { AimvOperationsAnomalyPage } from '@/components/aimv-operations-anomaly-page';

export default function StoryboardAnomalyPage() {
  return (
    <AimvOperationsAnomalyPage
      kind="storyboard"
      title="AI MV 故事板异常"
      description="查看 AI MV Generator 故事板生成失败，以及生成状态超过 30 分钟未结束的分镜。"
      emptyMessage="暂无 AI MV 故事板失败或超时记录"
      icon={ImageOff}
    />
  );
}
