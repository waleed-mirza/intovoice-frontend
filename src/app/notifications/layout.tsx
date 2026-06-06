"use client";

import VoiceLayout from "@/components/voice/VoiceLayout";

export default function NotificationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <VoiceLayout>{children}</VoiceLayout>;
}
