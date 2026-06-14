import type { Metadata } from "next";
import { buildPostShareMetadata } from "@/lib/voiceShareMetadata";

type Props = {
  children: React.ReactNode;
  params: { id: string };
};

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  return buildPostShareMetadata(params.id);
}

export default function PostDetailLayout({ children }: Props) {
  return children;
}
