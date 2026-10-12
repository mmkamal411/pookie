-- READABILITY OK: 23 articles, all FK <= 8.0 (body + legal separately)

INSERT INTO public.faq_articles
  (slug, title, body_md, category, keywords, age_band, related_slugs,
   legal_basis, legal_citation, legal_note_md,
   legal_reviewed_at, legal_review_due_at, legal_version, status)
VALUES
  ('health-connect-device', 'How do I connect Apple Health or Google Fit?', 'Your steps, sleep, and workouts can flow into Pookie on their own.

**Fix it**
1. Open the Health tab.
2. Tap Connect, then pick Apple Health on iPhone or Health Connect on Android.
3. Approve the types you want to share, like steps and sleep.
4. Come back tomorrow. The first sync can take up to 24 hours.

**Still stuck?**
Talk to us — we’ll pick up where this article left off. You won’t have to repeat yourself.', 'health',
   ARRAY['connect','apple health','google fit','sync','steps','sleep'], 'all', ARRAY['health-sync-stopped'],
   NULL, NULL, NULL,
   CURRENT_DATE, CURRENT_DATE + INTERVAL '6 months', 1, 'live')
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, body_md = EXCLUDED.body_md,
  category = EXCLUDED.category, keywords = EXCLUDED.keywords,
  age_band = EXCLUDED.age_band, related_slugs = EXCLUDED.related_slugs,
  legal_basis = EXCLUDED.legal_basis, legal_citation = EXCLUDED.legal_citation,
  legal_note_md = EXCLUDED.legal_note_md,
  legal_reviewed_at = EXCLUDED.legal_reviewed_at,
  legal_review_due_at = EXCLUDED.legal_review_due_at,
  status = 'live', updated_at = now();

INSERT INTO public.faq_articles
  (slug, title, body_md, category, keywords, age_band, related_slugs,
   legal_basis, legal_citation, legal_note_md,
   legal_reviewed_at, legal_review_due_at, legal_version, status)
VALUES
  ('health-sync-stopped', 'My health data stopped syncing.', 'When the numbers freeze, the phone link is usually the cause.

**Fix it**
1. Open your phone''s health app and check that Pookie still has access.
2. Open Pookie''s Health tab and pull down to refresh.
3. If you changed your phone password or reinstalled the app, reconnect it.
4. Wait one hour, then check again.

**Still stuck?**
Talk to us — we’ll pick up where this article left off. You won’t have to repeat yourself.', 'health',
   ARRAY['sync stopped','frozen','not updating','health data'], 'all', ARRAY['health-connect-device'],
   NULL, NULL, NULL,
   CURRENT_DATE, CURRENT_DATE + INTERVAL '6 months', 1, 'live')
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, body_md = EXCLUDED.body_md,
  category = EXCLUDED.category, keywords = EXCLUDED.keywords,
  age_band = EXCLUDED.age_band, related_slugs = EXCLUDED.related_slugs,
  legal_basis = EXCLUDED.legal_basis, legal_citation = EXCLUDED.legal_citation,
  legal_note_md = EXCLUDED.legal_note_md,
  legal_reviewed_at = EXCLUDED.legal_reviewed_at,
  legal_review_due_at = EXCLUDED.legal_review_due_at,
  status = 'live', updated_at = now();

INSERT INTO public.faq_articles
  (slug, title, body_md, category, keywords, age_band, related_slugs,
   legal_basis, legal_citation, legal_note_md,
   legal_reviewed_at, legal_review_due_at, legal_version, status)
VALUES
  ('wellbeing-privacy-mood', 'Who can see my mood check-ins?', 'Only you. Your mood check-ins live in a private space.

**The rule**
1. Parents, siblings, and support agents cannot see your mood entries.
2. No one can see totals or trends made from them either.
3. If you ever want to share one, you choose what to share and with whom.

**Still stuck?**
Talk to us — we’ll pick up where this article left off. You won’t have to repeat yourself.', 'health',
   ARRAY['mood','private','privacy','wellbeing','check-in','parents'], 'all', '{}',
   'our_choice', NULL, 'The law doesn''t require this — we do it because a feelings journal only works if it is truly private. Privacy laws set a floor. They say: don''t leak people''s data. They don''t say how little your own staff should see. We chose the strictest workable version. No parent view. No agent view. No totals. No exceptions.',
   CURRENT_DATE, CURRENT_DATE + INTERVAL '6 months', 1, 'live')
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, body_md = EXCLUDED.body_md,
  category = EXCLUDED.category, keywords = EXCLUDED.keywords,
  age_band = EXCLUDED.age_band, related_slugs = EXCLUDED.related_slugs,
  legal_basis = EXCLUDED.legal_basis, legal_citation = EXCLUDED.legal_citation,
  legal_note_md = EXCLUDED.legal_note_md,
  legal_reviewed_at = EXCLUDED.legal_reviewed_at,
  legal_review_due_at = EXCLUDED.legal_review_due_at,
  status = 'live', updated_at = now();

