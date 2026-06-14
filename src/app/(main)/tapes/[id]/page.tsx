"use client";

import { useParams, useSearchParams } from "next/navigation";
import TapeFeed from "@/components/tapes/TapeFeed";
import { parseTapeFeedSource } from "@/utils/tapeFeedSource";

export default function TapeDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const feedSource = parseTapeFeedSource(searchParams.get("from"));

  return <TapeFeed initialTapeId={id} feedSource={feedSource} />;
}
