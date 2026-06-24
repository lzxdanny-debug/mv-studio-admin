'use client';

import { ImageOff } from 'lucide-react';
import { AnomalyShotsPageView } from '../_components/anomaly-shots-page';

export default function StoryboardAnomalyPage() {
  return (
    <AnomalyShotsPageView
      config={{
        kind: 'storyboards',
        title: '故事板异常',
        description: '故事板生成失败，或生成中卡住超过 30 分钟且无故事板图',
        icon: ImageOff,
        emptyMessage: '暂无故事板异常或卡住的镜头',
        showStoryboardCol: true,
        showVideoCol: false,
      }}
    />
  );
}