INSERT INTO public.faq_articles
  (slug, title, body_md, category, keywords, age_band, related_slugs,
   legal_basis, legal_citation, legal_note_md,
   legal_reviewed_at, legal_review_due_at, legal_version, status)
VALUES
  ('mail-snap-intake', 'How do I add a piece of physical mail?', 'Snap a photo and Pookie reads the bill for you.

**Fix it**
1. Open the Home tab, then Mail.
2. Tap the camera button and snap the front of the letter.
3. Check what Pookie found: who it is from, the amount, and the due date.
4. Tap Save. Pookie will remind you before it is due.

**Still stuck?**
Talk to us — we’ll pick up where this article left off. You won’t have to repeat yourself.', 'home',
   ARRAY['mail','letter','bill','scan','photo','camera'], 'all', ARRAY['spending-categorization'],
   NULL, NULL, NULL,
   CURRENT_DATE, CURRENT_DATE + INTERVAL '6 months', 1, 'live')
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, body_md = EXCLUDED.body_md,
  category = EXCLUDED.category, keywords = EXCLUDED.keywords,
  age_band = EXCLUDED.age_band, related_slugs = EXCLUDED.related_slugs,
  legal_basis = EXCLUDED.legal_basis, legal_citation = EXCLUDED.legal_citation,
  legal_note_md = EXCLUDED.legal_note_md,
  legal_reviewed_at = EXCLUDED.legal_reviewed_at,
  legal_review_due_at = EXCLUDED.legal_review_due_at,
  status = 'live', updated_at = now();

INSERT INTO public.faq_articles
  (slug, title, body_md, category, keywords, age_band, related_slugs,
   legal_basis, legal_citation, legal_note_md,
   legal_reviewed_at, legal_review_due_at, legal_version, status)
VALUES
  ('spending-categorization', 'How does Pookie sort my spending?', 'Pookie groups each purchase so you can see where your money goes.

**How it works**
1. When a purchase syncs, Pookie guesses the group, like Groceries or Gas.
2. Wrong guess? Tap the purchase and pick the right group. Pookie learns from you.
3. Groups roll up into a monthly view under Home, then Spending.

**Still stuck?**
Talk to us — we’ll pick up where this article left off. You won’t have to repeat yourself.', 'home',
   ARRAY['spending','categories','budget','sort'], 'all', ARRAY['mail-snap-intake'],
   NULL, NULL, NULL,
   CURRENT_DATE, CURRENT_DATE + INTERVAL '6 months', 1, 'live')
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, body_md = EXCLUDED.body_md,
  category = EXCLUDED.category, keywords = EXCLUDED.keywords,
  age_band = EXCLUDED.age_band, related_slugs = EXCLUDED.related_slugs,
  legal_basis = EXCLUDED.legal_basis, legal_citation = EXCLUDED.legal_citation,
  legal_note_md = EXCLUDED.legal_note_md,
  legal_reviewed_at = EXCLUDED.legal_reviewed_at,
  legal_review_due_at = EXCLUDED.legal_review_due_at,
  status = 'live', updated_at = now();

INSERT INTO public.faq_articles
  (slug, title, body_md, category, keywords, age_band, related_slugs,
   legal_basis, legal_citation, legal_note_md,
   legal_reviewed_at, legal_review_due_at, legal_version, status)
VALUES
  ('school-sync-grades', 'How do I connect my school grades?', 'Link your school portal once. Pookie pulls your grades each day after that.

**Fix it**
1. Open the School tab.
2. Tap Connect portal and pick your school system.
3. Sign in with your school login. Pookie keeps it in an encrypted vault.
4. The first pull can take a few minutes. Later pulls run on their own.

**Still stuck?**
Talk to us — we’ll pick up where this article left off. You won’t have to repeat yourself.', 'school',
   ARRAY['grades','school','portal','parentvue','connect','sync'], 'all', ARRAY['grades-stopped-updating'],
   NULL, NULL, NULL,
   CURRENT_DATE, CURRENT_DATE + INTERVAL '6 months', 1, 'live')
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, body_md = EXCLUDED.body_md,
  category = EXCLUDED.category, keywords = EXCLUDED.keywords,
  age_band = EXCLUDED.age_band, related_slugs = EXCLUDED.related_slugs,
  legal_basis = EXCLUDED.legal_basis, legal_citation = EXCLUDED.legal_citation,
  legal_note_md = EXCLUDED.legal_note_md,
  legal_reviewed_at = EXCLUDED.legal_reviewed_at,
  legal_review_due_at = EXCLUDED.legal_review_due_at,
  status = 'live', updated_at = now();

