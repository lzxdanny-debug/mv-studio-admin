'use client';

import { VideoOff } from 'lucide-react';
import { AnomalyShotsPageView } from '../_components/anomaly-shots-page';

export default function FailedShotsAnomalyPage() {
  return (
    <AnomalyShotsPageView
      config={{
        kind: 'failed-shots',
        title: '镜头视频失败',
        description:
          'MV / Karaoke / Dance：故事板（场景图）已就绪但视频失败，或视频生成卡住超过 30 分钟',
        icon: VideoOff,
        emptyMessage: '暂无视频失败或卡住的镜头（含 Karaoke / Dance）',
        showStoryboardCol: true,
        showVideoCol: true,
      }}
    />
  );
}
