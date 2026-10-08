import { supabase } from "@/integrations/supabase/client";

/**
 * Evidence objects live under their owner's folder in the private ari-evidence bucket, so a path
 * only stays valid while some record still points at it. Deletions are best effort: cleaning the
 * bucket must never turn a failed save into a second failure nor block deleting the record.
 */
export async function removeEvidence(paths: readonly unknown[]): Promise<void> {
  const targets = paths.filter(
    (path): path is string => typeof path === "string" && path.length > 0,
  );
  if (!targets.length) return;
  const { error } = await supabase.storage.from("ari-evidence").remove(targets);
  if (error) console.error("Não foi possível apagar evidências do storage:", error.message);
}
