"""Cobb County adapter: StudentVUE + Office 365 sweeps.

Ported from the battle-tested ``dawson-windows-sync.py`` (2026-10-10 working
version) — every parser fix and hard-won lesson carried over verbatim:
  - SSO login flow with diagnostics (Microsoft Conditional Access requires
    the approved laptop — error 53003 in the sandbox, works on the laptops)
  - Chromium self-heal install on launch failure (Lesson: Windows Playwright
    needs ``chromium_headless_shell`` — installed explicitly, see below)
  - week-section parser + separate-lines date format + frame search for the
    class-detail iframe + "Show Done = All" filter + modal-close logic
  - parser-degradation alert (<10 assignments across 6 classes)

What changed vs the old script: Supabase writes and the sync queue now live
in ``pookie_sync.queue`` / ``pipeline.py`` against the new multi-tenant
project. This module only sweeps portals and returns plain dicts.
"""

import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

from ..config import cfg_get

# Settable by the entry point: log files, debug HTML and screenshots live
# next to the platform wrapper script (or wherever the installer points).
LOG_DIR = Path(__file__).resolve().parent.parent

# Optional per-run hook: pipeline.py installs a function that forwards
# notable lines to the job's Supabase log (sync_append_log). Kept None-safe
# so the adapter also works standalone.
_queue_logger = None


def set_log_dir(path):
    global LOG_DIR
    LOG_DIR = Path(path)


def set_queue_logger(fn):
    global _queue_logger
    _queue_logger = fn


def _qlog(msg, level="info"):
    try:
        if _queue_logger:
            _queue_logger(msg, level)
    except Exception:
        pass


def log(msg, level="info"):
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"  [{ts}] [{level}] {msg}"
    print(line, flush=True)
    try:
        with open(LOG_DIR / "sync.log", "a", encoding="utf-8") as f:
            f.write(line + "\n")
    except Exception:
        pass

# ---------------------------------------------------------------- config ---
def _launch_browser(p, cfg=None, sid=None):
    """Launch Chromium headless with anti-detection settings.

    Self-healing: if the Playwright browser build is missing (version drift,
    profile mismatch, cache wiped), install it once and retry instead of
    failing every scheduled run. The install respects PLAYWRIGHT_BROWSERS_PATH
    when set (shared machine path recommended since the Task Scheduler jobs
    run as SYSTEM but installs run as the installing user).
    """
    headless = True
    if cfg is not None:
        headless = bool(cfg.get("headless", True))
    launch_kwargs = dict(
        headless=headless,
        args=[
            "--disable-blink-features=AutomationControlled",
            "--disable-dev-shm-usage",
            "--no-sandbox",
        ],
    )
    try:
        return p.chromium.launch(**launch_kwargs)
    except Exception as e:
        msg = str(e).lower()
        if "executable" not in msg and "browser" not in msg:
            raise
        note = f"Chromium build missing — installing once then retrying: {e}"
        if cfg is not None:
            try:
                _qlog(note, level="err")
            except Exception:
                pass
        else:
            print(f"  [err] {note}", flush=True)
        import subprocess
        want = ["chromium"]
        # Lesson 2026-10-10: Windows Playwright headless runs need the
        # headless shell build explicitly — plain `chromium` is not enough.
        if cfg is None or bool(cfg.get("headless", True)):
            want.append("chromium-headless-shell")
        for pkg in want:
            r = subprocess.run(
                [sys.executable, "-m", "playwright", "install", pkg],
                capture_output=True, text=True, timeout=900)
            if r.returncode != 0:
                raise RuntimeError(
                    f"playwright install {pkg} failed: {r.stderr[-500:]}") from e
        if cfg is not None:
            try:
                _qlog("Chromium installed — retrying launch.", level="info")
            except Exception:
                pass
        return p.chromium.launch(**launch_kwargs)

# ------------------------------------------------------- StudentVUE ---
def _sso_login(page, cfg, sid, account_label="school"):
    """Handle Microsoft SSO login. Returns True if we end up past SSO."""
    page.wait_for_timeout(3000)
    url = page.url.lower()
    if "login.microsoftonline.com" not in url and "login.microsoft.com" not in url:
        return True  # Not on SSO page

    student_name = cfg_get(cfg, "student_name", default="the student")
    log(f"Signing in with {student_name}'s {account_label} account…")
    try:
        # Email step — wait for field with better diagnostics
        email_field = page.locator('input[type="email"]')
        try:
            email_field.wait_for(timeout=15000)
        except Exception:
            # Email field didn't appear — check what we're actually seeing
            body_preview = ""
            try:
                body_preview = page.inner_text("body")[:500]
            except Exception:
                pass
            log(f"SSO: email field not found. URL: {page.url[:100]}", "warn")
            log(f"SSO: page preview: {body_preview[:200]}", "warn")
            try:
                page.screenshot(path=str(LOG_DIR / "sso-debug.png"))
                log("SSO: screenshot saved as sso-debug.png", "warn")
            except Exception:
                pass
            # Check if we're actually already past SSO (sometimes the URL lags)
            if "studentvue" in page.url.lower() or "dashboard" in page.url.lower():
                log("SSO: URL suggests we're already logged in, continuing.", "warn")
                return True
            raise RuntimeError(
                "SSO login page didn't show email field. "
                "Screenshot saved as sso-debug.png. "
                "The Microsoft login page may have changed or failed to load."
            )
        email_field.fill(cfg_get(cfg, "student_email", "school_email"))
        page.wait_for_timeout(1000)
        # Click Next / Sign in
        for sel in ['input[type="submit"]', 'button:has-text("Next")', 'button:has-text("Sign in")']:
            if page.locator(sel).count() > 0:
                page.locator(sel).first.click()
                break
        page.wait_for_timeout(3000)

        # Password step — type character by character to trigger JS events
        pw_field = page.locator('input[type="password"]')
        pw_field.wait_for(timeout=15000)
        pw_field.click()
        # The password is NEVER in config on disk — pipeline.py injects it
        # transiently (memory only) as cfg["_student_password"] from the OS
        # keychain / Pookie vault. The cfg fallback keeps old configs working.
        _pw = cfg.get("_student_password") or cfg_get(cfg, "student_password", "school_password")
        pw_field.press_sequentially(_pw, delay=50)
        page.wait_for_timeout(1500)

        # Click Sign in
        signed_in = False
        for sel in ['button:has-text("Sign in")', 'input[type="submit"]', 'button[type="submit"]']:
            try:
                if page.locator(sel).count() > 0:
                    page.locator(sel).first.click()
                    signed_in = True
                    break
            except Exception:
                continue
        if not signed_in:
            pw_field.press("Enter")

        page.wait_for_timeout(5000)

        # "Stay signed in?" prompt
        try:
            for sel in ['input[type="submit"][value="Yes"]', 'button:has-text("Yes")']:
                if page.locator(sel).count() > 0:
                    page.locator(sel).first.click()
                    page.wait_for_timeout(3000)
                    break
        except Exception:
            pass

        # Check if we're past SSO
        page.wait_for_timeout(3000)
        url = page.url.lower()
        if "login.microsoftonline.com" in url or "login.microsoft.com" in url:
            # Check for error message
            body = page.inner_text("body")[:2000]
            if "incorrect" in body.lower() or "error" in body.lower():
                page.screenshot(path=str(LOG_DIR / "sync-error.png"))
                raise RuntimeError(
                    "Microsoft rejected the credentials. "
                    "Screenshot saved as sync-error.png."
                )
            return False
        return True
    except RuntimeError:
        raise
    except Exception as e:
        page.screenshot(path=str(LOG_DIR / "sync-error.png"))
        raise RuntimeError(f"SSO login failed: {e}")

