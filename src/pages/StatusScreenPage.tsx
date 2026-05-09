// @ts-nocheck
import React from 'react';
import AppLayout from '@/components/AppLayout';
import StatusHero from './components/StatusHero';
import StatusGrid from './components/StatusGrid';

export default function StatusPage() {
  return (
    <AppLayout>
      <div className="gradient-bg-status min-h-screen pb-20 lg:pb-0 page-enter">
        <StatusHero />
        <StatusGrid />
      </div>
    </AppLayout>
  );
}