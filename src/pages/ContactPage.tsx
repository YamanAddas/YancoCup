import { useState, useEffect } from "react";
import { NavLink } from "react-router-dom";
import { ArrowLeft, Send, CheckCircle, AlertCircle } from "lucide-react";
import { useI18n } from "../lib/i18n";
import { WORKER_URL } from "../lib/api";

type Status = "idle" | "sending" | "sent" | "error";

const CATEGORIES = [
  "general",
  "bug",
  "feature",
  "account",
  "predictions",
  "pools",
  "other",
] as const;

export default function ContactPage() {
  const { t } = useI18n();

  useEffect(() => { window.scrollTo(0, 0); }, []);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [category, setCategory] = useState<string>("general");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const canSubmit =
    status !== "sending" &&
    name.trim().length > 0 &&
    email.trim().length > 0 &&
    message.trim().length > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setStatus("sending");
    setErrorMsg("");

    try {
      const res = await fetch(`${WORKER_URL}/api/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          category: t(`contact.cat_${category}`),
          message: message.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null) as { error?: string } | null;
        throw new Error(data?.error ?? "Failed to send");
      }

      setStatus("sent");
    } catch (err) {
      setStatus("error");
      setErrorMsg(
        err instanceof Error ? err.message : t("contact.errorGeneric"),
      );
    }
  }

  if (status === "sent") {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <CheckCircle size={48} className="text-yc-green mx-auto mb-4" />
        <h1 className="font-heading text-2xl font-bold mb-2">
          {t("contact.sentTitle")}
        </h1>
        <p className="text-yc-text-secondary text-sm mb-8">
          {t("contact.sentDesc")}
        </p>
        <NavLink
          to="/"
          className="inline-flex items-center gap-2 bg-yc-green text-yc-bg-deep font-semibold px-6 py-3 rounded-lg hover:brightness-110 active:scale-[0.98] transition-all text-sm"
        >
          {t("nav.home")}
        </NavLink>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-8 sm:py-12">
      <NavLink
        to="/"
        className="inline-flex items-center gap-1.5 text-yc-text-secondary hover:text-yc-text-primary text-sm mb-6 transition-colors"
      >
        <ArrowLeft size={16} />
        {t("nav.home")}
      </NavLink>

      <h1 className="font-heading text-3xl font-bold mb-2">
        {t("contact.title")}
      </h1>
      <p className="text-yc-text-secondary text-sm mb-8">
        {t("contact.subtitle")}
      </p>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Name */}
        <div>
          <label
            htmlFor="contact-name"
            className="block text-sm font-medium text-yc-text-primary mb-1.5"
          >
            {t("contact.name")}
          </label>
          <input
            id="contact-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("contact.namePlaceholder")}
            className="w-full rounded-lg border border-yc-border bg-yc-bg-surface px-4 py-2.5 text-sm text-yc-text-primary placeholder:text-yc-text-tertiary focus:outline-none focus:border-yc-green transition-colors"
            required
          />
        </div>

        {/* Email */}
        <div>
          <label
            htmlFor="contact-email"
            className="block text-sm font-medium text-yc-text-primary mb-1.5"
          >
            {t("contact.email")}
          </label>
          <input
            id="contact-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("contact.emailPlaceholder")}
            className="w-full rounded-lg border border-yc-border bg-yc-bg-surface px-4 py-2.5 text-sm text-yc-text-primary placeholder:text-yc-text-tertiary focus:outline-none focus:border-yc-green transition-colors"
            required
          />
        </div>

        {/* Category */}
        <div>
          <label
            htmlFor="contact-category"
            className="block text-sm font-medium text-yc-text-primary mb-1.5"
          >
            {t("contact.category")}
          </label>
          <select
            id="contact-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-lg border border-yc-border bg-yc-bg-surface px-4 py-2.5 text-sm text-yc-text-primary focus:outline-none focus:border-yc-green transition-colors"
          >
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {t(`contact.cat_${cat}`)}
              </option>
            ))}
          </select>
        </div>

        {/* Message */}
        <div>
          <label
            htmlFor="contact-message"
            className="block text-sm font-medium text-yc-text-primary mb-1.5"
          >
            {t("contact.message")}
          </label>
          <textarea
            id="contact-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={t("contact.messagePlaceholder")}
            rows={6}
            maxLength={5000}
            className="w-full rounded-lg border border-yc-border bg-yc-bg-surface px-4 py-2.5 text-sm text-yc-text-primary placeholder:text-yc-text-tertiary focus:outline-none focus:border-yc-green transition-colors resize-y"
            required
          />
          <p className="text-xs text-yc-text-tertiary mt-1 text-end">
            {message.length}/5000
          </p>
        </div>

        {/* Error */}
        {status === "error" && (
          <div className="flex items-start gap-2 rounded-lg border border-yc-loss/30 bg-yc-loss/10 px-4 py-3 text-sm text-yc-loss">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            {errorMsg || t("contact.errorGeneric")}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full flex items-center justify-center gap-2 bg-yc-green text-yc-bg-deep font-semibold px-6 py-3 rounded-lg hover:brightness-110 active:scale-[0.98] transition-all text-sm disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {status === "sending" ? (
            <div className="w-4 h-4 rounded-full border-2 border-yc-bg-deep border-t-transparent animate-spin" />
          ) : (
            <Send size={16} />
          )}
          {status === "sending" ? t("contact.sending") : t("contact.send")}
        </button>
      </form>
    </div>
  );
}
