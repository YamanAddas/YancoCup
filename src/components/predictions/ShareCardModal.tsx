import { useState, useEffect, useCallback, useRef } from "react";
import { X, Download, Share2, Image, Smartphone } from "lucide-react";
import { generateShareCard, generateStoryCard } from "../../lib/shareCard";
import { useI18n } from "../../lib/i18n";
import type { ShareCardData } from "../../lib/shareCard";

interface ShareCardModalProps {
  open: boolean;
  onClose: () => void;
  data: ShareCardData;
}

function WhatsAppIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

function TelegramIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  );
}

function XIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

type Format = "card" | "story";

export default function ShareCardModal({ open, onClose, data }: ShareCardModalProps) {
  const { t } = useI18n();
  const [format, setFormat] = useState<Format>("card");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const blobRef = useRef<Blob | null>(null);
  const urlRef = useRef<string | null>(null);

  // Clean up blob URL on unmount or re-generate
  const revokeUrl = useCallback(() => {
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
  }, []);

  // Generate preview when modal opens or format changes
  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setGenerating(true);
    setStatus(null);
    revokeUrl();

    const gen = format === "story" ? generateStoryCard : generateShareCard;
    gen(data, t).then((blob) => {
      if (cancelled) return;
      setGenerating(false);
      if (blob) {
        blobRef.current = blob;
        const url = URL.createObjectURL(blob);
        urlRef.current = url;
        setPreviewUrl(url);
      }
    });

    return () => { cancelled = true; };
  }, [open, format, data, t, revokeUrl]);

  // Clean up on close
  useEffect(() => {
    if (!open) {
      revokeUrl();
      setPreviewUrl(null);
      blobRef.current = null;
    }
  }, [open, revokeUrl]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const flashStatus = (msg: string) => {
    setStatus(msg);
    setTimeout(() => setStatus(null), 2500);
  };

  const shareText = (): string => {
    const pred = data.quickPick
      ? { H: "Home Win", D: "Draw", A: "Away Win" }[data.quickPick]
      : `${data.homeScore}-${data.awayScore}`;
    return `${t("shareCard.myPredictionText")} ${data.homeTeam} ${pred} ${data.awayTeam} | YancoCup`;
  };

  const handleDownload = () => {
    const blob = blobRef.current;
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = format === "story" ? "yancocup-story.png" : "yancocup-prediction.png";
    a.click();
    URL.revokeObjectURL(url);
    flashStatus(t("shareCard.saved"));
  };

  const handleNativeShare = async () => {
    const blob = blobRef.current;
    if (!blob) return;
    const filename = format === "story" ? "yancocup-story.png" : "yancocup-prediction.png";
    const file = new File([blob], filename, { type: "image/png" });

    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ text: shareText(), files: [file] });
        flashStatus(t("shareCard.shared"));
        return;
      } catch { /* cancelled */ }
    }
    // Fallback to download
    handleDownload();
  };

  const handleWhatsApp = () => {
    // On mobile with Web Share API, native share is better (includes image)
    // For desktop, open WhatsApp web with text
    window.open(
      `https://wa.me/?text=${encodeURIComponent(shareText())}`,
      "_blank",
    );
    flashStatus(t("shareCard.opening"));
  };

  const handleTelegram = () => {
    window.open(
      `https://t.me/share/url?url=${encodeURIComponent("https://yamanaddas.github.io/YancoCup/")}&text=${encodeURIComponent(shareText())}`,
      "_blank",
    );
    flashStatus(t("shareCard.opening"));
  };

  const handleX = () => {
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText())}`,
      "_blank",
    );
    flashStatus(t("shareCard.opening"));
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-[yc-fade-in_200ms_ease-out]"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-yc-bg-surface border border-yc-border rounded-xl overflow-hidden animate-[yc-slide-up_300ms_ease-out] shadow-2xl shadow-black/40">
        {/* Green accent bar */}
        <div className="h-1 bg-gradient-to-r from-yc-green/30 via-yc-green to-yc-green/30" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-yc-border/50">
          <h3 className="text-yc-text-primary font-heading font-semibold text-base">
            {t("shareCard.shareTitle")}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-yc-text-tertiary hover:text-yc-text-primary hover:bg-yc-bg-elevated transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Format toggle */}
        <div className="flex items-center justify-center gap-1 px-5 py-3">
          <button
            onClick={() => setFormat("card")}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              format === "card"
                ? "bg-yc-green/12 text-yc-green border border-yc-green/20"
                : "text-yc-text-secondary hover:text-yc-text-primary"
            }`}
          >
            <Image size={14} />
            {t("shareCard.cardFormat")}
          </button>
          <button
            onClick={() => setFormat("story")}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              format === "story"
                ? "bg-yc-green/12 text-yc-green border border-yc-green/20"
                : "text-yc-text-secondary hover:text-yc-text-primary"
            }`}
          >
            <Smartphone size={14} />
            {t("shareCard.storyFormat")}
          </button>
        </div>

        {/* Preview */}
        <div className="px-5 pb-3">
          <div
            className={`relative bg-yc-bg-deep rounded-xl overflow-hidden border border-yc-border/30 ${
              format === "story" ? "aspect-[9/16] max-h-[320px] mx-auto w-[180px]" : "aspect-[1200/630]"
            }`}
          >
            {generating ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-yc-green/20 border-t-yc-green rounded-full animate-spin" />
              </div>
            ) : previewUrl ? (
              <img
                src={previewUrl}
                alt="Share card preview"
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-yc-text-tertiary text-sm">
                {t("shareCard.generateFailed")}
              </div>
            )}
          </div>
        </div>

        {/* Share buttons */}
        <div className="px-5 pb-5 space-y-3">
          {/* Primary: Native share (mobile) or download */}
          <div className="flex gap-2">
            {typeof navigator.share === "function" && (
              <button
                onClick={handleNativeShare}
                disabled={!blobRef.current}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-yc-green text-yc-bg-deep font-semibold text-sm transition-all hover:brightness-110 active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none"
              >
                <Share2 size={16} />
                {t("shareCard.shareImage")}
              </button>
            )}
            <button
              onClick={handleDownload}
              disabled={!blobRef.current}
              className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-yc-border text-yc-text-primary font-medium text-sm transition-all hover:border-yc-green-muted hover:text-yc-green disabled:opacity-40 disabled:pointer-events-none ${
                typeof navigator.share !== "function" ? "flex-1" : ""
              }`}
            >
              <Download size={16} />
              {t("shareCard.download")}
            </button>
          </div>

          {/* Social share buttons */}
          <div className="flex items-center gap-2">
            <span className="text-yc-text-tertiary text-xs mr-1">{t("share.title")}</span>
            <button
              onClick={handleWhatsApp}
              className="p-2.5 rounded-xl bg-yc-bg-elevated hover:bg-yc-border transition-colors text-[#25D366]"
              title="WhatsApp"
            >
              <WhatsAppIcon />
            </button>
            <button
              onClick={handleTelegram}
              className="p-2.5 rounded-xl bg-yc-bg-elevated hover:bg-yc-border transition-colors text-[#0088cc]"
              title="Telegram"
            >
              <TelegramIcon />
            </button>
            <button
              onClick={handleX}
              className="p-2.5 rounded-xl bg-yc-bg-elevated hover:bg-yc-border transition-colors text-yc-text-secondary hover:text-yc-text-primary"
              title="X"
            >
              <XIcon />
            </button>
          </div>

          {/* Status toast */}
          {status && (
            <div className="text-center text-yc-green text-sm font-medium animate-[yc-fade-in_200ms_ease-out]">
              {status}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