INSERT INTO public.faq_articles
  (slug, title, body_md, category, keywords, age_band, related_slugs,
   legal_basis, legal_citation, legal_note_md,
   legal_reviewed_at, legal_review_due_at, legal_version, status)
VALUES
  ('grades-stopped-updating', 'My grades stopped updating.', 'Grade syncs break most often when a school password changes.

**Fix it**
1. Open the School tab and tap Sync now.
2. If it asks you to sign in again, your school password changed. Enter the new one.
3. Check that your school''s portal itself works. If the portal is down, Pookie has to wait too.
4. Still old after a day? Your school may not have posted new grades yet.

**Still stuck?**
Talk to us — we’ll pick up where this article left off. You won’t have to repeat yourself.', 'school',
   ARRAY['grades','sync','stopped','frozen','not updating','portal'], 'all', ARRAY['school-sync-grades'],
   NULL, NULL, NULL,
   CURRENT_DATE, CURRENT_DATE + INTERVAL '6 months', 1, 'live')
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, body_md = EXCLUDED.body_md,
  category = EXCLUDED.category, keywords = EXCLUDED.keywords,
  age_band = EXCLUDED.age_band, related_slugs = EXCLUDED.related_slugs,
  legal_basis = EXCLUDED.legal_basis, legal_citation = EXCLUDED.legal_citation,
  legal_note_md = EXCLUDED.legal_note_md,
  legal_reviewed_at = EXCLUDED.legal_reviewed_at,
  legal_review_due_at = EXCLUDED.legal_review_due_at,
  status = 'live', updated_at = now();

INSERT INTO public.faq_articles
  (slug, title, body_md, category, keywords, age_band, related_slugs,
   legal_basis, legal_citation, legal_note_md,
   legal_reviewed_at, legal_review_due_at, legal_version, status)
VALUES
  ('school-records-after-revoke', 'My teen removed my access in Pookie. Why can I still see their report card from the school?', 'Those are two different doors. Pookie''s Sharing screen controls what Pookie shares. Your school gives you records directly. Pookie cannot close that door, and it cannot open it either.

What Pookie does do: the moment your teen revokes, Pookie stops sharing the copy of grades inside the app. Right away. But the school''s own parent portal is between you and the school.

**Still stuck?**
Talk to us — we’ll pick up where this article left off. You won’t have to repeat yourself.', 'school',
   ARRAY['revoke','access','ferpa','report card','records','removed'], 'parent', ARRAY['access-model-child-authority'],
   'law_required', 'FERPA — Family Educational Rights and Privacy Act, 20 U.S.C. §1232g', 'FERPA gives parents the right to their child''s school records until the child turns 18. Then the right moves to the student. Your school follows FERPA, not Pookie''s settings. What Pookie can do is stop sharing its own copy of grades the moment your teen revokes — and it does, at once.',
   CURRENT_DATE, CURRENT_DATE + INTERVAL '6 months', 1, 'live')
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, body_md = EXCLUDED.body_md,
  category = EXCLUDED.category, keywords = EXCLUDED.keywords,
  age_band = EXCLUDED.age_band, related_slugs = EXCLUDED.related_slugs,
  legal_basis = EXCLUDED.legal_basis, legal_citation = EXCLUDED.legal_citation,
  legal_note_md = EXCLUDED.legal_note_md,
  legal_reviewed_at = EXCLUDED.legal_reviewed_at,
  legal_review_due_at = EXCLUDED.legal_review_due_at,
  status = 'live', updated_at = now();

INSERT INTO public.faq_articles
  (slug, title, body_md, category, keywords, age_band, related_slugs,
   legal_basis, legal_citation, legal_note_md,
   legal_reviewed_at, legal_review_due_at, legal_version, status)
VALUES
  ('emergency-plan-setup', 'How do I set up our family emergency plan?', 'One plan, and everyone knows it.

**Fix it**
1. Open the Safety tab, then Emergency plan.
2. Add two meeting spots: one near home, one outside your area.
3. Add your out-of-area contact. This is the person everyone calls if local lines fail.
4. Walk through it with your family once. A plan no one has read is not a plan.

**Still stuck?**
Talk to us — we’ll pick up where this article left off. You won’t have to repeat yourself.', 'safety',
   ARRAY['emergency','plan','safety','meeting spot','contact'], 'all', '{}',
   NULL, NULL, NULL,
   CURRENT_DATE, CURRENT_DATE + INTERVAL '6 months', 1, 'live')
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, body_md = EXCLUDED.body_md,
  category = EXCLUDED.category, keywords = EXCLUDED.keywords,
  age_band = EXCLUDED.age_band, related_slugs = EXCLUDED.related_slugs,
  legal_basis = EXCLUDED.legal_basis, legal_citation = EXCLUDED.legal_citation,
  legal_note_md = EXCLUDED.legal_note_md,
  legal_reviewed_at = EXCLUDED.legal_reviewed_at,
  legal_review_due_at = EXCLUDED.legal_review_due_at,
  status = 'live', updated_at = now();

