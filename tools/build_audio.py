"""Builds every audio asset the film needs and the timing map the animation reads.

  1. Voice-over: cuts the ElevenLabs read (assets/vo) into its 17 script lines,
     speeds it up slightly and re-spaces the lines to the motion.
  2. Music: extends the reference bed (assets/ref) to exactly 30 s with a
     2-bar loop at the most similar beat pair, ending on its own outro.
  3. SFX: synthesises every effect from scratch (royalty-free).

Writes public/audio/vo.wav, public/audio/music.wav, public/sfx/*.wav and
src/timings.json. Run with: python3 -I tools/build_audio.py
"""
import json
import os
import subprocess
import tempfile

import librosa
import numpy as np
import soundfile as sf

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SR = 48000
FILM = 30.0
VO_TEMPO = 1.06

# Line cut points in the original VO (seconds). Word timings came from a
# pocketsphinx pass; every cut sits inside a detected silence.
# `gap` is the silence placed before the line in the final film.
LINES = [
    ("Your whole day runs on American companies.", 0.00, 2.80, 0.25),
    ("How many do you own?", 3.05, 4.36, 0.18),
    ("Too far.", 4.60, 5.60, 0.35),
    ("Too expensive.", 5.84, 7.12, 0.12),
    ("Too complicated.", 7.30, 8.62, 0.12),
    ("Somebody else's game.", 8.86, 10.30, 0.18),
    ("Not anymore.", 10.47, 11.45, 0.30),
    ("We opened the door.", 11.64, 13.08, 0.12),
    ("US stocks.", 13.27, 14.52, 0.50),
    ("Now on m.Stock.", 14.68, 16.30, 0.08),
    ("5,000+ stocks and ETFs.", 16.42, 19.04, 0.15),
    ("Buy from India.", 19.16, 20.36, 0.12),
    ("Own a piece.", 20.52, 21.42, 0.15),
    ("From $1.*", 21.52, 22.70, 0.06),
    ("100% digital account opening.", 22.85, 25.48, 0.15),
    ("Customer by habit.", 25.60, 26.92, 0.12),
    ("Shareholder by choice.", 27.02, 28.99, 0.12),
]


def load(path, sr=SR):
    y, _ = librosa.load(path, sr=sr, mono=True)
    return y


def ffmpeg_tempo(y, tempo):
    with tempfile.TemporaryDirectory() as d:
        a, b = os.path.join(d, "a.wav"), os.path.join(d, "b.wav")
        sf.write(a, y, SR)
        subprocess.run(
            ["ffmpeg", "-v", "error", "-y", "-i", a, "-af", f"atempo={tempo}", b],
            check=True,
        )
        out, _ = sf.read(b)
    return out.astype(np.float32)


def fade(y, ms_in=8, ms_out=25):
    y = y.copy()
    i, o = int(SR * ms_in / 1000), int(SR * ms_out / 1000)
    y[:i] *= np.linspace(0, 1, i)
    y[-o:] *= np.linspace(1, 0, o)
    return y


def build_vo():
    src = load(os.path.join(ROOT, "assets/vo/ruhaan_vo_v4.mp3"))
    out = np.zeros(int(SR * FILM), dtype=np.float32)
    t = 0.0
    lines = []
    for text, a, b, gap in LINES:
        clip = fade(ffmpeg_tempo(src[int(a * SR) : int(b * SR)], VO_TEMPO))
        t += gap
        s = int(t * SR)
        out[s : s + len(clip)] += clip
        dur = len(clip) / SR
        lines.append({"text": text, "start": round(t, 3), "end": round(t + dur, 3)})
        t += dur
    print(f"VO ends at {t:.2f}s")
    peak = np.abs(out).max()
    out = out / peak * 0.89
    sf.write(os.path.join(ROOT, "public/audio/vo.wav"), out, SR, subtype="PCM_16")
    return lines