def sweep_studentvue(cfg, sid):
    """Pull gradebook data from StudentVUE with Playwright."""
    from playwright.sync_api import sync_playwright

    log("Opening StudentVUE…")
    grades = []
    gpa_info = {}
    past_periods = []
    synergy_mail = []
    due_next = []

    with sync_playwright() as p:
        browser = _launch_browser(p, cfg, sid)
        ctx = browser.new_context(
            viewport={"width": 1366, "height": 900},
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0 Safari/537.36"
            ),
        )
        page = ctx.new_page()
        try:
            base_url = cfg["studentvue_base_url"].rstrip("/")
            login_path = cfg["studentvue_login_path"]
            sso_url = cfg.get("synergy_sso_url", "")
            browser_timeout = cfg["browser_timeout"]
            # Derive the domain for the "are we in StudentVUE" check
            sv_domain = re.sub(r'^https?://', '', base_url).split('/')[0]

            # --- Preferred: go straight to the district SSO portal ---
            # (synergy_sso_url is the most reliable entry point — it skips
            #  the landing pages and goes directly to Microsoft SSO)
            if sso_url:
                log("Going directly to the SSO portal…")
                page.goto(sso_url, timeout=browser_timeout)
                page.wait_for_timeout(4000)
            else:
                page.goto(base_url + "/", timeout=browser_timeout)
                page.wait_for_timeout(3000)

                # --- District landing page ---
                body = page.inner_text("body")[:500] if page.locator("body").count() else ""
                if "I am a student" in body or "I am a parent" in body:
                    log("On district landing page — clicking 'I am a student'…")
                    page.locator('a:has-text("I am a student")').first.click()
                    page.wait_for_timeout(4000)

                # --- Student login page: click "Go To Synergy" for SAML SSO ---
                body2 = page.inner_text("body")[:1000] if page.locator("body").count() else ""
                if "Go To Synergy" in body2 or "StudentVUE Account Access" in body2:
                    log("Clicking 'Go To Synergy' for SSO…")
                    page.locator('a:has-text("Go To Synergy")').first.click()
                    page.wait_for_timeout(5000)
                elif login_path and login_path not in page.url:
                    # Direct login path configured — navigate there
                    page.goto(base_url + login_path, timeout=browser_timeout)
                    page.wait_for_timeout(4000)

            # --- Microsoft SSO ---
            if not _sso_login(page, cfg, sid, "school"):
                page.screenshot(path=str(LOG_DIR / "sync-error.png"))
                raise RuntimeError(
                    f"Did not land on StudentVUE (at {page.url}). "
                    "Screenshot saved as sync-error.png."
                )

            page.wait_for_timeout(5000)

            # Verify we're actually in StudentVUE
            body_check = page.inner_text("body")[:1000] if page.locator("body").count() else ""
            on_landing = "I am a student" in body_check
            on_sso = "microsoftonline.com" in page.url or "microsoft.com" in page.url
            if sv_domain not in page.url or on_landing or on_sso:
                page.screenshot(path=str(LOG_DIR / "sync-error.png"))
                raise RuntimeError(
                    f"Did not land on StudentVUE (at {page.url}). "
                    "Screenshot saved as sync-error.png."
                )

            log("Signed in — reading gradebook…")

            # --- Grade Book page ---
            gb_paths = cfg.get("studentvue_gradebook_paths") or ["/PXP2_GradeBook.aspx?AGU=0"]
            for gb_path in gb_paths:
                try:
                    page.goto(base_url + gb_path, timeout=45000)
                    page.wait_for_timeout(5000)
                    if len(page.content()) > 5000:
                        break
                except Exception:
                    continue

            html = page.content()
            (LOG_DIR / "sync-debug.html").write_text(html, encoding="utf-8")

            grades, due_next, gpa_info = parse_gradebook(html, page, cfg)
            log(f"Found {len(grades)} classes, {len(due_next)} upcoming items.")

            # --- Per-class assignment drilldown ---
            # Click into each class to scrape assignment-level detail
            class_details = []
            try:
                class_details = pull_class_details(page, cfg, grades)
                log(f"Pulled details for {len(class_details)} classes.")
                # Parser degradation alert (2026-10-10): if we got all 6 classes
                # but almost no assignments, the week-section parser regressed.
                # A healthy sync yields 40-100 assignments; <10 is a red flag.
                total_assignments = sum(len(c.get("assignments", [])) for c in class_details if isinstance(c, dict))
                if len(class_details) == 6 and total_assignments < 10:
                    warn_msg = (f"PARSER DEGRADATION: only {total_assignments} assignments "
                                f"across 6 classes (expected 40+) — week-section parser may have regressed")
                    log(f"[error] {warn_msg}", "err")
                    _qlog(warn_msg, "err")
            except Exception as e:
                log(f"Class details drilldown failed: {e}", "warn")

            # --- Past grading periods ---
            try:
                past_periods = parse_past_periods(page)
                log(f"Found {len(past_periods)} past grading periods.")
            except Exception as e:
                log(f"Past periods parse failed: {e}", "warn")

            # --- Synergy mail (in-portal messages) ---
            try:
                synergy_mail = parse_synergy_mail(page, cfg)
                log(f"Found {len(synergy_mail)} Synergy mail messages.")
            except Exception as e:
                log(f"Synergy mail parse failed: {e}", "warn")

        finally:
            browser.close()

    return {
        "grades": grades,
        "due_next": due_next,
        "gpa": gpa_info,
        "past_periods": past_periods,
        "synergy_mail": synergy_mail,
        "class_details": class_details,
    }

