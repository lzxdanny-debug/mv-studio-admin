'use client';

import { VideoOff } from 'lucide-react';
import { AimvOperationsAnomalyPage } from '@/components/aimv-operations-anomaly-page';

export default function FailedShotsAnomalyPage() {
  return (
    <AimvOperationsAnomalyPage
      kind="video"
      title="AI MV 镜头视频失败"
      description="查看 AI MV Generator 分镜视频生成失败，以及生成状态超过 30 分钟未结束的镜头。"
      emptyMessage="暂无 AI MV 镜头视频失败或超时记录"
      icon={VideoOff}
    />
  );
}
