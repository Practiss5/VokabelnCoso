import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReviewSession } from "@/components/ReviewSession";
import { answerSchema, validateAnswer } from "@/lib/answer-validation";

const mocks = vi.hoisted(() => ({ send: vi.fn(async (_input: unknown) => "ok" as const) }));
vi.mock("@/lib/answer-queue", () => ({ sendAnswer: mocks.send, startAnswerSync: vi.fn() }));
vi.mock("@/lib/study-time", () => ({ notifyAnswer: vi.fn() }));
vi.mock("@/components/GermanAudio", () => ({ GermanAudio: () => null }));
vi.mock("@tanstack/react-router", () => ({ Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a> }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("mixed homework session retries", () => {
  it("sends a comma-free dictation as a correct writing answer for the selected homework", async () => {
    const word = { id: "11111111-1111-4111-8111-111111111111", german: "fahren, er fährt, ist gefahren", french: "aller" };
    const homeworkId = "22222222-2222-4222-8222-222222222222";
    render(<QueryClientProvider client={new QueryClient()}><ReviewSession title="Dictée" pool={[word]}
      items={[{ word, mode: "dictation" }]} homeworkId={homeworkId} onQuit={() => {}} /></QueryClientProvider>);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "fahren er fährt ist gefahren" } });
    fireEvent.click(screen.getByRole("button", { name: "Valider" }));
    await waitFor(() => expect(mocks.send).toHaveBeenCalledTimes(1));
    const input = answerSchema.parse(mocks.send.mock.calls[0]?.[0]);
    expect(input._mode).toBe("typing");
    expect(input._homework).toBe(homeworkId);
    expect(input._correct).toBe(true);
    expect(validateAnswer(word, input).correct).toBe(true);
  });
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