def build_music():
    y = load(os.path.join(ROOT, "assets/ref/sample_a_music.wav"))
    ya = librosa.resample(y, orig_sr=SR, target_sr=22050)
    _, beats = librosa.beat.beat_track(y=ya, sr=22050)
    bt = librosa.frames_to_time(beats, sr=22050)
    feat = np.vstack([
        librosa.feature.chroma_cqt(y=ya, sr=22050),
        librosa.feature.mfcc(y=ya, sr=22050, n_mfcc=13) / 50,
    ])

    def at(sec):
        f = librosa.time_to_frames(sec, sr=22050)
        return feat[:, f : f + 8].mean(axis=1)

    need = FILM - len(y) / SR
    best = None
    for i in range(len(bt)):
        for k in (8, 12):
            j = i + k
            if j >= len(bt) or not (3.0 < bt[i] and bt[j] < 20.0):
                continue
            d = np.linalg.norm(at(bt[i]) - at(bt[j]))
            score = d + 6 * abs((bt[j] - bt[i]) - need) / FILM * 10
            if best is None or score < best[0]:
                best = (score, bt[i], bt[j])
    _, a, b = best
    xf = int(0.03 * SR)
    head = y[: int(b * SR)]
    tail = y[int(a * SR) - xf :]
    ramp = np.linspace(0, 1, xf)
    joined = np.concatenate(
        [head[:-xf], head[-xf:] * (1 - ramp) + tail[:xf] * ramp, tail[xf:]]
    )
    stretch = (len(joined) / SR) / FILM
    music = ffmpeg_tempo(joined, stretch)[: int(FILM * SR)]
    music = np.pad(music, (0, int(FILM * SR) - len(music)))
    music[-int(0.4 * SR) :] *= np.linspace(1, 0, int(0.4 * SR))
    sf.write(os.path.join(ROOT, "public/audio/music.wav"), music, SR, subtype="PCM_16")
    print(f"music: loop {a:.2f}->{b:.2f}s repeated, tempo x{stretch:.3f}")
    # Beat grid in film time, so motion can land on the music.
    loop = [(t + (b - a)) / stretch for t in bt if t >= a]
    grid = sorted({round(t, 3) for t in [t / stretch for t in bt if t < b] + loop})
    return [t for t in grid if t < FILM]


# ---------------------------------------------------------------- SFX synth
rng = np.random.default_rng(7)


def env(n, a, d, curve=4.0):
    t = np.arange(n) / SR
    e = np.minimum(1, t / max(a, 1e-4)) * np.exp(-np.maximum(0, t - a) * curve / max(d, 1e-4))
    return e


def bandnoise(n, lo, hi):
    x = rng.standard_normal(n)
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(n, 1 / SR)
    X[(f < lo) | (f > hi)] = 0
    return np.fft.irfft(X, n)


def sweep_noise(dur, f0, f1, q=0.35):
    n = int(dur * SR)
    out = np.zeros(n)
    seg = 1024
    for i in range(0, n, seg):
        p = i / n
        fc = f0 * (f1 / f0) ** p
        out[i : i + seg] = bandnoise(seg * 2, fc * (1 - q), fc * (1 + q))[: min(seg, n - i)]
    return out


def norm(x, peak=0.8):
    return (x / (np.abs(x).max() + 1e-9) * peak).astype(np.float32)


def tone(freq, dur, decay):
    t = np.arange(int(dur * SR)) / SR
    return np.sin(2 * np.pi * freq * t) * np.exp(-t * decay)