# ------------------------------------------------------- CTLS Learn ---
def sweep_ctls_learn(cfg, sid):
    """Pull syllabus links from CTLS Learn (Cobb's LMS).

    Navigates to CTLS Learn via Microsoft SSO, lists the student's courses,
    and for each course looks for syllabus documents/links. Returns a dict
    mapping class name -> syllabus info. Failures are logged but never
    break the main sync.
    """
    from playwright.sync_api import sync_playwright

    ctls_url = cfg_get(cfg, "ctls_learn_url", default="https://ctlslearn.cobbk12.org")
    syllabi = {}
    log("Opening CTLS Learn…")

    with sync_playwright() as p:
        browser = _launch_browser(p, cfg, sid)
        ctx = browser.new_context(
            viewport={"width": 1366, "height": 900},
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0 Safari/537.36"
            ),
        )
        page = ctx.new_page()
        try:
            page.goto(ctls_url, timeout=cfg["browser_timeout"], wait_until="domcontentloaded")
            page.wait_for_timeout(3000)

            # SSO login (same Microsoft school account)
            if not _sso_login(page, cfg, sid, account_label="CTLS Learn"):
                log("CTLS Learn SSO login did not complete.", "warn")
                return {}

            page.wait_for_timeout(5000)
            log(f"CTLS Learn landed on: {page.url[:120]}")

            # --- Wait for the Angular SPA to render ---
            # studentportal.educationincites.com uses hash routing (#/Dashboard)
            try:
                page.wait_for_load_state("networkidle", timeout=20000)
            except Exception:
                pass
            page.wait_for_timeout(5000)

            # --- Find course links ---
            # Try Angular-specific selectors first, then generic fallbacks
            course_links = []
            selectors = [
                # Angular SPA course cards/tiles
                '[ng-repeat] a', '.course-card', '.course-tile',
                'md-card a', '.dashboard-course a',
                # Generic: any link with course-like text
                'a',
            ]
            for sel in selectors:
                try:
                    els = page.locator(sel).all()
                    for el in els:
                        try:
                            text = (el.inner_text() or "").strip()
                            href = el.get_attribute("href") or ""
                            # Course links typically contain class names
                            # EXCLUDE document/resource links (templates, essays, etc.)
                            text_lower = text.lower()
                            # Skip if it looks like a document/resource, not a course
                            if any(skip in text_lower for skip in [
                                "template", "essay", "worksheet", "handout",
                                "assignment", "quiz", "test", ".pdf", ".doc",
                            ]):
                                continue
                            if any(kw in text_lower for kw in [
                                "computer science", "environmental science",
                                "chinese", "government", "geometry",
                                "literature", "composition",
                            ]):
                                # Must look like a course name, not a document title
                                # Course names are short; document titles are long
                                if len(text) < 60:
                                    course_links.append({
                                        "text": text[:80],
                                        "href": href,
                                        "element": el,
                                    })
                        except Exception:
                            continue
                    if course_links:
                        log(f"Found {len(course_links)} course links with selector '{sel}'.")
                        break
                except Exception:
                    continue

            if not course_links:
                # Debug: dump all link texts to the log for tuning
                try:
                    all_links = page.locator("a").all()
                    link_texts = []
                    for el in all_links[:40]:
                        try:
                            t = (el.inner_text() or "").strip()[:60]
                            if t:
                                link_texts.append(t)
                        except Exception:
                            continue
                    log(f"DEBUG: first {len(link_texts)} link texts: {link_texts}")
                except Exception as e:
                    log(f"DEBUG link dump failed: {e}", "warn")

            # Dedupe by text
            seen = set()
            courses = []
            for c in course_links:
                key = c["text"].lower()
                if key not in seen:
                    seen.add(key)
                    courses.append(c)
            log(f"Found {len(courses)} courses on CTLS Learn dashboard.")

            # --- Visit each course, hunt for syllabus ---
            for course in courses[:12]:  # safety cap
                cname = course["text"]
                try:
                    el = course.get("element")
                    if el:
                        el.click(timeout=10000)
                    elif course["href"]:
                        page.goto(course["href"], timeout=cfg["browser_timeout"], wait_until="domcontentloaded")
                    else:
                        continue
                    try:
                        page.wait_for_load_state("networkidle", timeout=15000)
                    except Exception:
                        pass
                    page.wait_for_timeout(4000)

                    # Look for syllabus links (case-insensitive)
                    found = None
                    for sel in [
                        'a:has-text("syllabus")', 'a:has-text("Syllabus")',
                        'a:has-text("SYLLABUS")',
                    ]:
                        try:
                            els = page.locator(sel).all()
                            for el in els:
                                href = el.get_attribute("href") or ""
                                text = (el.inner_text() or "").strip()[:100]
                                if href:
                                    found = {"text": text, "url": href}
                                    break
                            if found:
                                break
                        except Exception:
                            continue

                    # Also check for document links that might be syllabi
                    if not found:
                        try:
                            body_text = page.inner_text("body").lower()
                            if "syllabus" in body_text:
                                log(f"  '{cname}': 'syllabus' mentioned but no direct link found.")
                        except Exception:
                            pass

                    if found:
                        syllabi[cname] = found
                        log(f"  '{cname}': syllabus → {found['url'][:100]}")
                    else:
                        log(f"  '{cname}': no syllabus link found.")

                    # Go back to dashboard for next course
                    page.goto(ctls_url, timeout=cfg["browser_timeout"], wait_until="domcontentloaded")
                    try:
                        page.wait_for_load_state("networkidle", timeout=15000)
                    except Exception:
                        pass
                    page.wait_for_timeout(3000)

                except Exception as e:
                    log(f"  '{cname}': error — {e}", "warn")

        except Exception as e:
            log(f"CTLS Learn sweep failed: {e}", "warn")
        finally:
            browser.close()

    log(f"CTLS Learn: found syllabi for {len(syllabi)} courses.")
    return syllabi