INSERT INTO public.faq_articles
  (slug, title, body_md, category, keywords, age_band, related_slugs,
   legal_basis, legal_citation, legal_note_md,
   legal_reviewed_at, legal_review_due_at, legal_version, status)
VALUES
  ('screen-time-limits', 'How do I set screen time limits?', 'Set the hours once. Pookie keeps the rhythm.

**Fix it**
1. Open the Safety tab, then Screen time.
2. Pick your child''s profile.
3. Set bedtime hours and any school-day limits.
4. Talk with your child about the why. Limits work best when they are not a surprise.

**Still stuck?**
Talk to us — we’ll pick up where this article left off. You won’t have to repeat yourself.', 'safety',
   ARRAY['screen time','limits','bedtime','parental controls'], 'parent', '{}',
   NULL, NULL, NULL,
   CURRENT_DATE, CURRENT_DATE + INTERVAL '6 months', 1, 'live')
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, body_md = EXCLUDED.body_md,
  category = EXCLUDED.category, keywords = EXCLUDED.keywords,
  age_band = EXCLUDED.age_band, related_slugs = EXCLUDED.related_slugs,
  legal_basis = EXCLUDED.legal_basis, legal_citation = EXCLUDED.legal_citation,
  legal_note_md = EXCLUDED.legal_note_md,
  legal_reviewed_at = EXCLUDED.legal_reviewed_at,
  legal_review_due_at = EXCLUDED.legal_review_due_at,
  status = 'live', updated_at = now();

INSERT INTO public.faq_articles
  (slug, title, body_md, category, keywords, age_band, related_slugs,
   legal_basis, legal_citation, legal_note_md,
   legal_reviewed_at, legal_review_due_at, legal_version, status)
VALUES
  ('flights-booking-basics', 'How do I book a flight in Pookie?', 'Search, pick, and pay — with one firm rule about who can pay.

**Fix it**
1. Open the Travel tab, then Flights.
2. Enter where from, where to, and your dates.
3. Compare the ranked results. Fees and bags are shown up front.
4. The person paying must be 18 or older. A teen can plan the whole trip, but an adult completes the purchase.

**Still stuck?**
Talk to us — we’ll pick up where this article left off. You won’t have to repeat yourself.', 'travel',
   ARRAY['flights','book','tickets','travel','18'], 'all', ARRAY['rental-cars-age-rules'],
   'both', 'Contract law (minor capacity doctrines, state law) + Pookie policy', 'The law part: in most states, people under 18 cannot enter binding contracts, and airlines require an adult as the purchaser of record. Our choice on top of it: we enforce this in the software itself. A teen account cannot complete any purchase or booking flow, not just flights. Planning is open to all. Paying is 18+.',
   CURRENT_DATE, CURRENT_DATE + INTERVAL '6 months', 1, 'live')
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, body_md = EXCLUDED.body_md,
  category = EXCLUDED.category, keywords = EXCLUDED.keywords,
  age_band = EXCLUDED.age_band, related_slugs = EXCLUDED.related_slugs,
  legal_basis = EXCLUDED.legal_basis, legal_citation = EXCLUDED.legal_citation,
  legal_note_md = EXCLUDED.legal_note_md,
  legal_reviewed_at = EXCLUDED.legal_reviewed_at,
  legal_review_due_at = EXCLUDED.legal_review_due_at,
  status = 'live', updated_at = now();

INSERT INTO public.faq_articles
  (slug, title, body_md, category, keywords, age_band, related_slugs,
   legal_basis, legal_citation, legal_note_md,
   legal_reviewed_at, legal_review_due_at, legal_version, status)
VALUES
  ('rental-cars-age-rules', 'Why can''t I see rental cars?', 'If you are under 18, the rental car section stays hidden. This is on purpose.

**How it works**
1. Rental companies set minimum ages, often 21 or 25, and add young-driver fees.
2. Since no teen can complete a rental, Pookie hides the whole section from teen accounts. We show nothing you cannot use.
3. Adults see ranked totals with young-driver fees folded in where they apply.

**Still stuck?**
Talk to us — we’ll pick up where this article left off. You won’t have to repeat yourself.', 'travel',
   ARRAY['rental car','hidden','age','21','25'], 'all', ARRAY['flights-booking-basics'],
   'both', 'State rental-age rules + rental company policy + Pookie policy', 'The law and company part: states and rental companies set minimum ages and fees. Those are their rules, not ours. Our choice: instead of showing teens prices they can never pay, we hide the section at the API layer. No teasing, no dead ends.',
   CURRENT_DATE, CURRENT_DATE + INTERVAL '6 months', 1, 'live')
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, body_md = EXCLUDED.body_md,
  category = EXCLUDED.category, keywords = EXCLUDED.keywords,
  age_band = EXCLUDED.age_band, related_slugs = EXCLUDED.related_slugs,
  legal_basis = EXCLUDED.legal_basis, legal_citation = EXCLUDED.legal_citation,
  legal_note_md = EXCLUDED.legal_note_md,
  legal_reviewed_at = EXCLUDED.legal_reviewed_at,
  legal_review_due_at = EXCLUDED.legal_review_due_at,
  status = 'live', updated_at = now();

