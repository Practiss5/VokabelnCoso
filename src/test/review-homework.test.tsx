import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReviewSession } from "@/components/ReviewSession";

const mocks = vi.hoisted(() => ({ send: vi.fn(async () => "ok" as const) }));
vi.mock("@/lib/answer-queue", () => ({ sendAnswer: mocks.send, startAnswerSync: vi.fn() }));
vi.mock("@/lib/study-time", () => ({ notifyAnswer: vi.fn() }));
vi.mock("@/components/GermanAudio", () => ({ GermanAudio: () => null }));
vi.mock("@tanstack/react-router", () => ({ Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a> }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("mixed homework session retries", () => {
  it("records a second attempt for each missed direction of the same word", async () => {
    const word = { id: "a", german: "das Haus", french: "la maison" };
    const other = { id: "b", german: "der Hund", french: "le chien" };
    render(<QueryClientProvider client={new QueryClient()}><ReviewSession title="Test" pool={[word, other]}
      items={[{ word, mode: "choice", dir: "de_fr" }, { word, mode: "choice", dir: "fr_de" }]}
      onQuit={() => {}} /></QueryClientProvider>);
    for (const wrong of ["le chien", "der Hund", "le chien", "der Hund"]) {
      fireEvent.click(screen.getByRole("button", { name: wrong }));
      await waitFor(() => expect(mocks.send).toHaveBeenCalled());
      fireEvent.click(screen.getByRole("button", { name: "Suivant" }));
    }
    expect(mocks.send.mock.calls.map((call) => (call as unknown as [{ _mode: string }])[0]._mode))
      .toEqual(["choice_de_fr", "choice_fr_de", "choice_de_fr", "choice_fr_de"]);
  });
});