def pull_class_details(page, cfg, grades):
    """Drill into each class on StudentVUE to scrape assignment-level detail.

    For each class: clicks the class name/row, scrapes the assignment table
    (title, category, date, score, max points, %), plus category weights.
    Returns a list of dicts: {class, grade, period, categories, assignments}.
    """
    details = []
    base_url = cfg["studentvue_base_url"].rstrip("/")
    gb_paths = cfg.get("studentvue_gradebook_paths") or ["/PXP2_GradeBook.aspx?AGU=0"]
    gb_url = base_url + gb_paths[0]

    for g in grades:
        cls_name = g.get("class", "")
        if not cls_name:
            continue
        try:
            # Navigate back to gradebook for each class (fresh state)
            page.goto(gb_url, timeout=45000)
            page.wait_for_timeout(4000)

            # Find and click the class link — try multiple selectors
            # NOTE: StudentVUE renders class names as <button> elements, not <a>
            clicked = False
            # Escape regex special chars in class name for the text matcher
            safe = re.escape(cls_name[:20])
            for sel in [
                f'button:has-text("{cls_name}")',
                f'a:has-text("{cls_name}")',
                f'tr:has-text("{cls_name}") button',
                f'tr:has-text("{cls_name}") a',
                f'td:has-text("{cls_name}")',
            ]:
                try:
                    loc = page.locator(sel).first
                    if loc.count() > 0:
                        # If it's a link, click it; otherwise click the row
                        loc.click(timeout=10000)
                        page.wait_for_timeout(5000)
                        clicked = True
                        break
                except Exception:
                    continue

            if not clicked:
                log(f"  Could not open detail for {cls_name}", "warn")
                continue

            # Check if we landed on a detail page (URL changed or content differs)
            detail_url = page.url

            # --- Close any assignment-detail popup/modal ---
            # StudentVUE sometimes opens a single-assignment "Assignment Details"
            # popup instead of (or on top of) the assignment list. Close it so we
            # parse the real list underneath.
            try:
                for _ in range(3):
                    closed_any = False
                    # Common modal close selectors
                    for sel in [
                        'button:has-text("Close")',
                        '[aria-label="Close"]',
                        '.modal-close',
                        '.ui-dialog-titlebar-close',
                        'button.close',
                    ]:
                        try:
                            btn = page.locator(sel).first
                            if btn.count() > 0 and btn.is_visible():
                                btn.click(timeout=3000)
                                closed_any = True
                                page.wait_for_timeout(1500)
                                break
                        except Exception:
                            continue
                    # ESC key as fallback
                    if not closed_any:
                        try:
                            page.keyboard.press("Escape")
                            page.wait_for_timeout(1000)
                        except Exception:
                            pass
                        break
                    page.wait_for_timeout(1000)
            except Exception:
                pass

            # Get body text from the frame that actually has the assignment content.
            # StudentVUE loads class detail in an iframe; page.inner_text("body")
            # only sees the outer page. Search all frames for week headers.
            def get_detail_body():
                # Try main page first
                try:
                    if page.locator("body").count():
                        t = page.inner_text("body")
                        if "Week " in t and "through" in t:
                            return t, page
                except Exception:
                    pass
                # Search all frames for the assignment content
                for frame in page.frames:
                    try:
                        if frame.locator("body").count():
                            t = frame.inner_text("body")
                            if "Week " in t and "through" in t:
                                return t, frame
                    except Exception:
                        continue
                # Fallback: main page body even without week headers
                try:
                    if page.locator("body").count():
                        return page.inner_text("body"), page
                except Exception:
                    pass
                return "", page

            body, detail_frame = get_detail_body()

            # Scrape class detail: missing/upcoming counts, then all assignments
            assignments = []
            categories = {}
            missing_count = 0
            upcoming_count = 0
            try:
                # --- Missing / Upcoming counts from the top cards ---
                # Look for "Missing Assignments" and "Upcoming Assignments" with numbers
                missing_m = re.search(r'(\d+)\s*\n?\s*Missing Assignments', body)
                if missing_m:
                    missing_count = int(missing_m.group(1))
                upcoming_m = re.search(r'(\d+)\s*\n?\s*Upcoming Assignments', body)
                if upcoming_m:
                    upcoming_count = int(upcoming_m.group(1))

                # --- Click "All" in Show Done filter to reveal graded assignments ---
                # The filter defaults to "Not Done" — we need "All" to see everything.
                try:
                    # Radio buttons: Done | Not Done | All — click the "All" label
                    all_label = detail_frame.locator('label:has-text("All")').first
                    if all_label.count() > 0 and all_label.is_visible():
                        all_label.click(timeout=5000)
                        page.wait_for_timeout(3000)
                    else:
                        # Fallback: click radio input directly via JS
                        detail_frame.evaluate("""() => {
                            const labels = Array.from(document.querySelectorAll('label'));
                            for (const l of labels) {
                                if (l.textContent.trim() === 'All') { l.click(); return true; }
                            }
                            const radios = Array.from(document.querySelectorAll('input[type="radio"]'));
                            for (const r of radios) {
                                const lbl = r.closest('label') || document.querySelector(`label[for="${r.id}"]`);
                                if (lbl && lbl.textContent.trim() === 'All') { r.click(); return true; }
                            }
                            return false;
                        }""")
                        page.wait_for_timeout(3000)
                    body, detail_frame = get_detail_body()
                    # Verify the filter changed
                    if "16 total items" not in body and "total items" in body:
                        log(f"  {cls_name}: Show Done filter may not have switched to All", "warn")
                except Exception as e:
                    log(f"  {cls_name}: Show Done filter click failed: {e}", "warn")

                # --- Expand all week sections ---
                try:
                    # Week headers are collapsible blue bars — click any collapsed ones
                    # Use Playwright's get_by_text (normalized whitespace, matches across split spans)
                    import re as _re
                    headers = detail_frame.get_by_text(_re.compile(r'Week\s+\d+\s*-'))
                    n = headers.count()
                    for i in range(n):
                        h = headers.nth(i)
                        try:
                            if h.get_attribute('aria-expanded') == 'false':
                                h.click(timeout=3000)
                        except Exception:
                            pass
                        # Also try closest clickable ancestor
                        try:
                            clickable = h.locator('xpath=ancestor::button[1] | ancestor::*[@role="button"][1] | ancestor::a[1]')
                            if clickable.count() > 0 and clickable.first.get_attribute('aria-expanded') == 'false':
                                clickable.first.click(timeout=3000)
                        except Exception:
                            pass
                    page.wait_for_timeout(2000)
                    body, detail_frame = get_detail_body()
                except Exception:
                    pass

                # --- Parse assignment CARDS (timeline layout) ---
                # StudentVUE class detail uses cards, not tables. Each card has:
                #   Date badge (e.g. "AUG 10"), Name (bold), "Type | X.XX points",
                #   Score (large), Percentage (e.g. "65.0%")
                # Count week sections via Python regex on rendered text (single source of truth)
                try:
                    week_hits = re.findall(r'Week\s*\d+\s*-\s*[\d/]+\s*through\s*[\d/]+', body, re.I)
                    log(f"  {cls_name}: found {len(week_hits)} week sections (text scan)", "info")
                except Exception:
                    pass

                # Card-based text parsing: assignments appear as blocks like:
                #   AUG 10
                #   Unit 1A HW
                #   Homework | 0.50 points
                #   100
                #   100.0%
                try:
                    lines = [l.strip() for l in body.split('\n')]
                    lines = [l for l in lines if l]  # drop empties
                    current_week = ""
                    i = 0
                    while i < len(lines):
                        line = lines[i]
                        # Track week sections
                        week_m = re.match(r'Week\s*\d+\s*-\s*([\d/]+)\s*through\s*([\d/]+)(?:\s*\((\d+)\s*items?\))?', line)
                        if week_m:
                            current_week = f"{week_m.group(1)}-{week_m.group(2)}"
                            i += 1
                            continue
                        # Date badge: e.g. "AUG 10", "SEP 15", "OCT 06"
                        # ALSO handles separate-lines format: "AUG" on one line, "12" on next
                        date_m = re.match(r'^(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s+(\d{1,2})$', line, re.I)
                        # Check for separate-lines format: current line is just month, next line is just day
                        separate_date_m = None
                        if not date_m and i + 5 < len(lines):
                            month_only = re.match(r'^(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)$', line, re.I)
                            day_only = re.match(r'^(\d{1,2})$', lines[i+1])
                            if month_only and day_only:
                                # Shift indices: name is at i+2, type at i+3, score at i+4, pct at i+5
                                separate_date_m = (month_only.group(1), day_only.group(1))
                        if (date_m and i + 4 < len(lines)) or separate_date_m:
                            # Next lines: Name, "Type | X points", Score, Percent
                            # For separate-lines format, indices are shifted by 1
                            offset = 1 if separate_date_m else 0
                            name = lines[i+1+offset]
                            type_pts = lines[i+2+offset]
                            score_s = lines[i+3+offset]
                            pct_s = lines[i+4+offset]
                            # Validate: type line has "|", pct line has "%"
                            if '|' in type_pts and '%' in pct_s:
                                tp_m = re.match(r'(.+?)\s*\|\s*([\d.]+)\s*points?', type_pts, re.I)
                                pct_m = re.search(r'([\d.]+)\s*%', pct_s)
                                # Skip if name looks like a header/UI element
                                if name and len(name) > 1 and 'Week' not in name and 'total items' not in name.lower():
                                    cat = tp_m.group(1).strip() if tp_m else "Unknown"
                                    max_pts = float(tp_m.group(2)) if tp_m else None
                                    try:
                                        score = float(score_s) if score_s and score_s not in ('', '-') else None
                                    except ValueError:
                                        score = None
                                    pct = float(pct_m.group(1)) if pct_m else None
                                    # Get date string from either format
                                    if separate_date_m:
                                        date_str = f"{separate_date_m[0].upper()} {separate_date_m[1]}"
                                    else:
                                        date_str = f"{date_m.group(1).upper()} {date_m.group(2)}"
                                    # Avoid duplicates
                                    if not any(a.get("title") == name and a.get("week") == current_week for a in assignments):
                                        assignments.append({
                                            "title": name,
                                            "category": cat,
                                            "week": current_week,
                                            "date": date_str,
                                            "score": score,
                                            "max_points": max_pts,
                                            "percent": pct,
                                        })
                            i += 5 + offset
                            continue
                        i += 1
                except Exception as e:
                    log(f"  {cls_name}: card parsing error: {e}", "warn")

                # --- DEBUG: Log page structure when no assignments found ---
                # This helps diagnose parsing issues
                if "Week" not in body and "Assignment" not in body:
                    log(f"  DEBUG {cls_name}: page has no 'Week' or 'Assignment' text. URL: {detail_url[:80]}", "warn")
                    # Save screenshot for inspection
                    try:
                        safe_name = re.sub(r'[^a-zA-Z0-9]', '_', cls_name)[:20]
                        page.screenshot(path=str(LOG_DIR / f"class-detail-{safe_name}.png"))
                        log(f"  DEBUG {cls_name}: screenshot saved as class-detail-{safe_name}.png", "warn")
                    except Exception:
                        pass

                # --- Scrape assignment rows ---
                # StudentVUE shows assignments with: date, [Category] Title, category | points, score, %
                # Example: "AUG 12 [Quiz] Quiz 1.1  Quiz | 1.00 points  46  46.00%"
                # FALLBACK: Also try parsing HTML tables directly
                try:
                    # Try table-based parsing as fallback
                    tables = detail_frame.locator("table").all()
                    for table in tables[:5]:
                        try:
                            rows = table.locator("tr").all()
                            for row in rows[1:]:  # Skip header
                                try:
                                    cells = row.locator("td").all()
                                    if len(cells) >= 3:
                                        cell_texts = [c.inner_text().strip() for c in cells]
                                        # Look for rows with assignment-like data
                                        # (title, score, percentage)
                                        if any("%" in t for t in cell_texts):
                                            title = cell_texts[0][:120] if cell_texts[0] else ""
                                            if title and len(title) > 2 and "Week" not in title:
                                                # Avoid duplicates
                                                if not any(a.get("title") == title for a in assignments):
                                                    # Try to extract score/percent
                                                    pct = None
                                                    score = None
                                                    max_pts = None
                                                    for t in cell_texts:
                                                        pct_m = re.search(r'(\d{1,3}(?:\.\d{1,2})?)\s*%', t)
                                                        if pct_m and pct is None:
                                                            pct = float(pct_m.group(1))
                                                    assignments.append({
                                                        "title": title,
                                                        "category": "Uncategorized",
                                                        "week": current_week,
                                                        "date": "",
                                                        "score": score,
                                                        "max_points": max_pts,
                                                        "percent": pct,
                                                    })
                                except Exception:
                                    continue
                        except Exception:
                            continue
                except Exception:
                    pass

                body_lines = body.split('\n')
                current_week = ""
                i = 0
                while i < len(body_lines):
                    line = body_lines[i].strip()

                    # Track week sections
                    week_m = re.match(r'Week\s*\d+\s*-\s*([\d/]+)\s*through\s*([\d/]+)(?:\s*\((\d+)\s*items?\))?', line)
                    if week_m:
                        current_week = f"{week_m.group(1)}-{week_m.group(2)}"
                        i += 1
                        continue

                    # Assignment pattern: [Category] Title
                    assign_m = re.match(r'\[(\w+)\]\s*(.+)', line)
                    if assign_m:
                        cat = assign_m.group(1)
                        title = assign_m.group(2).strip()

                        # Next lines contain: category | points, then score and %
                        # Look ahead for score pattern
                        score = None
                        max_pts = None
                        pct = None
                        date_str = ""
                        j = i + 1
                        # Check next few lines for details
                        for k in range(j, min(j + 5, len(body_lines))):
                            dl = body_lines[k].strip()
                            # Date pattern: "AUG 12" (previous line) or "8/12/2026"
                            if re.match(r'^(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s+\d{1,2}$', dl, re.IGNORECASE):
                                date_str = dl
                            # Points: "Quiz | 1.00 points"
                            pts_m = re.search(r'(\d+(?:\.\d+)?)\s*points?', dl)
                            if pts_m:
                                max_pts = float(pts_m.group(1))
                            # Score and %: "46" and "46.00%" on separate lines or same
                            pct_m = re.search(r'(\d{1,3}(?:\.\d{1,2})?)\s*%', dl)
                            if pct_m and pct is None:
                                pct = float(pct_m.group(1))
                            # Bare number could be score (if we have max_pts)
                            if max_pts and score is None:
                                num_m = re.match(r'^(\d+(?:\.\d+)?)$', dl)
                                if num_m:
                                    score = float(num_m.group(1))

                        # Also check previous line for date (handles both formats)
                        if i > 0:
                            prev = body_lines[i-1].strip()
                            # Format 1: "AUG 12" on one line
                            if re.match(r'^(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s+\d{1,2}$', prev, re.IGNORECASE):
                                date_str = prev
                            # Format 2: separate lines - prev is day number, i-2 is month
                            elif re.match(r'^\d{1,2}$', prev) and i > 1:
                                month_line = body_lines[i-2].strip()
                                if re.match(r'^(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)$', month_line, re.IGNORECASE):
                                    date_str = f"{month_line.upper()} {prev}"

                        if title and len(title) > 1:
                            # Dedup: skip if primary parser already captured this (titles may differ by bracket prefix)
                            if not any(title in a.get("title","") or a.get("title","") in title or a.get("title","").endswith(title) for a in assignments):
                                assignments.append({
                                    "title": title[:120],
                                    "category": cat,
                                    "week": current_week,
                                    "date": date_str,
                                    "score": score,
                                    "max_points": max_pts,
                                    "percent": pct,
                                })
                    i += 1

                # Scrape category weights (e.g. "Tests 40%")
                for m in re.finditer(r'([A-Za-z][A-Za-z\s&]+?)\s*[:\-]?\s*(\d{1,3})\s*%', body):
                    cat_name = m.group(1).strip()
                    weight = int(m.group(2))
                    if 5 <= weight <= 60 and len(cat_name) < 40:
                        if cat_name.lower() not in [a.get("title","").lower() for a in assignments]:
                            categories[cat_name] = weight

            except Exception as e:
                log(f"  Assignment scrape failed for {cls_name}: {e}", "warn")

            details.append({
                "class": cls_name,
                "grade": g.get("grade"),
                "period": g.get("period", ""),
                "missing_count": missing_count,
                "upcoming_count": upcoming_count,
                "categories": categories,
                "assignments": assignments,
                "assignment_count": len(assignments),
            })
            log(f"  {cls_name}: {len(assignments)} assignments, {missing_count} missing, {upcoming_count} upcoming")

        except Exception as e:
            log(f"  Detail drilldown failed for {cls_name}: {e}", "warn")
            continue

    return details