INSERT INTO public.faq_articles
  (slug, title, body_md, category, keywords, age_band, related_slugs,
   legal_basis, legal_citation, legal_note_md,
   legal_reviewed_at, legal_review_due_at, legal_version, status)
VALUES
  ('babysitters-find-book', 'How do I find and book a babysitter?', 'Vetted sitters near you, booked in a few taps.

**Fix it**
1. Open the Marketplace tab, then Babysitters.
2. Enter the date, time, and your kids'' ages.
3. Read profiles: experience, rates, and background-check status.
4. Tap Book and confirm. You will get a reminder before the sit.

**Still stuck?**
Talk to us — we’ll pick up where this article left off. You won’t have to repeat yourself.', 'marketplace',
   ARRAY['babysitter','sitter','book','childcare'], 'all', '{}',
   NULL, NULL, NULL,
   CURRENT_DATE, CURRENT_DATE + INTERVAL '6 months', 1, 'live')
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, body_md = EXCLUDED.body_md,
  category = EXCLUDED.category, keywords = EXCLUDED.keywords,
  age_band = EXCLUDED.age_band, related_slugs = EXCLUDED.related_slugs,
  legal_basis = EXCLUDED.legal_basis, legal_citation = EXCLUDED.legal_citation,
  legal_note_md = EXCLUDED.legal_note_md,
  legal_reviewed_at = EXCLUDED.legal_reviewed_at,
  legal_review_due_at = EXCLUDED.legal_review_due_at,
  status = 'live', updated_at = now();

INSERT INTO public.faq_articles
  (slug, title, body_md, category, keywords, age_band, related_slugs,
   legal_basis, legal_citation, legal_note_md,
   legal_reviewed_at, legal_review_due_at, legal_version, status)
VALUES
  ('driving-school-hours', 'How do I log my driving practice hours?', 'Georgia counts your practice. Log every drive and watch the bar fill.

**Fix it**
1. Open the Marketplace tab, then Driving School.
2. After each drive, tap Log hours.
3. Enter the date, total minutes, night minutes, and who rode with you.
4. Georgia''s Joshua''s Law needs 40 hours with 6 at night before your Class D test. Pookie tracks your progress.

**Still stuck?**
Talk to us — we’ll pick up where this article left off. You won’t have to repeat yourself.', 'marketplace',
   ARRAY['driving','hours','log','joshua''s law','permit','practice'], 'teen', '{}',
   NULL, NULL, NULL,
   CURRENT_DATE, CURRENT_DATE + INTERVAL '6 months', 1, 'live')
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, body_md = EXCLUDED.body_md,
  category = EXCLUDED.category, keywords = EXCLUDED.keywords,
  age_band = EXCLUDED.age_band, related_slugs = EXCLUDED.related_slugs,
  legal_basis = EXCLUDED.legal_basis, legal_citation = EXCLUDED.legal_citation,
  legal_note_md = EXCLUDED.legal_note_md,
  legal_reviewed_at = EXCLUDED.legal_reviewed_at,
  legal_review_due_at = EXCLUDED.legal_review_due_at,
  status = 'live', updated_at = now();

INSERT INTO public.faq_articles
  (slug, title, body_md, category, keywords, age_band, related_slugs,
   legal_basis, legal_citation, legal_note_md,
   legal_reviewed_at, legal_review_due_at, legal_version, status)
VALUES
  ('help-center-how-to', 'How do I use the Help Center?', 'Answers first, humans when you need them.

**Fix it**
1. Open the Support tab. This Help Center is step one.
2. Search or browse the nine sections. Every feature has a how-to and a fix-it article.
3. Tap the question mark on any hard screen to jump straight to the right article.
4. Not finding it? The AI chat and tickets are one tap away.

**Still stuck?**
Talk to us — we’ll pick up where this article left off. You won’t have to repeat yourself.', 'support',
   ARRAY['help','faq','support','how to'], 'all', ARRAY['ai-support-chat-how-to','tickets-open-track'],
   NULL, NULL, NULL,
   CURRENT_DATE, CURRENT_DATE + INTERVAL '6 months', 1, 'live')
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, body_md = EXCLUDED.body_md,
  category = EXCLUDED.category, keywords = EXCLUDED.keywords,
  age_band = EXCLUDED.age_band, related_slugs = EXCLUDED.related_slugs,
  legal_basis = EXCLUDED.legal_basis, legal_citation = EXCLUDED.legal_citation,
  legal_note_md = EXCLUDED.legal_note_md,
  legal_reviewed_at = EXCLUDED.legal_reviewed_at,
  legal_review_due_at = EXCLUDED.legal_review_due_at,
  status = 'live', updated_at = now();

