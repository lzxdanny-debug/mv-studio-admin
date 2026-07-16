'use client';

import { MvMusicLimitsSection } from './mv-music-limits-section';
import { ComposeWorkerSection } from './compose-worker-section';

export function MvSettingsTab() {
  return (
    <div className="space-y-8">
      <MvMusicLimitsSection />
      <ComposeWorkerSection />
    </div>
  );
}