def parse_gradebook(html, page, cfg=None):
    """Extract classes, grades, assignments, GPA from the gradebook page.

    Uses class_name_patterns from config to match only known classes.
    Falls back to generic matching if no patterns configured.
    """
    grades = []
    due_next = []
    gpa_info = {}
    patterns = (cfg.get("class_name_patterns") if cfg else None) or []

    def _matches_known(name):
        """Check if a name matches any configured class pattern."""
        if not patterns:
            return True  # No filter configured — accept all
        for pat in patterns:
            if re.search(pat, name, re.IGNORECASE):
                return True
        return False

    def _clean_name(raw):
        """Clean up a raw class name string."""
        # Remove common prefixes/suffixes
        name = re.sub(r'^(H|AP|IB)\s+', '', raw.strip())
        name = re.sub(r'\s+', ' ', name)
        return name[:60].strip()

    if page:
        try:
            # Strategy 1: DOM — find elements containing known class names,
            # then look for the NEAREST percentage (not just any in parent)
            body_text = page.inner_text("body") or ""

            for pat in patterns:
                try:
                    # Find ALL elements containing this class name, pick the most
                    # specific one (shortest text = leaf element, not a container)
                    candidates = page.locator(f'text=/{pat}/i').all()
                    if not candidates:
                        continue

                    best_loc = None
                    best_len = float('inf')
                    for c in candidates[:20]:
                        try:
                            t = c.inner_text()
                            # Must contain the pattern and be reasonably short
                            # (a leaf element with just the class name, not a page section)
                            if re.search(pat, t, re.IGNORECASE) and len(t) < best_len and len(t) < 200:
                                best_len = len(t)
                                best_loc = c
                        except Exception:
                            continue

                    if not best_loc:
                        continue
                    loc = best_loc

                    # The grade is likely in a SIBLING element, not the parent.
                    # Get the parent, then check each child for a grade-like percentage
                    # (excluding category weights which appear near "Category"/"Weight" text)
                    found_pct = None
                    found_period = ""
                    try:
                        parent = loc.locator("xpath=..")
                        if parent.count() > 0:
                            # Get all children of the parent
                            children = parent.locator("xpath=*").all()
                            for child in children[:20]:
                                try:
                                    ctext = child.inner_text()
                                    # Skip if this child contains the class name itself
                                    if re.search(pat, ctext, re.IGNORECASE):
                                        continue
                                    # Skip category/weight labels
                                    if re.search(r'categor|weight', ctext, re.IGNORECASE):
                                        continue
                                    pct_m = re.search(r'(\d{1,3}(?:\.\d{1,2})?)\s*%', ctext)
                                    if pct_m:
                                        pct = float(pct_m.group(1))
                                        if 50 <= pct <= 110:  # Grades are 50-110, weights are 5-40
                                            found_pct = pct
                                            break
                                except Exception:
                                    continue

                            # Fallback: check parent text but exclude category weights
                            if found_pct is None:
                                ptext = parent.inner_text()
                                # Remove category weight patterns like "Final 10%" or "Category 15%"
                                ptext_clean = re.sub(r'(?i)(categor\w*|weight|final|quiz|test|lab|project)[^.]{0,30}?\d{1,2}\s*%', '', ptext)
                                pct_matches = re.findall(r'(\d{1,3}(?:\.\d{1,2})?)\s*%', ptext_clean)
                                for pct_str in reversed(pct_matches):
                                    pct = float(pct_str)
                                    if 50 <= pct <= 110:
                                        found_pct = pct
                                        break

                            if found_pct is not None:
                                period_m = re.search(r'(?:[Pp]eriod|[Pp]d\.?)\s*(\d)', parent.inner_text())
                                if period_m:
                                    found_period = period_m.group(1)
                    except Exception as e:
                        log(f"  Sibling grade search failed: {e}", "warn")

                    if found_pct is not None:
                        name_m = re.search(pat, body_text, re.IGNORECASE)
                        raw_name = name_m.group(0) if name_m else pat
                        clean = _clean_name(raw_name)
                        if clean.lower() not in [g['class'].lower() for g in grades]:
                            grades.append({
                                "class": clean,
                                "grade": round(found_pct, 1),
                                "period": found_period,
                            })
                            log(f"Matched {clean}: {found_pct}%")
                except Exception:
                    continue

            # Strategy 2: If pattern matching found too few, try generic row scan
            # but ONLY accept names matching known patterns
            if len(grades) < 2 and patterns:
                for selector in ["tr", ".course", "[class*='course']", "[class*='grade']"]:
                    try:
                        rows = page.locator(selector).all()
                        for row in rows[:50]:
                            try:
                                text = row.inner_text()
                                if not _matches_known(text):
                                    continue
                                pct_m = re.search(r'(\d{1,3}(?:\.\d{1,2})?)\s*%', text)
                                if pct_m:
                                    pct = float(pct_m.group(1))
                                    if 0 <= pct <= 110:
                                        # Find which pattern matched to get clean name
                                        for pat in patterns:
                                            m = re.search(pat, text, re.IGNORECASE)
                                            if m:
                                                clean = _clean_name(m.group(0))
                                                if clean.lower() not in [g['class'].lower() for g in grades]:
                                                    period_m = re.search(r'[Pp]eriod\s*(\d)', text)
                                                    grades.append({
                                                        "class": clean,
                                                        "grade": round(pct, 1),
                                                        "period": period_m.group(1) if period_m else "",
                                                    })
                                                break
                            except Exception:
                                continue
                        if len(grades) >= len(patterns):
                            break
                    except Exception:
                        continue
        except Exception as e:
            log(f"Gradebook DOM parse issue: {e}", "warn")

    # Strategy 3: Regex fallback on raw HTML (only for known patterns)
    if len(grades) < 2 and patterns:
        seen = set(g['class'].lower() for g in grades)
        for pat in patterns:
            # Look for pattern followed by a percentage within 500 chars
            regex = f'(?P<name>{pat}[A-Za-z0-9 &\\-]{{0,30}}?)\\s*.{{0,500}}?(?P<grade>\\d{{1,3}}(?:\\.\\d{{1,2}})?)\\s*%'
            for m in re.finditer(regex, html[:500000], re.IGNORECASE | re.DOTALL):
                try:
                    clean = _clean_name(m.group("name"))
                    if len(clean) < 3 or clean.lower() in seen:
                        continue
                    pct = float(m.group("grade"))
                    if 0 <= pct <= 110:
                        grades.append({"class": clean, "grade": round(pct, 1), "period": ""})
                        seen.add(clean.lower())
                        break  # One match per pattern is enough
                except (ValueError, IndexError):
                    continue

    # GPA extraction
    try:
        body_text = page.inner_text("body") if page else ""
        for label, pat in [
            ("weighted_gpa", r'[Ww]eighted\s*GPA[:\s]*(\d+\.\d+)'),
            ("unweighted_gpa", r'[Uu]nweighted\s*GPA[:\s]*(\d+\.\d+)'),
            ("cumulative_gpa", r'[Cc]umulative\s*GPA[:\s]*(\d+\.\d+)'),
        ]:
            m = re.search(pat, body_text)
            if m:
                gpa_info[label] = float(m.group(1))
    except Exception:
        pass

    # Due-next / upcoming assignments
    try:
        body_text = page.inner_text("body") if page else ""
        # Look for assignment rows with due dates
        for m in re.finditer(
            r'(?P<name>[A-Za-z][A-Za-z0-9 &\-]{3,50}?)\s*'
            r'(?:[Dd]ue[:\s]*)?(?P<date>\d{1,2}/\d{1,2}(?:/\d{2,4})?)',
            body_text[:100000]
        ):
            name = m.group("name").strip()
            if len(name) > 5 and "grade" not in name.lower():
                due_next.append({"assignment": name, "due": m.group("date")})
                if len(due_next) >= 20:
                    break
    except Exception:
        pass

    return grades, due_next, gpa_info