INSERT INTO public.faq_articles
  (slug, title, body_md, category, keywords, age_band, related_slugs,
   legal_basis, legal_citation, legal_note_md,
   legal_reviewed_at, legal_review_due_at, legal_version, status)
VALUES
  ('ai-support-chat-how-to', 'What can the AI support chat do?', 'It fixes common problems fast, and hands you to a human the moment it should.

**What it can do**
1. Walk you through features and fix common problems, any time of day.
2. It cannot see your private data: not grades, not health, not check-ins.
3. It cannot delete or export your account. Those need a human.
4. Say "human" at any point. A person takes over with your full chat attached.

**Still stuck?**
Talk to us — we’ll pick up where this article left off. You won’t have to repeat yourself.', 'support',
   ARRAY['ai','chat','assistant','human','bot'], 'all', ARRAY['help-center-how-to','tickets-open-track'],
   'our_choice', NULL, 'The law doesn''t require this — we do it because you should never have to guess whether you are talking to a person or a machine. The chat says it is AI in the header, on first run, and any time it hands you off. No dark patterns, no fake typing dots pretending to be human.',
   CURRENT_DATE, CURRENT_DATE + INTERVAL '6 months', 1, 'live')
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, body_md = EXCLUDED.body_md,
  category = EXCLUDED.category, keywords = EXCLUDED.keywords,
  age_band = EXCLUDED.age_band, related_slugs = EXCLUDED.related_slugs,
  legal_basis = EXCLUDED.legal_basis, legal_citation = EXCLUDED.legal_citation,
  legal_note_md = EXCLUDED.legal_note_md,
  legal_reviewed_at = EXCLUDED.legal_reviewed_at,
  legal_review_due_at = EXCLUDED.legal_review_due_at,
  status = 'live', updated_at = now();

INSERT INTO public.faq_articles
  (slug, title, body_md, category, keywords, age_band, related_slugs,
   legal_basis, legal_citation, legal_note_md,
   legal_reviewed_at, legal_review_due_at, legal_version, status)
VALUES
  ('tickets-open-track', 'How do I open and track a support ticket?', 'A ticket is how a human on our team takes your problem.

**Fix it**
1. Open the Support tab, then Tickets.
2. Tap New ticket. Pick the topic, write what is wrong, and send.
3. You get a ticket number right away. It looks like PK-2026-0042.
4. We reply within our promise time. You confirm the fix before we close it. Nothing closes without your say.

**Still stuck?**
Talk to us — we’ll pick up where this article left off. You won’t have to repeat yourself.', 'support',
   ARRAY['ticket','support','human','agent','track','status'], 'all', ARRAY['help-center-how-to','ai-support-chat-how-to'],
   NULL, NULL, NULL,
   CURRENT_DATE, CURRENT_DATE + INTERVAL '6 months', 1, 'live')
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, body_md = EXCLUDED.body_md,
  category = EXCLUDED.category, keywords = EXCLUDED.keywords,
  age_band = EXCLUDED.age_band, related_slugs = EXCLUDED.related_slugs,
  legal_basis = EXCLUDED.legal_basis, legal_citation = EXCLUDED.legal_citation,
  legal_note_md = EXCLUDED.legal_note_md,
  legal_reviewed_at = EXCLUDED.legal_reviewed_at,
  legal_review_due_at = EXCLUDED.legal_review_due_at,
  status = 'live', updated_at = now();

INSERT INTO public.faq_articles
  (slug, title, body_md, category, keywords, age_band, related_slugs,
   legal_basis, legal_citation, legal_note_md,
   legal_reviewed_at, legal_review_due_at, legal_version, status)
VALUES
  ('support-data-access-permissions', 'Why does a support agent need my permission to look at my grades?', 'Because we decided support should work with almost nothing.

**How it works**
1. An agent sees your ticket and your words — not your gradebook.
2. If they need the real grades to fix it, they ask. You tap approve in the app.
3. Their access ends on its own after 24 hours.
4. Every look is logged. See the log in Settings, then Privacy, then Support access.

**Still stuck?**
Talk to us — we’ll pick up where this article left off. You won’t have to repeat yourself.', 'support',
   ARRAY['permission','grades','agent','privacy','access','grant'], 'all', ARRAY['tickets-open-track'],
   'our_choice', NULL, 'The law doesn''t require this — we do it because it''s the right shape for a family app. Privacy laws set a floor. They say: don''t leak people''s data. They don''t say how little your own staff should see. We chose the strictest workable version. Support agents are the least-privileged people in our system who can still fix your problem.',
   CURRENT_DATE, CURRENT_DATE + INTERVAL '6 months', 1, 'live')
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, body_md = EXCLUDED.body_md,
  category = EXCLUDED.category, keywords = EXCLUDED.keywords,
  age_band = EXCLUDED.age_band, related_slugs = EXCLUDED.related_slugs,
  legal_basis = EXCLUDED.legal_basis, legal_citation = EXCLUDED.legal_citation,
  legal_note_md = EXCLUDED.legal_note_md,
  legal_reviewed_at = EXCLUDED.legal_reviewed_at,
  legal_review_due_at = EXCLUDED.legal_review_due_at,
  status = 'live', updated_at = now();

