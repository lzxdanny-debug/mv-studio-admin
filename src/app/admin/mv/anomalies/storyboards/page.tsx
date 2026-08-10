'use client';

import { ImageOff } from 'lucide-react';
import { AnomalyShotsPageView } from '../_components/anomaly-shots-page';

export default function StoryboardAnomalyPage() {
  return (
    <AnomalyShotsPageView
      config={{
        kind: 'storyboards',
        title: '故事板异常',
        description:
          'MV 故事板 / Karaoke 场景图 / Dance clip 故事板失败，或生成中卡住超过 30 分钟且无图',
        icon: ImageOff,
        emptyMessage: '暂无故事板/场景图异常（含 Karaoke / Dance）',
        showStoryboardCol: true,
        showVideoCol: false,
      }}
    />
  );
}
