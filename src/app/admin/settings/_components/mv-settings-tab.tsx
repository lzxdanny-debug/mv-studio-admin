'use client';

import { MvMusicLimitsSection } from './mv-music-limits-section';
import { ComposeWorkerSection } from './compose-worker-section';

export function MvSettingsTab() {
  return (
    <div className="space-y-6">
      <MvMusicLimitsSection />
      <ComposeWorkerSection />
    </div>
  );
}
