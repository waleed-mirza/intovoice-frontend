"use client";

import { useParams } from "next/navigation";
import TapeFeed from "@/components/tapes/TapeFeed";

export default function TapeDetailPage() {
  const params = useParams();
  const id = params.id as string;

  return <TapeFeed initialTapeId={id} />;
}