def parse_past_periods(page):
    """Extract grades from past grading periods."""
    periods = []
    try:
        # Look for grading period selector
        for sel in ['select[name*="period"]', 'select[name*="grading"]', '[id*="period"]']:
            if page.locator(sel).count() > 0:
                options = page.locator(f"{sel} option").all()
                for opt in options:
                    try:
                        text = opt.inner_text().strip()
                        val = opt.get_attribute("value")
                        if text and val:
                            periods.append({"period": text, "value": val})
                    except Exception:
                        continue
                break
    except Exception:
        pass
    return periods

def parse_synergy_mail(page, cfg):
    """Extract in-portal Synergy mail messages with full bodies."""
    messages = []
    try:
        base_url = cfg["studentvue_base_url"].rstrip("/")
        mail_paths = cfg.get("studentvue_messages_paths") or ["/PXP2_Messages.aspx?AGU=0"]
        # Navigate to the mail/messages page
        for mail_path in mail_paths:
            try:
                page.goto(base_url + mail_path, timeout=30000)
                page.wait_for_timeout(4000)
                body = page.inner_text("body")
                if "message" in body.lower() or "inbox" in body.lower():
                    # Extract message rows and click into each for full content
                    rows = page.locator("table tr").all()[:15]
                    for row in rows:
                        try:
                            text = row.inner_text().strip()
                            if len(text) < 20 or "subject" in text.lower():
                                continue
                            preview = text[:200]
                            subject = text.split('\n')[0][:120] if '\n' in text else text[:120]

                            # Try to click for full body
                            body_text = ""
                            try:
                                row.click(timeout=5000)
                                page.wait_for_timeout(3000)
                                full = page.inner_text("body")
                                if len(full) > len(text) + 100:
                                    body_text = full[:3000]
                                page.keyboard.press("Escape")
                                page.wait_for_timeout(1500)
                            except Exception:
                                pass

                            messages.append({
                                "subject": subject,
                                "preview": preview,
                                "body": body_text or preview,
                                "source": "synergy",
                            })
                        except Exception:
                            continue
                    break
            except Exception:
                continue
    except Exception:
        pass
    return messages

