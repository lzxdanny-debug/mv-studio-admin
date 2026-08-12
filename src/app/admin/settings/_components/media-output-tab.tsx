'use client';

import { WatermarkSection } from './watermark-section';
import { AudioCompressionSection } from './audio-compression-section';

/**
 * 系统设置 · 成片资源：
 *   - 成片水印（MV / Dance / Karaoke 共用图）
 *   - 音频压缩（喂 Gemini 前的 LRC / 音乐分析预处理）
 */
export function MediaOutputTab() {
  return (
    <div className="space-y-6">
      <WatermarkSection />
      <AudioCompressionSection />
    </div>
  );
}
