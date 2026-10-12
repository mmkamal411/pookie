// Support-grove applet content (S1 Help Center & FAQ, S2 AI Support Chat,
// S3 Support Tickets) plus the in-applet sub-views the pages used to own:
// faq-article, ticket-new, ticket-detail. In-applet links resolve through
// the bus's resolveAppletLink, so support cross-navigation never leaves
// the overlay.

"use client";

import { useEffect, useState } from "react";
import { FaqSearch } from "@/components/support/faq-search";
import { FaqTree } from "@/components/support/faq-tree";
import { AiChat } from "@/components/support/ai-chat";
import { TicketList } from "@/components/support/ticket-list";
import { TicketForm } from "@/components/support/ticket-form";
import { TicketThread } from "@/components/support/ticket-thread";
import { ArticleView, type Article } from "@/components/support/article-view";
import { openApplet, type AppletParams } from "@/lib/applet-bus";
import {
  AppletError,
  AppletGate,
  AppletLoading,
  useAppletTenant,
  useSquad5Ctx,
} from "@/components/applet-views-shared";

/** S1 Help Center & FAQ. */
export function FaqApplet() {
  const t = useAppletTenant();
  return (
    <div className="space-y-4">
      <FaqSearch childSlug={t.childSlug} />
      <FaqTree childSlug={t.childSlug} />
      <p className="pt-1 text-center text-[13px] text-stardust-400">
        Can&apos;t find it?{" "}
        <a href={`/c/${t.childSlug}/support/chat`} className="text-nova-300 underline">
          Ask Pookie (AI chat)
        </a>{" "}
        ·{" "}
        <a href={`/c/${t.childSlug}/support/tickets/new`} className="text-nova-300 underline">
          Open a Ticket
        </a>
      </p>
    </div>
  );
}

/** S1 article sub-view — fetches the article client-side (raw fetch: the
 *  article API returns { article, band }, not the { ok } envelope). */
export function FaqArticleApplet({ params }: { params: AppletParams }) {
  const t = useAppletTenant();
  const slug = params.slug ?? "";
  const [article, setArticle] = useState<Article | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!slug) return;
    let live = true;
    fetch(`/api/v1/support/faq/articles/${encodeURIComponent(slug)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j) => {
        if (!live) return;
        if (j?.article) setArticle(j.article as Article);
        else setFailed(true);
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, [slug]);

  if (failed) {
    return (
      <div className="p-1">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-center">
          <p className="text-base font-semibold text-star-100">Couldn&apos;t find that answer</p>
          <p className="mx-auto mt-1.5 max-w-xs text-sm leading-relaxed text-stardust-300">
            It may have moved or been retired. The Help Center has everything else.
          </p>
          <button
            type="button"
            onClick={() => openApplet("S1", {}, { replace: true })}
            className="mt-4 rounded-xl border border-nova-400/40 bg-nova-500/15 px-5 py-2.5 text-sm font-medium text-star-100 transition-colors hover:bg-nova-500/25"
          >
            Back to Help Center
          </button>
        </div>
      </div>
    );
  }
  if (!article) return <AppletLoading label="Help Center" />;
  return (
    <div>
      <button
        type="button"
        onClick={() => openApplet("S1", {}, { replace: true })}
        className="mb-3 text-sm text-nova-300 transition-colors hover:text-nova-200"
      >
        ← Help Center
      </button>
      <ArticleView article={article} childSlug={t.childSlug} />
    </div>
  );
}

/** S2 AI Support Chat. */
export function ChatApplet({ params }: { params: AppletParams }) {
  const t = useAppletTenant();
  const { s5, failed, retry } = useSquad5Ctx(t.childSlug);
  return (
    <AppletGate label="AI Support Chat" loading={!s5 && !failed} failed={failed} onRetry={retry}>
      {s5 ? (
        <AiChat
          childSlug={t.childSlug}
          initialArticle={params.article}
          parentContextName={s5.band === "child" && s5.role === "parent" ? "a parent" : undefined}
        />
      ) : null}
    </AppletGate>
  );
}

/** S3 Support Tickets. */
export function TicketsApplet() {
  const t = useAppletTenant();
  return <TicketList childSlug={t.childSlug} />;
}

/** S3 new-ticket sub-view — onCreated swaps to the thread, no navigation. */
export function TicketNewApplet() {
  const t = useAppletTenant();
  const { s5, failed, retry } = useSquad5Ctx(t.childSlug);
  return (
    <AppletGate label="Support Tickets" loading={!s5 && !failed} failed={failed} onRetry={retry}>
      {s5 ? (
        <div>
          <button
            type="button"
            onClick={() => openApplet("S3", {}, { replace: true })}
            className="mb-3 text-sm text-nova-300 transition-colors hover:text-nova-200"
          >
            ← Tickets
          </button>
          <TicketForm
            childSlug={t.childSlug}
            isTeen={s5.band === "teen"}
            onCreated={(id) => openApplet("ticket-detail", { id }, { replace: true })}
          />
        </div>
      ) : null}
    </AppletGate>
  );
}

/** S3 ticket-thread sub-view. */
export function TicketDetailApplet({ params }: { params: AppletParams }) {
  const t = useAppletTenant();
  const id = params.id ?? "";
  if (!id) {
    return (
      <AppletError
        label="Support Tickets"
        onRetry={() => openApplet("S3", {}, { replace: true })}
      />
    );
  }
  return (
    <div>
      <button
        type="button"
        onClick={() => openApplet("S3", {}, { replace: true })}
        className="mb-3 text-sm text-nova-300 transition-colors hover:text-nova-200"
      >
        ← Tickets
      </button>
      <TicketThread ticketId={id} childSlug={t.childSlug} />
    </div>
  );
}