INSERT INTO public.faq_articles
  (slug, title, body_md, category, keywords, age_band, related_slugs,
   legal_basis, legal_citation, legal_note_md,
   legal_reviewed_at, legal_review_due_at, legal_version, status)
VALUES
  ('signup-onboarding', 'How do I sign up and add my family?', 'Thirty seconds to your own Pookie.

**Fix it**
1. Sign in with your email. No invite needed.
2. Tell us your name. Add children if you have them, or pick just me.
3. Adding a child? Pick email invite or a 6-digit code they enter.
4. Your dashboard is ready. Add school, health, and the rest when you like.

**Still stuck?**
Talk to us — we’ll pick up where this article left off. You won’t have to repeat yourself.', 'account',
   ARRAY['sign up','onboarding','account','family','children','just me'], 'all', '{}',
   NULL, NULL, NULL,
   CURRENT_DATE, CURRENT_DATE + INTERVAL '6 months', 1, 'live')
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, body_md = EXCLUDED.body_md,
  category = EXCLUDED.category, keywords = EXCLUDED.keywords,
  age_band = EXCLUDED.age_band, related_slugs = EXCLUDED.related_slugs,
  legal_basis = EXCLUDED.legal_basis, legal_citation = EXCLUDED.legal_citation,
  legal_note_md = EXCLUDED.legal_note_md,
  legal_reviewed_at = EXCLUDED.legal_reviewed_at,
  legal_review_due_at = EXCLUDED.legal_review_due_at,
  status = 'live', updated_at = now();

INSERT INTO public.faq_articles
  (slug, title, body_md, category, keywords, age_band, related_slugs,
   legal_basis, legal_citation, legal_note_md,
   legal_reviewed_at, legal_review_due_at, legal_version, status)
VALUES
  ('data-retention-what-we-keep', 'What data does Pookie keep, and for how long?', 'We keep what we need, for as short as we can.

**The schedule**
1. Open tickets live until they close. Closed tickets are deleted after 2 years.
2. AI chat transcripts are deleted after 13 months. Teens can delete their own sooner.
3. Ticket attachments are deleted 90 days after the ticket closes.
4. Support permission grants are kept 3 years, as proof of who looked at what.
5. The full schedule lives in Settings, then Privacy, then Data retention.

**Still stuck?**
Talk to us — we’ll pick up where this article left off. You won’t have to repeat yourself.', 'account',
   ARRAY['retention','delete','data','how long','privacy'], 'all', '{}',
   'law_required', 'COPPA — Children''s Online Privacy Protection Act, FTC Rule (2025 update): data minimization', 'COPPA says apps must keep kids'' data only as long as needed for the purpose it was collected, then delete it. That is the legal reason behind every line above. Our choice on top: we apply the same short clocks to adult data too, because a family app should not hoard anyone''s history.',
   CURRENT_DATE, CURRENT_DATE + INTERVAL '6 months', 1, 'live')
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, body_md = EXCLUDED.body_md,
  category = EXCLUDED.category, keywords = EXCLUDED.keywords,
  age_band = EXCLUDED.age_band, related_slugs = EXCLUDED.related_slugs,
  legal_basis = EXCLUDED.legal_basis, legal_citation = EXCLUDED.legal_citation,
  legal_note_md = EXCLUDED.legal_note_md,
  legal_reviewed_at = EXCLUDED.legal_reviewed_at,
  legal_review_due_at = EXCLUDED.legal_review_due_at,
  status = 'live', updated_at = now();

INSERT INTO public.faq_articles
  (slug, title, body_md, category, keywords, age_band, related_slugs,
   legal_basis, legal_citation, legal_note_md,
   legal_reviewed_at, legal_review_due_at, legal_version, status)
