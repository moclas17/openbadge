import type { Metadata } from "next";
import { ClaimFlow } from "@/components/claim/ClaimFlow";

export const metadata: Metadata = {
  title: "Claim your credential",
};

export default async function ClaimPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  return (
    <div className="mx-auto w-full max-w-xl">
      <ClaimFlow code={decodeURIComponent(code)} />
    </div>
  );
}
