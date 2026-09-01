'use client';

import { BrainCircuit } from 'lucide-react';
import { AimvOperationsAnomalyPage } from '@/components/aimv-operations-anomaly-page';

export default function LlmAnomalyPage() {
  return (
    <AimvOperationsAnomalyPage
      kind="llm"
      title="AI MV 语言大模型异常"
      description="查看 AI MV Generator 在音乐分析和创意规划阶段记录的语言模型失败项目。"
      emptyMessage="暂无 AI MV 语言大模型异常记录"
      icon={BrainCircuit}
    />
  );
}
