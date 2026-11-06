import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MatchGame } from "@/components/MatchGame";

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: mocks.rpc } }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
describe("server-managed matching", () => {
  it("submits only session and selected cards, and displays the server score", async () => {
    const cards = [{ key: "opaque-de", wordId: "word", side: "de", text: "das Haus" }, { key: "opaque-fr", wordId: "word", side: "fr", text: "la maison" }];
    mocks.rpc.mockImplementation(async (name: string) => {
      if (name === "class_match_top") return { data: [], error: null };
      const game = { id: "session", cards, wave: 1, totalWaves: 1, pairs: 0, run: 0, bestRun: 0, finished: false };
      if (name === "start_match_session") return { data: game, error: null };
      if (name === "play_match_turn") return { data: { ...game, pairs: 1, run: 1, bestRun: 1, finished: true, correct: true, newWave: true }, error: null };
      throw new Error("Legacy score submission forbidden");
    });
    render(<QueryClientProvider client={new QueryClient()}><MatchGame listId="list" words={[]} onQuit={() => {}} /></QueryClientProvider>);
    fireEvent.click(await screen.findByRole("button", { name: "das Haus" }));
    fireEvent.click(screen.getByRole("button", { name: "la maison" }));
    await waitFor(() => expect(screen.getByText("Partie terminée !")).toBeTruthy());
    expect(mocks.rpc).toHaveBeenCalledWith("play_match_turn", { _session: "session", _first: "opaque-de", _second: "opaque-fr" });
    expect(mocks.rpc.mock.calls.some(([name]) => name === "record_match")).toBe(false);
    expect(screen.getByText(/1 paires trouvées/)).toBeTruthy();
  });
});