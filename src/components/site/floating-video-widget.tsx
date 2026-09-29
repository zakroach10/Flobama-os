"use client";

import { useState, useEffect, useRef } from "react";
import { X, Volume2, VolumeX, Maximize2 } from "lucide-react";

export function FloatingVideoWidget() {
  const [isVisible, setIsVisible] = useState(false);
  const [isClosed, setIsClosed] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const modalVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  const toggleMute = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const openLightbox = () => {
    if (videoRef.current) {
      videoRef.current.pause();
    }
    setIsLightboxOpen(true);
  };

  const closeLightbox = () => {
    setIsLightboxOpen(false);
    if (videoRef.current && !isClosed) {
      videoRef.current.play().catch(() => {});
    }
  };

  if (isClosed) return null;

  return (
    <>
      <div
        className={`fixed bottom-4 left-4 md:bottom-8 md:left-8 z-50 transition-all duration-700 transform ${
          isVisible
            ? "translate-y-0 opacity-100"
            : "translate-y-10 opacity-0 pointer-events-none"
        }`}
      >
        <div className="bg-card/95 backdrop-blur-md border border-border shadow-2xl rounded-xl overflow-hidden w-64 md:w-72 relative group">
          {/* Header bar / Controls */}
          <div className="absolute top-2 right-2 z-20 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm rounded-full p-1 border border-white/10">
            <button
              onClick={openLightbox}
              className="text-white/80 hover:text-white transition-colors p-1"
              aria-label="Expand video"
              title="Watch larger"
            >
              <Maximize2 size={14} />
            </button>
            <button
              onClick={toggleMute}
              className="text-white/80 hover:text-white transition-colors p-1"
              aria-label={isMuted ? "Unmute video" : "Mute video"}
              title={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
            </button>
            <button
              onClick={() => setIsClosed(true)}
              className="text-white/80 hover:text-white transition-colors p-1"
              aria-label="Close video widget"
              title="Close"
            >
              <X size={14} />
            </button>
          </div>

          {/* Video Container */}
          <div
            onClick={openLightbox}
            className="relative aspect-video w-full bg-black overflow-hidden pointer-events-auto cursor-pointer group/vid"
          >
            <video
              ref={videoRef}
              src="https://assets.cdn.filesafe.space/EoCbYBHBgxShA8KuCYLM/media/6a6bec12f982994d153556ed.mp4"
              autoPlay
              muted
              loop
              playsInline
              className="w-full h-full object-cover transition-transform duration-500 group-hover/vid:scale-105"
            />
            {/* Hover overlay with expand prompt */}
            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/vid:opacity-100 transition-opacity flex items-center justify-center">
              <span className="bg-primary/90 text-primary-foreground text-xs font-heading font-bold uppercase tracking-wider px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-lg">
                <Maximize2 size={12} />
                Expand Player
              </span>
            </div>
          </div>

          {/* Title banner */}
          <div
            onClick={openLightbox}
            className="p-3 bg-card border-t border-border/50 flex items-center justify-between cursor-pointer hover:bg-card/80 transition-colors"
          >
            <span className="text-xs font-heading font-bold uppercase tracking-wider text-foreground">
              America&apos;s Best Restaurants
            </span>
            <span className="text-[10px] text-primary font-bold uppercase tracking-widest flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-primary animate-pulse inline-block" />
              Watch
            </span>
          </div>
        </div>
      </div>

      {/* Lightbox Modal */}
      {isLightboxOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
          onClick={closeLightbox}
        >
          <div
            className="relative w-full max-w-4xl bg-card border border-border shadow-2xl rounded-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-primary animate-pulse" />
                <h3 className="font-heading font-bold uppercase tracking-wider text-lg text-foreground">
                  America&apos;s Best Restaurants — FloBama Feature
                </h3>
              </div>
              <button
                onClick={closeLightbox}
                className="p-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Close lightbox"
              >
                <X size={20} />
              </button>
            </div>

            {/* Video with native controls */}
            <div className="relative aspect-video w-full bg-black">
              <video
                ref={modalVideoRef}
                src="https://assets.cdn.filesafe.space/EoCbYBHBgxShA8KuCYLM/media/6a6bec12f982994d153556ed.mp4"
                autoPlay
                controls
                playsInline
                className="w-full h-full object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
