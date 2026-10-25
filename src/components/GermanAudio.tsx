import { useEffect, useRef, useState } from "react";
import { Square, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { germanVoice, spokenGerman } from "@/lib/speech";

export function GermanAudio({ text, label = "Écouter le mot", autoPlay = false, large = false }: { text: string; label?: string; autoPlay?: boolean; large?: boolean }) {
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [playing, setPlaying] = useState(false);
  const current = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) return;
    const synth = window.speechSynthesis;
    const load = () => setVoice(germanVoice(synth.getVoices()));
    load();
    synth.addEventListener("voiceschanged", load);
    return () => synth.removeEventListener("voiceschanged", load);
  }, []);

  useEffect(() => () => {
    if (current.current) {
      current.current.onend = null;
      current.current.onerror = null;
      window.speechSynthesis.cancel();
      current.current = null;
    }
  }, [text]);

  const auto = useRef(false);
  useEffect(() => {
    if (autoPlay && voice && !auto.current && spokenGerman(text)) { auto.current = true; listen(); }
  }); // eslint-disable-line react-hooks/exhaustive-deps

  if (!voice || !spokenGerman(text)) return null;

  function listen() {
    if (!voice) return;
    const synth = window.speechSynthesis;
    if (playing) {
      synth.cancel();
      current.current = null;
      setPlaying(false);
      return;
    }
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(spokenGerman(text));
    utterance.voice = voice;
    utterance.lang = voice.lang;
    utterance.rate = 0.85;
    utterance.onend = () => { current.current = null; setPlaying(false); };
    utterance.onerror = (event) => {
      current.current = null;
      setPlaying(false);
      if (event.error !== "canceled" && event.error !== "interrupted") {
        toast.error("Lecture indisponible sur cet appareil. Réessayez.");
      }
    };
    current.current = utterance;
    setPlaying(true);
    synth.speak(utterance);
  }

  return (
    <Button type="button" size="icon" variant="outline" className={large ? "h-20 w-20 shrink-0 rounded-full [&_svg]:size-9" : "h-11 w-11 shrink-0"}
      aria-label={playing ? "Arrêter la lecture" : label} title={playing ? "Arrêter la lecture" : label}
      aria-pressed={playing} onClick={listen}>
      {playing ? <Square aria-hidden="true" /> : <Volume2 aria-hidden="true" />}
    </Button>
  );
}