# ------------------------------------------------------- Office 365 ---
def sweep_office365(cfg, sid):
    """Pull teacher communications from Office 365 Outlook."""
    from playwright.sync_api import sync_playwright

    log("Opening Office 365 Outlook…")
    emails = []

    with sync_playwright() as p:
        browser = _launch_browser(p, cfg, sid)
        ctx = browser.new_context(
            viewport={"width": 1366, "height": 900},
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0 Safari/537.36"
            ),
        )
        page = ctx.new_page()
        try:
            outlook_url = cfg.get("outlook_url") or "https://outlook.office365.com/"
            teacher_domain = cfg.get("teacher_email_domain") or ""
            page.goto(outlook_url, timeout=cfg["browser_timeout"])
            page.wait_for_timeout(4000)

            if not _sso_login(page, cfg, sid, "Office 365"):
                log("Office 365 login did not complete", "warn")
                return []

            log("Signed into Outlook — reading teacher emails…")
            page.wait_for_timeout(8000)  # Let inbox fully load

            # Make sure we're on the mail view, not Copilot or another app
            try:
                current_url = page.url.lower()
                if "outlook" not in current_url or "copilot" in current_url:
                    log("Not on Outlook mail view — navigating to inbox…")
                    page.goto("https://outlook.office365.com/mail/", timeout=30000)
                    page.wait_for_timeout(8000)
                # Also try clicking the Mail icon if we're in the app launcher
                for mail_sel in ['a[aria-label*="Mail"]', 'button[aria-label*="Mail"]', 'a[title*="Mail"]']:
                    try:
                        if page.locator(mail_sel).count() > 0:
                            page.locator(mail_sel).first.click()
                            page.wait_for_timeout(5000)
                            break
                    except Exception:
                        continue
            except Exception as e:
                log(f"Inbox navigation: {e}", "warn")

            # Search for teacher emails (by school domain)
            try:
                # Try multiple search box selectors (Outlook web varies)
                search = None
                for sel in [
                    'input[aria-label*="Search"]',
                    'input[placeholder*="Search"]',
                    '[role="search"] input',
                    'input[type="search"]',
                ]:
                    try:
                        loc = page.locator(sel).first
                        if loc.count() > 0 and loc.is_visible():
                            search = loc
                            break
                    except Exception:
                        continue

                if search:
                    search.click()
                    page.wait_for_timeout(1000)
                    query = f"from:{teacher_domain}" if teacher_domain else ""
                    if query:
                        search.press_sequentially(query, delay=30)
                        page.wait_for_timeout(500)
                        search.press("Enter")
                        page.wait_for_timeout(8000)  # Wait for search results
                        log(f"Searched for: {query}")
                else:
                    log("No search box found — reading inbox directly", "warn")

                # Extract email rows — try multiple selectors for Outlook variants
                email_selectors = [
                    '[role="row"]',
                    '.ms-DetailsRow',
                    '[data-testid="message-row"]',
                    'div[role="option"]',
                    '.lvHighlightSubjectClass',
                ]
                found_rows = []
                for sel in email_selectors:
                    try:
                        rows = page.locator(sel).all()
                        if len(rows) > 2:
                            found_rows = rows
                            log(f"Found {len(rows)} rows with selector {sel}")
                            break
                    except Exception:
                        continue

                for row in found_rows[:15]:
                    try:
                        text = row.inner_text().strip()
                        if not text or len(text) < 10:
                            continue
                        lines = [l.strip() for l in text.split('\n') if l.strip()]
                        if not lines:
                            continue
                        preview = " | ".join(lines[:4])[:400]

                        # Click into the email to get full details
                        subject = lines[0][:120] if lines else ""
                        sender = ""
                        date_str = ""
                        body_text = ""
                        try:
                            row.click(timeout=8000)
                            page.wait_for_timeout(4000)

                            # Try to extract subject, sender, date, body from the reading pane
                            # Outlook reading pane typically has these in distinct elements
                            try:
                                # Subject is often in a heading
                                subj_el = page.locator('[role="heading"], h1, .ms-FocusZone [aria-label*="Subject"]').first
                                if subj_el.count() > 0:
                                    subject = subj_el.inner_text().strip()[:150]
                            except Exception:
                                pass

                            # Get the email body — look for the message content area
                            try:
                                # Try multiple selectors for the body
                                for body_sel in [
                                    '[role="document"]',
                                    '.email-body',
                                    '[aria-label="Email body"]',
                                    '.ms-DetailsRow-fields',
                                ]:
                                    bel = page.locator(body_sel).first
                                    if bel.count() > 0:
                                        bt = bel.inner_text().strip()
                                        if len(bt) > 100:
                                            body_text = bt[:3000]
                                            break
                                # Fallback: get main content area text
                                if not body_text:
                                    main_text = page.inner_text("body")
                                    # Take a chunk that's likely the email body
                                    if len(main_text) > 500:
                                        body_text = main_text[:3000]
                            except Exception:
                                pass

                            # Try to find sender
                            try:
                                # Sender often appears near the top
                                sender_m = re.search(r'From[:\s]+([^\n<]+)', page.inner_text("body")[:2000])
                                if sender_m:
                                    sender = sender_m.group(1).strip()[:80]
                            except Exception:
                                pass

                            # Go back to list (press Escape or click back)
                            try:
                                page.keyboard.press("Escape")
                                page.wait_for_timeout(2000)
                            except Exception:
                                pass

                        except Exception as e:
                            log(f"  Could not open email '{subject[:30]}': {e}", "warn")

                        emails.append({
                            "subject": subject,
                            "sender": sender,
                            "date": date_str,
                            "preview": preview,
                            "body": body_text or preview,
                            "source": "outlook",
                        })
                    except Exception:
                        continue

                # If still zero, dump what we see for debugging
                if len(emails) == 0:
                    try:
                        body_sample = page.inner_text("body")[:500]
                        log(f"Inbox body preview: {body_sample[:200]}", "warn")
                        page.screenshot(path=str(LOG_DIR / "outlook-debug.png"))
                        log("Saved outlook-debug.png for inspection", "warn")
                    except Exception:
                        pass

                log(f"Pulled {len(emails)} teacher emails from Office 365.")
            except Exception as e:
                log(f"Email extraction failed: {e}", "warn")

        finally:
            browser.close()

    return emails

# ------------------------------------------------------- sync queue ---
