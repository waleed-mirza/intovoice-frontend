import type { Metadata } from "next";
import { buildTapeShareMetadata } from "@/lib/voiceShareMetadata";

type Props = {
  children: React.ReactNode;
  params: { id: string };
};

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  return buildTapeShareMetadata(params.id);
}

export default function TapeDetailLayout({ children }: Props) {
  return children;
}
