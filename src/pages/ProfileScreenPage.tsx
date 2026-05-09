import React from 'react';
import AppLayout from '@/components/AppLayout';
import ProfileContent from './components/ProfileContent';

export default function ProfilePage() {
  return (
    <AppLayout>
      <div className="gradient-bg-profile min-h-screen pb-20 lg:pb-0 page-enter">
        <ProfileContent />
      </div>
    </AppLayout>
  );
}