VALUES
  ('access-model-child-authority', 'Who decides who can see my child''s stuff?', 'Your child does — once they are 13 or older.

**How it works**
1. At 13, your child becomes the access authority in Pookie.
2. A grant your child makes cannot be vetoed or undone by a parent. Only your child can change it.
3. One parent cannot block the other parent''s access that the child granted.
4. A court order is the one exception. It goes through manual review by our team, never an automatic switch.

**Still stuck?**
Talk to us — we’ll pick up where this article left off. You won’t have to repeat yourself.', 'legal',
   ARRAY['access','authority','sharing','grant','veto','child'], 'all', ARRAY['age-tiers-logins','school-records-after-revoke'],
   'both', 'State contract/consent doctrines + court-order process + Pookie policy', 'The law part: courts can order access changes, and we must have a way to honor that. Our choice on top of it: inside the family, the teen''s word is final. No parent veto, no silent overrides. If we ever loosen this, we will tell you first.',
   CURRENT_DATE, CURRENT_DATE + INTERVAL '6 months', 1, 'live')
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, body_md = EXCLUDED.body_md,
  category = EXCLUDED.category, keywords = EXCLUDED.keywords,
  age_band = EXCLUDED.age_band, related_slugs = EXCLUDED.related_slugs,
  legal_basis = EXCLUDED.legal_basis, legal_citation = EXCLUDED.legal_citation,
  legal_note_md = EXCLUDED.legal_note_md,
  legal_reviewed_at = EXCLUDED.legal_reviewed_at,
  legal_review_due_at = EXCLUDED.legal_review_due_at,
  status = 'live', updated_at = now();

INSERT INTO public.faq_articles
  (slug, title, body_md, category, keywords, age_band, related_slugs,
   legal_basis, legal_citation, legal_note_md,
   legal_reviewed_at, legal_review_due_at, legal_version, status)
VALUES
  ('age-tiers-logins', 'Why can''t my 11-year-old have their own Pookie login?', 'Kids under 13 get a parent-managed profile instead. You run it from your account. No login, no password, and no chat for them. We know it is less fun for them. Here is why it has to be this way.

**Still stuck?**
Talk to us — we’ll pick up where this article left off. You won’t have to repeat yourself.', 'legal',
   ARRAY['coppa','under 13','login','child account','kids'], 'parent', ARRAY['access-model-child-authority','go-independent-trusted-adult'],
   'law_required', 'COPPA — Children''s Online Privacy Protection Act, FTC Rule (2025 update)', 'COPPA says apps cannot collect personal facts from kids under 13 without verified parent consent, and cannot keep kids'' data longer than needed. Breaking it means FTC fines and court orders. Companies have paid millions. So we made a design choice the law forces: under-13s don''t get logins at all. That way we never collect anything from your child directly, and the rule is enforced by the software itself, not by a promise.',
   CURRENT_DATE, CURRENT_DATE + INTERVAL '6 months', 1, 'live')
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, body_md = EXCLUDED.body_md,
  category = EXCLUDED.category, keywords = EXCLUDED.keywords,
  age_band = EXCLUDED.age_band, related_slugs = EXCLUDED.related_slugs,
  legal_basis = EXCLUDED.legal_basis, legal_citation = EXCLUDED.legal_citation,
  legal_note_md = EXCLUDED.legal_note_md,
  legal_reviewed_at = EXCLUDED.legal_reviewed_at,
  legal_review_due_at = EXCLUDED.legal_review_due_at,
  status = 'live', updated_at = now();

INSERT INTO public.faq_articles
  (slug, title, body_md, category, keywords, age_band, related_slugs,
   legal_basis, legal_citation, legal_note_md,
   legal_reviewed_at, legal_review_due_at, legal_version, status)
VALUES
  ('go-independent-trusted-adult', 'Why do I have to name a trusted adult before going independent?', 'Going independent is a big step — your own Pookie, fully yours. This part takes one minute.

**How it works**
1. Name one adult you trust. It does not have to be a parent.
2. You can change it any time.
3. You can also decline — after you check a box showing you know what "no adult will be told" means.

**Still stuck?**
Talk to us — we’ll pick up where this article left off. You won’t have to repeat yourself.', 'legal',
   ARRAY['independent','trusted adult','18','go independent'], 'teen', ARRAY['access-model-child-authority','age-tiers-logins'],
   'both', 'Duty of care (state tort doctrines re: services to minors) + Pookie policy', 'The law part: companies that serve teens have a duty of care. If a young person is in crisis, we need some way to get help to them. That is the legal reason behind the trusted-adult step. Our choice on top of it: you pick the adult, and you may decline — but only after you show you grasp what that means. No dark patterns, no guilt screens.',
   CURRENT_DATE, CURRENT_DATE + INTERVAL '6 months', 1, 'live')
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, body_md = EXCLUDED.body_md,
  category = EXCLUDED.category, keywords = EXCLUDED.keywords,
  age_band = EXCLUDED.age_band, related_slugs = EXCLUDED.related_slugs,
  legal_basis = EXCLUDED.legal_basis, legal_citation = EXCLUDED.legal_citation,
  legal_note_md = EXCLUDED.legal_note_md,
  legal_reviewed_at = EXCLUDED.legal_reviewed_at,
  legal_review_due_at = EXCLUDED.legal_review_due_at,
  status = 'live', updated_at = now();

