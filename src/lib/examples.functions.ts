import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const LEVEL_HINTS: Record<string, string> = {
  A1: "A1 : phrases très courtes (5-8 mots), présent, vocabulaire très courant.",
  A2: "A2 : phrases simples, présent ou Perfekt, connecteurs simples (weil, aber, denn).",
  B1: "B1 : phrases plus riches, subordonnées, temps variés.",
};

/** Teacher-only: AI proposes example sentences (with [gap]) for a list, or one word of it. */
export const generateExamples = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ listId: z.string().uuid(), wordId: z.string().uuid().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isTeacher } = await supabase.rpc("has_role", { _user_id: userId, _role: "teacher" });
    if (!isTeacher) throw new Error("Réservé aux enseignants");
    const list = await supabase.from("vocab_lists").select("id, level").eq("id", data.listId).single();
    if (list.error) throw new Error("Liste introuvable");
    let q = supabase.from("words").select("id, german, french, example_de").eq("list_id", data.listId);
    if (data.wordId) q = q.eq("id", data.wordId);
    const words = ((await q).data ?? []).filter((w) => data.wordId || !w.example_de.trim()).slice(0, 40);
    if (!words.length) return { updated: 0 };

    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("Clé IA manquante");
    const { createOpenAI } = await import("@ai-sdk/openai");
    const { streamText } = await import("ai");
    const provider = createOpenAI({
      baseURL: "https://ai.gateway.lovable.dev/v1",
      apiKey,
      headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    });
    const level = list.data.level || "A1";
    const prompt = `Tu es professeur d'allemand pour des élèves francophones. Niveau ${LEVEL_HINTS[level] ?? LEVEL_HINTS["A1"]}
Pour chaque mot, écris UNE phrase allemande naturelle qui l'emploie, et mets entre crochets [ ] exactement la partie que l'élève devra écrire (le mot, éventuellement avec son article ou sa forme déclinée/conjuguée). Donne aussi la traduction française de la phrase (sans crochets).
Réponds uniquement en JSON : {"items":[{"id":"...","de":"...","fr":"..."}]}
Mots :
${words.map((w) => `${w.id} | ${w.german} | ${w.french}`).join("\n")}`;
    const result = streamText({
      model: provider.responses("openai/gpt-6-astra"),
      prompt,
      maxRetries: 0,
      providerOptions: { openai: { store: false, forceReasoning: true, reasoningEffort: "low" } },
    });
    let text: string;
    try { text = await result.text; } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("402")) throw new Error("Crédits IA épuisés pour le moment.");
      if (msg.includes("429")) throw new Error("Trop de demandes, réessayez dans une minute.");
      throw new Error("La génération a échoué : " + msg.slice(0, 120));
    }
    const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
    let items: { id: string; de: string; fr: string }[] = [];
    try { items = JSON.parse(json).items ?? []; } catch { throw new Error("Réponse de l'IA illisible, réessayez."); }
    const ids = new Set(words.map((w) => w.id));
    let updated = 0;
    for (const it of items) {
      if (!ids.has(it.id) || !/\[[^\]]+\]/.test(it.de ?? "")) continue;
      const { error } = await supabase.from("words")
        .update({ example_de: it.de.trim().slice(0, 300), example_fr: (it.fr ?? "").trim().slice(0, 300) }).eq("id", it.id);
      if (!error) updated++;
    }
    return { updated };
  });
