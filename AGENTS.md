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
- Homework completion is computed client-side by homeworkStatus from reviews between assignment and deadline: homeworks.word_ids (NULL = whole list) and homeworks.requirements (mode → rate; each chosen mode counts only its own correct answers); NULL requirements = legacy rule (80% choice-or-above + 60% writing). Streak = consecutive days with ≥DAILY_GOAL answers via computeStreak. Why: no extra writes; reuses record_answer data; old homework keeps its rule.
- Teacher list folders: list_folders table (teacher-owned, RLS) + nullable vocab_lists.folder_id (ON DELETE SET NULL); sharing = copy_folder(share_code) security-definer RPC that deep-copies folder, lists and words to the caller. Why: deleting a folder never deletes lists; colleagues edit their own copy without reading others’ data.
- Written answers (typing & cloze) are validated by `isWrittenCorrect`: spaces never matter (extra/doubled/missing) and dead keys ¨ / " count as ä/ö/ü via `normalizeAnswer`; the article is still required. Speaking keeps `isAnswerCorrect` (spaces matter, punctuation stripped). Why: mobile keyboards add stray spaces; dead-key layouts type trémas as ¨ or ".
- Match game (Cartes à relier): scores stored in match_games via record_match RPC only, never via record_answer; pairs feed streak/daily count but not skill_progress or homework. Why: game is for fun and must not mark words as learned.
- Passwordless code login: students sign in with an 8-char code from public.student_codes + a 6-digit PIN, teachers with a username; both map to synthetic emails (s-<code>@eleve.vokabeln.local, t-<user>@prof.vokabeln.local, see src/lib/student-code.ts) with auto-confirm email enabled and HIBP off. Codes are created by generate_student_codes, linked in handle_new_user, checked pre-login by anon-callable check_student_code; annual reset = purge_class_data. Why: zero personal data (no e-mails) for students and teachers; never require real emails for new accounts.
- Student PIN login goes through the studentLogin server function (src/lib/student-login.functions.ts), which enforces lockouts from student_login_attempts (service-role only) via src/lib/login-lock.ts before returning a session. Why: brute-force protection must be server-side.
- Homework time: silent client timer (src/lib/study-time.ts, pauses when tab hidden or 60 s idle) adds seconds via add_homework_time RPC (≤120 s per call, own class only) into homework_time; only the homework's teacher can read it, students never see it. Why: teacher-only effort metric without trusting large client values.
