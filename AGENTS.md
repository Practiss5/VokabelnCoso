<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->
- Spaced repetition is tracked per skill (skill_progress: recognition/translation/writing/context) via the `record_answer` RPC only; word_progress is a derived summary. Why: a QCM success must not mark a word mastered for writing.
- Homework completion = ≥80% of list words answered correctly in choice/typing/context AND ≥60% in typing/context, between assignment and deadline, computed client-side by homeworkStatus from reviews; streak = consecutive days with ≥DAILY_GOAL answers via computeStreak. Why: no extra writes; reuses record_answer data.
- Teacher list folders: list_folders table (teacher-owned, RLS) + nullable vocab_lists.folder_id (ON DELETE SET NULL). Why: deleting a folder must never delete lists.