def sfx():
    s = {}
    n = int(0.55 * SR)
    w = sweep_noise(0.55, 300, 4500) * np.hanning(n) ** 1.5
    s["whoosh"] = norm(w, 0.6)
    n = int(0.28 * SR)
    s["swish"] = norm(sweep_noise(0.28, 1500, 7000) * np.hanning(n) ** 2, 0.5)
    s["tick"] = norm(tone(2600, 0.04, 120) + 0.3 * tone(5200, 0.04, 200), 0.5)
    t = np.arange(int(0.12 * SR)) / SR
    s["pop"] = norm(np.sin(2 * np.pi * (650 - 3000 * t) * t) * np.exp(-t * 38), 0.7)
    n = int(0.04 * SR)
    s["tap"] = norm(bandnoise(n, 2000, 9000) * env(n, 0.001, 0.01) + tone(1800, 0.04, 150), 0.55)
    t = np.arange(int(0.9 * SR)) / SR
    sub = np.sin(2 * np.pi * (70 * np.exp(-t * 3) + 38) * t) * np.exp(-t * 4.5)
    hit = bandnoise(len(t), 80, 2500) * np.exp(-t * 30)
    s["thud"] = norm(sub + 0.35 * hit, 0.9)
    # lock rattle: metallic clicks with ringing partials
    n = int(0.6 * SR)
    r = np.zeros(n)
    for k, at in enumerate([0.0, 0.07, 0.13, 0.22, 0.29, 0.38, 0.44]):
        i = int(at * SR)
        m = int(0.12 * SR)
        click = bandnoise(m, 1500, 9000) * np.exp(-np.arange(m) / SR * 90)
        ring = sum(tone(f, 0.12, 45) for f in (2230, 3170, 4410)) * 0.25
        g = 1.0 - k * 0.08
        r[i : i + m] += (click + ring[:m]) * g
    s["rattle"] = norm(r, 0.6)
    n = int(0.22 * SR)
    s["strike"] = norm(sweep_noise(0.22, 5000, 1200) * np.hanning(n), 0.45)
    t = np.arange(int(0.9 * SR)) / SR
    riser = sweep_noise(0.9, 400, 6000) * (t / t[-1]) ** 2.2
    riser += 0.3 * np.sin(2 * np.pi * (220 + 660 * (t / t[-1]) ** 2) * t) * (t / t[-1]) ** 2
    s["riser"] = norm(riser, 0.55)
    # unlock: two-stage clack
    a = bandnoise(int(0.05 * SR), 800, 6000) * np.exp(-np.arange(int(0.05 * SR)) / SR * 80)
    b = bandnoise(int(0.08 * SR), 300, 4000) * np.exp(-np.arange(int(0.08 * SR)) / SR * 50)
    u = np.zeros(int(0.25 * SR))
    u[: len(a)] += a
    u[int(0.09 * SR) : int(0.09 * SR) + len(b)] += b * 1.3
    s["unlock"] = norm(u, 0.7)
    # door swing: low airy swell with a soft wooden knock at the start
    t = np.arange(int(1.0 * SR)) / SR
    swell = bandnoise(len(t), 120, 900) * np.sin(np.pi * t / t[-1]) ** 1.5
    knock = np.pad(s["thud"], (0, len(t)))[: len(t)]
    s["door"] = norm(swell * 0.7 + 0.24 * knock, 0.55)
    t = np.arange(int(1.6 * SR)) / SR
    boom = np.sin(2 * np.pi * (60 * np.exp(-t * 2) + 34) * t) * np.exp(-t * 2.5)
    crack = bandnoise(len(t), 1000, 12000) * np.exp(-t * 25)
    s["impact"] = norm(boom + 0.25 * crack, 0.95)
    s["chime"] = norm(
        np.concatenate([tone(1318.5, 0.16, 18)[: int(0.09 * SR)], tone(1975.5, 0.9, 6)])
        + 0.0,
        0.45,
    )
    t = np.arange(int(1.4 * SR)) / SR
    sh = sum(np.sin(2 * np.pi * f * t + rng.uniform(0, 6)) for f in (2637, 3136, 3520, 3951, 4699))
    s["shimmer"] = norm(sh * (1 + 0.5 * np.sin(2 * np.pi * 9 * t)) * np.sin(np.pi * t / t[-1]) ** 2, 0.25)
    t = np.arange(int(2.2 * SR)) / SR
    bell = sum(np.sin(2 * np.pi * f * t) * np.exp(-t * d) * g for f, d, g in
               [(523.25, 2.2, 1), (659.25, 2.6, 0.7), (783.99, 3.0, 0.6), (1046.5, 3.5, 0.35)])
    s["sting"] = norm(bell + 0.8 * np.sin(2 * np.pi * 65.4 * t) * np.exp(-t * 3), 0.6)
    # board flip: a short clatter of soft flap ticks (split-flap board updating)
    n = int(0.42 * SR)
    fl = np.zeros(n)
    for k in range(11):
        at = int((k * 0.03 + rng.uniform(0, 0.012)) * SR)
        m = int(0.03 * SR)
        g = np.hanning(m) * (1 - k / 13)
        fl[at : at + m] += bandnoise(m, 1800, 7000) * g + tone(2400 + 300 * (k % 3), 0.03, 120)[:m] * 0.3 * g
    s["flap"] = norm(fl, 0.5)
    for k, v in s.items():
        st = np.stack([v, v], axis=1)
        sf.write(os.path.join(ROOT, f"public/sfx/{k}.wav"), st, SR, subtype="PCM_16")
    print("sfx:", ", ".join(sorted(s)))


if __name__ == "__main__":
    lines = build_vo()
    beats = build_music()
    sfx()
    with open(os.path.join(ROOT, "src/timings.json"), "w") as f:
        json.dump({"fps": 30, "duration": FILM, "lines": lines, "beats": beats}, f, indent=1)
    for l in lines:
        print(f'{l["start"]:6.2f}-{l["end"]:6.2f}  {l["text"]}')
